#!/usr/bin/env node
/**
 * Donut Ace ↔ Minecraft bridge.
 *
 * Joins the game server as the deposit bot and does three things:
 *   1. mirrors public chat to the site's Live Chat page,
 *   2. accepts link codes players whisper it (binds their IGN to their account),
 *   3. reports "X paid you $1.5m" receipts so matched deposits are credited.
 *
 * It only reads messages the server marked as system/whisper — never the
 * player chat channel — because a player could otherwise fake a receipt by
 * typing it in normal chat.
 *
 *   node bridge.js
 *
 * Configuration comes from minecraft-bridge/.env, then the project's .env,
 * then the real environment. See .env.example.
 */

import { createHmac, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Must load before mineflayer pulls in minecraft-protocol. Vendored from
// donutmineflayer (MIT) so 1.21.11-style servers accept our packet timing and
// signed chat. It only talks to Mojang's certificate endpoint.
require('./donut/checksum.cjs');
const donut = require('./donut/vanilla.cjs');

loadEnv(join(here, '..', '.env'));
loadEnv(join(here, '.env'));

const config = {
    // Node resolves "localhost" to ::1 first on Windows while `php artisan serve`
    // listens on 127.0.0.1, so pin the IPv4 loopback.
    appUrl: stripSlash(process.env.MC_APP_URL || process.env.APP_URL || 'http://127.0.0.1:8070').replace(
        '//localhost',
        '//127.0.0.1',
    ),
    secret: process.env.MC_BRIDGE_SECRET || '',
    host: process.env.MC_SERVER_HOST || 'play.donutsmp.net',
    port: Number(process.env.MC_SERVER_PORT || 25565),
    version: process.env.MC_SERVER_VERSION || '',
    username: process.env.MC_BOT_USERNAME || '',
    auth: process.env.MC_BOT_AUTH || 'microsoft',
    // Set true only if DonutSMP delivers payments as normal player chat, which
    // would let anyone forge a receipt by typing it.
    allowChatPosition: process.env.MC_ALLOW_CHAT_POSITION === '1',
};

if (!config.secret) {
    fatal('MC_BRIDGE_SECRET is empty — copy it from the site .env before starting.');
}
if (!config.username) {
    fatal('MC_BOT_USERNAME is empty — set the bot account (email for Microsoft auth).');
}

const log = (...args) => console.log(new Date().toISOString(), '[bridge]', ...args);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------- http */

/** X-Signature = HMAC-SHA256(secret, "<ms timestamp>.<raw body>") */
function sign(stamp, body) {
    return createHmac('sha256', config.secret).update(`${stamp}.${body}`).digest('hex');
}

/**
 * JSON POST over node:http(s). Node 24's built-in fetch (undici) crashes the
 * whole process when the PHP dev server closes a keep-alive socket mid-parse,
 * so the bridge does not use it for its own callbacks.
 */
function sendJson(urlString, body, headers = {}) {
    return new Promise((resolve) => {
        const url = new URL(urlString);
        const send = url.protocol === 'https:' ? httpsRequest : httpRequest;

        const req = send(
            {
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname + url.search,
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    accept: 'application/json',
                    'content-length': Buffer.byteLength(body),
                    connection: 'close',
                    ...headers,
                },
                timeout: 10_000,
            },
            (res) => {
                let text = '';
                res.setEncoding('utf8');
                res.on('data', (chunk) => {
                    text += chunk;
                });
                res.on('end', () => {
                    let parsed = null;
                    try {
                        parsed = text ? JSON.parse(text) : null;
                    } catch {
                        parsed = { raw: text.slice(0, 200) };
                    }
                    resolve({
                        ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
                        status: res.statusCode ?? 0,
                        parsed,
                    });
                });
            },
        );

        req.on('timeout', () => req.destroy(new Error('timeout')));
        req.on('error', (error) => resolve({ ok: false, status: 0, error }));
        req.end(body);
    });
}

/** Posts a bot event, retrying with the same eventId so the site can dedupe. */
async function post(path, payload, eventId = randomUUID()) {
    const full = { eventId, ...payload };

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const body = JSON.stringify(full);
            const stamp = String(Date.now());
            const res = await sendJson(config.appUrl + path, body, {
                'x-timestamp': stamp,
                'x-signature': sign(stamp, body),
            });

            if (res.ok) return res.parsed;
            if (res.status > 0 && res.status < 500) {
                log(`${path} rejected`, res.status, res.parsed?.error ?? res.parsed?.message ?? '');
                return null;
            }
            log(`${path} failed:`, res.error?.message ?? `HTTP ${res.status}`);
        } catch (err) {
            log(`${path} failed:`, err.message);
        }

        await sleep(1000 * attempt);
    }

    log(`gave up on ${path}`, JSON.stringify(full).slice(0, 200));
    return null;
}

/* ------------------------------------------------------------------ upload */

const queue = [];
let sending = false;

function enqueue(player, message) {
    const text = String(message ?? '').replace(/\s+/g, ' ').trim();
    if (!text || !player || text.length > 400) return;

    // Servers that render chat as a system message can hand us the same line
    // through two events; drop the echo.
    const key = `${player.toLowerCase()}|${text}`;
    if (recent.has(key) && Date.now() - recent.get(key) < 20_000) return;
    recent.set(key, Date.now());
    if (recent.size > 500) recent.delete(recent.keys().next().value);

    queue.push({ player, message: text, at: Date.now() });
    if (queue.length >= 25) void flush();
}

async function flush() {
    if (sending || queue.length === 0) return;
    sending = true;

    const batch = queue.splice(0, 200);
    try {
        const body = JSON.stringify({ messages: batch });
        const stamp = String(Date.now());
        const res = await sendJson(config.appUrl + '/api/mc/chat', body, {
            'x-timestamp': stamp,
            'x-signature': sign(stamp, body),
        });

        if (!res.ok) {
            log('chat post rejected', res.status || res.error?.message);
            if (res.status === 401) queue.unshift(...batch);
        }
    } catch (err) {
        // The site is unreachable: hold the lines (bounded) and try again.
        queue.unshift(...batch);
        if (queue.length > 400) queue.splice(0, queue.length - 400);
        log('chat post failed:', err.message);
    } finally {
        sending = false;
    }
}

/* --------------------------------------------------------------- deposits */

// "<player> paid you $1.5m" — matched against the site's pending requests.
const PAY_RECEIPT = /(?<![A-Za-z0-9_])([A-Za-z0-9_]{3,16})\s+(?:paid|sent)\s+you\s+\$?\s*([\d,.]+\s*[KMB]?)/i;
// "[Name -> me] text" / "Name -> you: text"
const WHISPER = /^\[?([A-Za-z0-9_]{3,16})\s+(?:->|→)\s+(?:me|you)\]?\s*:?\s*(.+)$/i;
// DonutSMP: "Name whispers to you: text" / "Name whispers: text"
const WHISPER_PLAIN = /^([A-Za-z0-9_]{3,16})\s+whispers?(?:\s+to\s+you)?\s*:?\s*(.+)$/i;

// Responses to the bridge's own /pay. Anything else is an ambiguous receipt.
const PAYOUT_FAIL = /don'?t have enough|not enough (?:money|funds)|insufficient (?:funds|money|balance)|player not found|could not find (?:that )?player|invalid player|cannot pay|can'?t pay|is not online|can'?t pay yourself/i;

const LINK_REPLIES = {
    linked: 'Account linked! You can now deposit on the site.',
    invalid_code: 'Invalid or expired code. Generate a new one on the site.',
    username_taken: 'That Minecraft account is already linked to another user.',
    already_linked: 'This account is already linked. Contact support to change it.',
};

const lastAction = new Map();
function throttled(player) {
    const now = Date.now();
    if (now - (lastAction.get(player) ?? 0) < 3000) return true;
    lastAction.set(player, now);
    return false;
}

function parseAmount(raw) {
    const mult = { k: 1e3, m: 1e6, b: 1e9 };
    const text = raw.replace(/[\s,]/g, '');
    const suffix = text.slice(-1).toLowerCase();
    const value = mult[suffix] ? parseFloat(text.slice(0, -1)) * mult[suffix] : parseFloat(text);
    return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

let botUsername = null;
let activeBot = null;
let lastPlayers = null;
let payoutWatch = null;
let payoutBusy = false;
let claimEventId = null;

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function payoutSuccess(line, player) {
    const name = escapeRegex(player);

    return [
        new RegExp(`\\byou\\s+(?:have\\s+)?paid\\s+${name}\\b`, 'i'),
        new RegExp(`\\bpaid\\s+${name}\\s+\\$`, 'i'),
        new RegExp(`\\b${name}\\s+(?:has\\s+)?received\\b`, 'i'),
    ].some((pattern) => pattern.test(line));
}

function watchPayoutLine(line) {
    if (!payoutWatch) return;

    payoutWatch.lines.push(line);
    if (payoutWatch.lines.length > 12) payoutWatch.lines.shift();

    if (PAYOUT_FAIL.test(line)) {
        payoutWatch.failure = line;
    } else if (payoutSuccess(line, payoutWatch.player)) {
        payoutWatch.success = line;
    }
}

async function reportPayout(status, receipt, reason) {
    const watch = payoutWatch;
    payoutWatch = null;

    if (!watch) return;

    const result = await post('/api/bot/withdrawals/result', {
        id: watch.id,
        status,
        receipt: receipt ? String(receipt).slice(0, 300) : null,
        reason: reason ? String(reason).slice(0, 160) : null,
    });

    log(`withdrawal ${watch.id} -> ${status}`, result?.status ?? 'no response');
}

async function payWithdrawal(withdrawal) {
    const player = String(withdrawal?.player ?? '');
    const amount = Number(withdrawal?.game_amount);

    if (!/^[A-Za-z0-9_]{3,16}$/.test(player) || !Number.isSafeInteger(amount) || amount <= 0) {
        payoutWatch = { id: withdrawal?.id, player, amount, success: null, failure: 'invalid payout payload', lines: [] };
        await reportPayout('failed', null, 'invalid payout payload');
        return;
    }

    payoutWatch = { id: withdrawal.id, player, amount, success: null, failure: null, lines: [] };
    log(`paying $${amount} to ${player} (withdrawal ${withdrawal.id})`);

    try {
        activeBot.chat(`/pay ${player} ${amount}`);
    } catch (err) {
        await reportPayout('failed', null, `could not send /pay: ${err.message}`);
        return;
    }

    // One command, one result. A missing receipt is never retried: the site
    // holds it for review so the same payout cannot be sent twice.
    await sleep(10_000);

    if (payoutWatch?.success) {
        await reportPayout('paid', payoutWatch.success, null);
    } else if (payoutWatch?.failure) {
        await reportPayout('failed', payoutWatch.failure, 'server rejected the payment');
    } else {
        await reportPayout('unconfirmed', (payoutWatch?.lines ?? []).join(' | '), 'no payout confirmation');
    }
}

async function pollWithdrawal() {
    if (payoutBusy || !activeBot) return;

    payoutBusy = true;
    claimEventId ||= randomUUID();

    try {
        const result = await post('/api/bot/withdrawals/claim', {}, claimEventId);

        // Keep the same event id on a transport failure: a lost response must
        // not let a later poll claim a second payout.
        if (result === null) return;

        claimEventId = null;

        if (result.withdrawal) {
            await payWithdrawal(result.withdrawal);
        }
    } finally {
        payoutBusy = false;
    }
}

function reply(player, text) {
    if (!activeBot) return;
    try {
        activeBot.chat(`/msg ${player} ${text}`);
    } catch (err) {
        log('reply failed:', err.message);
    }
}

async function onWhisper(player, text) {
    const code = text.trim().toUpperCase();
    if (!/^[A-Z0-9]{8}$/.test(code) || throttled(player)) return;

    log(`link attempt from ${player}`);
    const result = await post('/api/bot/link', { player, code });
    const message = result && LINK_REPLIES[result.status];
    if (message) reply(player, message);
    if (result?.status === 'linked') log(`${player} linked`);
}

async function onPayment(player, rawAmount, raw) {
    const amount = parseAmount(rawAmount);
    if (amount <= 0 || throttled(player)) return;

    log(`payment from ${player}: ${amount}`);
    const result = await post('/api/bot/deposit', { player, amount, raw });
    if (!result) return;

    if (result.status === 'credited') {
        log(`deposit credited for ${player}`);
        reply(player, 'Deposit received, balance updated!');
    } else if (result.status === 'unmatched') {
        log(`deposit unmatched for ${player} (${amount})`);
        reply(player, 'Payment received but no matching deposit. Open the deposit page and start one first, or contact support.');
    }
}

async function heartbeat(state, extra = {}) {
    try {
        const body = JSON.stringify({
            state,
            bot: botUsername,
            host: config.host,
            version: config.version || null,
            players: typeof extra.players === 'number' ? extra.players : lastPlayers,
            detail: extra.detail ?? null,
        });
        const stamp = String(Date.now());
        const res = await sendJson(config.appUrl + '/api/mc/heartbeat', body, {
            'x-timestamp': stamp,
            'x-signature': sign(stamp, body),
        });

        if (!res.ok) {
            log('heartbeat failed:', res.error?.message ?? `HTTP ${res.status}`);
        }
    } catch (err) {
        log('heartbeat failed:', err.message);
    }
}

/* -------------------------------------------------------------------- game */

const recent = new Map();
let attempts = 0;

function connect() {
    let mineflayer;
    try {
        mineflayer = require('mineflayer');
    } catch {
        fatal('mineflayer is not installed — run `npm install` inside minecraft-bridge/.');
    }

    log(`connecting to ${config.host}:${config.port} as ${config.username} (${config.auth})`);
    void heartbeat('connecting');

    const bot = mineflayer.createBot({
        host: config.host,
        port: config.port,
        username: config.username,
        auth: config.auth,
        version: config.version || false,
        checkTimeoutInterval: 60_000,
    });

    /* Tick-end, player-loaded, sign probes and signed-chat wrapping. */
    donut.attachVanilla(bot);

    /* Fetch the Mojang chat certificate once per connection, then announce the
     * chat session. If this fails the bot still works; commands are unsigned. */
    let chatSessionTried = false;
    const trySignedChat = () => {
        if (chatSessionTried) return;

        const client = bot._client;
        const token = client?.session?.accessToken;
        if (!token) return;

        chatSessionTried = true;
        donut
            .fetchCertificates(token)
            .then((packed) => {
                Object.assign(client, packed);
                if (donut.sendChatSession(client)) {
                    log('signed chat session established');
                }
            })
            .catch((err) => log('signed chat unavailable:', err.message));
    };
    bot._client.on('login', () => setTimeout(trySignedChat, 100));
    bot.once('spawn', () => setTimeout(trySignedChat, 500));

    bot.once('spawn', () => {
        attempts = 0;
        botUsername = bot.username;
        activeBot = bot;
        lastPlayers = Object.keys(bot.players).length;
        log(`spawned as ${bot.username} — ${lastPlayers} players visible`);
        void heartbeat('online', { players: lastPlayers });
    });

    // Public chat mirror. Deposit receipts never arrive here.
    bot.on('chat', (username, message) => {
        if (username === bot.username) return;
        enqueue(username, message);
    });

    // Everything the server renders: chat, system lines and whispers. Pay and
    // link handling is limited to non-chat positions so a player cannot type a
    // receipt into chat and have it credited.
    bot.on('messagestr', (message, position) => {
        const fromChat = position === 'chat';
        const line = message.replace(/\s+/g, ' ').trim();

        // Payout receipts are server output. A player typing "not enough money"
        // in public chat must never be able to change a payout's result.
        if (payoutWatch && (!fromChat || config.allowChatPosition)) watchPayoutLine(line);

        if (fromChat && !config.allowChatPosition) {
            const match = /^<{1,2}([A-Za-z0-9_]{1,16})>{1,2}\s+(.+)$/.exec(message);
            if (match && match[1] !== bot.username) enqueue(match[1], match[2]);
            return;
        }
        if (fromChat) {
            const match = /^<{1,2}([A-Za-z0-9_]{1,16})>{1,2}\s+(.+)$/.exec(message);
            if (match && match[1] !== bot.username) enqueue(match[1], match[2]);
        }

        const whisper = WHISPER.exec(line) ?? WHISPER_PLAIN.exec(line);
        if (whisper && whisper[1] !== bot.username) {
            void onWhisper(whisper[1], whisper[2]);
            return;
        }

        const pay = PAY_RECEIPT.exec(line);
        if (pay && pay[1] !== bot.username) {
            void onPayment(pay[1], pay[2], line.slice(0, 300));
        }
    });

    /* A busy server fires playerJoined once per player already online (86 at
     * once here). Coalesce those into one heartbeat so the site's 60/min
     * throttle is not hit. */
    let refreshTimer = null;
    const refreshPlayers = () => {
        lastPlayers = Object.keys(bot.players).length;

        if (refreshTimer !== null) {
            return;
        }

        refreshTimer = setTimeout(() => {
            refreshTimer = null;
            void heartbeat('online', { players: lastPlayers });
        }, 2000);
    };
    bot.on('playerJoined', refreshPlayers);
    bot.on('playerLeft', refreshPlayers);

    bot.on('kicked', (reason) => {
        log('kicked:', typeof reason === 'string' ? reason : JSON.stringify(reason));
        void heartbeat('offline', { detail: 'kicked from the server' });
    });

    bot.on('error', (err) => log('error:', err.message));
    bot.on('end', (reason) => {
        attempts += 1;
        if (refreshTimer !== null) {
            clearTimeout(refreshTimer);
            refreshTimer = null;
        }
        botUsername = null;
        activeBot = null;
        payoutWatch = null;
        const wait = Math.min(60_000, 5_000 * attempts);
        log(`disconnected (${reason ?? 'unknown'}), reconnecting in ${Math.round(wait / 1000)}s`);
        void heartbeat('connecting', { detail: 'reconnecting' });
        setTimeout(connect, wait);
    });
}

/* -------------------------------------------------------------------- boot */

const keepAlive = setInterval(() => void flush(), 2500);
setInterval(() => void heartbeat(lastPlayers === null ? 'connecting' : 'online'), 30_000);
setInterval(() => void pollWithdrawal(), 5_000);

process.on('SIGINT', async () => {
    log('stopping');
    clearInterval(keepAlive);
    await flush();
    await heartbeat('offline', { detail: 'bridge stopped' });
    process.exit(0);
});

connect();

/* ----------------------------------------------------------------- helpers */

function loadEnv(file) {
    if (!existsSync(file)) return;
    const text = readFileSync(file, 'utf8');

    for (const line of text.split(/\r?\n/)) {
        const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
        if (!match) continue;
        let value = match[2].trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        if (process.env[match[1]] === undefined) process.env[match[1]] = value;
    }
}

function stripSlash(value) {
    return value.replace(/\/+$/, '');
}

function fatal(message) {
    console.error(new Date().toISOString(), '[bridge]', message);
    process.exit(1);
}
