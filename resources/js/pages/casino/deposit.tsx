import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowDownToLine, Check, Clock, Copy, Keyboard, Loader2, Lock, MessageSquareCode, Radio, Send, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CoinIcon } from '@/components/casino/art';
import { PageTitle } from '@/components/casino/page-title';
import { formatCoins, formatCoinsCompact } from '@/lib/casino';
import { cn } from '@/lib/utils';

type Pending = {
    id: number;
    game_amount: number;
    coins: number;
    status: string;
    expires_at: string;
    expires_in: number;
    at: string | null;
};

type Deposit = {
    id: number;
    coins: number;
    game_amount: number;
    status: string;
    at: string;
};

type Props = {
    amount: string;
    enabled: boolean;
    botIgn: string | null;
    ign: string | null;
    claimed: string | null;
    verified: boolean;
    online: boolean;
    rate: { coins_per_million: number; min_game: number; max_game: number; max_pending: number; ttl_minutes: number };
    pending: Pending[];
    recent: Deposit[];
};

/** 10_000_000 → "10m", 2_000_000_000 → "2b", 250_000 → "250k" */
function gameShorthand(value: number): string {
    const trim = (n: number) => String(Number(n.toFixed(2)));
    if (value >= 1_000_000_000) return `${trim(value / 1_000_000_000)}b`;
    if (value >= 1_000_000) return `${trim(value / 1_000_000)}m`;
    if (value >= 1_000) return `${trim(value / 1_000)}k`;
    return String(value);
}

/** "250m" / "2b" / "1500000" → whole in-game dollars, or null. */
function parseGameAmount(raw: string): number | null {
    const match = /^\s*([0-9][0-9.,]*)\s*([kKmMbB])?\s*$/.exec(raw);
    if (!match) return null;
    const value = parseFloat(match[1].replace(/,/g, ''));
    if (!Number.isFinite(value) || value <= 0) return null;
    const multiplier = { k: 1_000, m: 1_000_000, b: 1_000_000_000 }[
        (match[2] ?? '').toLowerCase() as 'k' | 'm' | 'b'
    ] ?? 1;
    return Math.round(value * multiplier);
}

const ERRORS: Record<string, string> = {
    not_linked: 'Link your Minecraft name first.',
    amount_out_of_range: 'That amount is outside the accepted range.',
    amount_too_small: 'That is worth less than one coin.',
    too_many_pending: 'You already have open deposits waiting — pay one of those first.',
    already_linked: 'This account is already linked. Contact support to change it.',
};

export default function Deposit({ amount, enabled, botIgn, ign, claimed, verified, online, rate, pending: initialPending, recent: initialRecent }: Props) {
    const { auth } = usePage().props;

    const initialGame = useMemo(() => parseGameAmount(amount) ?? 1_000_000, [amount]);

    const [isVerified, setIsVerified] = useState(verified);
    const [currentIgn, setCurrentIgn] = useState<string | null>(ign);
    const [amountText, setAmountText] = useState(gameShorthand(initialGame));
    const [pending, setPending] = useState<Pending[]>(initialPending);
    const [recent, setRecent] = useState<Deposit[]>(initialRecent);
    const [linkCode, setLinkCode] = useState<string | null>(null);
    const [busy, setBusy] = useState<'link' | 'create' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [copied, setCopied] = useState<string | null>(null);
    const [highlightLink, setHighlightLink] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const newestDeposit = useRef<number | null>(initialRecent[0]?.id ?? null);

    const gameAmount = useMemo(() => parseGameAmount(amountText), [amountText]);
    const coins = gameAmount === null ? 0 : Math.floor((gameAmount * rate.coins_per_million * 100) / 1_000_000);
    const amountValid = gameAmount !== null && gameAmount >= rate.min_game && gameAmount <= rate.max_game;

    const copy = async (value: string, key: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(key);
            setTimeout(() => setCopied(null), 1600);
        } catch {
            setCopied(null);
        }
    };

    /** Jumps to the verification card and flashes it so it is obvious where to go. */
    const focusLink = () => {
        const card = document.getElementById('link-card');
        if (!card) return;

        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.querySelector<HTMLElement>('button, input, a')?.focus({ preventScroll: true });
        setHighlightLink(true);
        window.setTimeout(() => setHighlightLink(false), 2600);
    };

    const post = async (url: string, body: unknown) => {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-XSRF-TOKEN': readCookie('XSRF-TOKEN') ?? '',
            },
            body: JSON.stringify(body),
        });

        const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

        return { ok: res.ok, json };
    };

    /* Ticks the countdowns and polls while a link or a payment is in flight. */
    const hasPending = pending.length > 0;
    const watching = Boolean(linkCode) || hasPending;

    const refresh = useCallback(async () => {
        const res = await fetch('/deposit/status', { headers: { Accept: 'application/json' } });
        if (!res.ok) return;
        const json = (await res.json()) as {
            verified?: boolean;
            ign?: string | null;
            pending?: Pending[];
            recent?: Deposit[];
        };

        if (typeof json.verified === 'boolean') setIsVerified(json.verified);
        if (typeof json.ign === 'string') setCurrentIgn(json.ign);
        if (Array.isArray(json.pending)) setPending(json.pending);

        if (Array.isArray(json.recent)) {
            setRecent(json.recent);

            /* A confirmed payment moves the wallet server-side. Refresh the
             * shared wallet prop so the header balance changes immediately
             * instead of waiting for a page navigation. */
            const newest = json.recent[0]?.id ?? null;

            if (newest !== null && newest !== newestDeposit.current) {
                newestDeposit.current = newest;
                router.reload({ only: ['wallet'] });
            }
        }

        if (json.verified && json.ign) {
            setLinkCode(null);
            setNotice((prev) => prev ?? `Linked as ${json.ign}.`);
        }
    }, []);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const poll = useRef<ReturnType<typeof setInterval> | null>(null);
    useEffect(() => {
        if (!watching) {
            if (poll.current) clearInterval(poll.current);
            poll.current = null;
            return;
        }

        poll.current = setInterval(() => void refresh(), 5000);
        return () => {
            if (poll.current) clearInterval(poll.current);
            poll.current = null;
        };
    }, [watching, refresh]);

    const startLink = async () => {
        setBusy('link');
        setError(null);
        setNotice(null);

        const { ok, json } = await post('/deposit/link', {});

        if (ok && typeof json.code === 'string') {
            setLinkCode(json.code);
            setNotice(`Code valid for ${Math.round(Number(json.expires_in ?? 600) / 60)} minutes.`);
        } else {
            setError(ERRORS[String(json.error ?? '')] ?? 'Could not create a link code. Try again.');
        }

        setBusy(null);
    };

    const createRequest = async () => {
        if (!amountValid || gameAmount === null) return;
        setBusy('create');
        setError(null);
        setNotice(null);

        const { ok, json } = await post('/deposit/create', { amount: gameAmount });

        if (ok && json.request && typeof json.request === 'object') {
            const request = json.request as Pending;
            setPending((prev) => [request, ...prev]);
            setNotice(`Send exactly ${gameShorthand(request.game_amount)} within ${rate.ttl_minutes} minutes.`);
        } else {
            setError(ERRORS[String(json.error ?? '')] ?? 'Could not start that deposit.');
        }

        setBusy(null);
    };

    const command = (value: number) => (botIgn ? `/pay ${botIgn} ${gameShorthand(value)}` : `/pay … ${gameShorthand(value)}`);
    const linkInstruction = linkCode ? `/msg ${botIgn ?? 'the bot'} ${linkCode}` : null;

    const remaining = (request: Pending) => {
        const seconds = Math.max(0, Math.floor((new Date(request.expires_at).getTime() - now) / 1000));
        return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    };

    return (
        <>
            <Head title="Deposit in game" />
            <PageTitle icon={ArrowDownToLine} title="Deposit in game" />

            <div className="grid gap-5 xl:grid-cols-[1fr_380px] [&>*]:min-w-0">
                <div className="rounded-2xl bg-surface p-5 ring-1 ring-line/60">
                    <div className="flex flex-wrap items-center gap-2">
                        <span
                            className={cn(
                                'flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold',
                                online ? 'bg-lime/15 text-lime' : 'bg-white/5 text-dim',
                            )}
                        >
                            <Radio className={cn('size-3.5', online && 'animate-pulse')} />
                            {online ? 'Bot online' : 'Bot offline'}
                        </span>
                        <span className="text-xs text-dim">
                            {(rate.coins_per_million / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 4 })}{' '}
                            {rate.coins_per_million === 1_000_000 ? 'coin' : 'coins'} per $1 in game
                        </span>
                    </div>

                    {!enabled && (
                        <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-400/10 p-3 text-sm text-amber-200">
                            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                            Deposits are switched off right now.
                        </p>
                    )}

                    {auth.user && !isVerified && (
                        <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-400/10 p-3 text-sm text-amber-200">
                            <Lock className="mt-0.5 size-4 shrink-0" />
                            Deposits are locked. Verify your Minecraft name before you can pay the bot.
                        </p>
                    )}

                    <ol className="mt-5 space-y-5">
                        <Step n={1} title="Link the name you will pay from">
                            You whisper a one-time code to the bot in game, so nobody can send coins in your name.
                        </Step>

                        <Step n={2} title="Say how much you are sending">
                            {!isVerified ? (
                                <div className="mt-2 rounded-xl border border-dashed border-line bg-surface-2/40 p-3.5">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-white/85">
                                        <Lock className="size-4 text-dim" /> Locked until your Minecraft name is verified
                                    </div>
                                    <p className="mt-1 text-xs text-dim">
                                        You cannot start a deposit or pay the bot yet — first prove the in-game name is
                                        yours with the code on the right.
                                    </p>
                                    <a
                                        href="#link-card"
                                        onClick={(event) => {
                                            event.preventDefault();
                                            focusLink();
                                        }}
                                        className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-lime px-3 py-1.5 text-xs font-bold text-lime-ink"
                                    >
                                        <ShieldCheck className="size-3.5" /> Go to verification
                                    </a>
                                </div>
                            ) : (
                            <>
                            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                                <label className="flex h-11 flex-1 items-center gap-2 rounded-xl bg-surface-2 px-3 font-mono ring-1 ring-line focus-within:ring-lime/50">
                                    <span className="text-sm text-dim">$</span>
                                    <input
                                        value={amountText}
                                        onChange={(e) => setAmountText(e.target.value.replace(/[^0-9.,kmbKMB]/g, ''))}
                                        disabled={!isVerified}
                                        placeholder="500m"
                                        className="w-full bg-transparent font-bold text-white outline-none placeholder:text-dim/60 disabled:opacity-50"
                                        aria-label="Amount in game money"
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={createRequest}
                                    disabled={!isVerified || !amountValid || busy === 'create' || !auth.user}
                                    className="flex items-center justify-center gap-1.5 rounded-xl bg-lime px-4 py-2.5 text-sm font-bold whitespace-nowrap text-lime-ink disabled:opacity-40"
                                >
                                    {busy === 'create' ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                                    Start deposit
                                </button>
                            </div>
                            <div className="mt-1.5 text-xs text-dim">
                                {amountValid && coins > 0
                                    ? `You get ${formatCoinsCompact(coins)} coins. `
                                    : 'Type an amount like 250m or 2b. '}
                                Limit {gameShorthand(rate.min_game)}–{gameShorthand(rate.max_game)}.
                            </div>
                            </>
                            )}
                        </Step>

                        <Step n={3} title="Pay the bot that exact amount">
                            {!isVerified ? (
                                <p className="flex items-start gap-2 text-dim">
                                    <Lock className="mt-0.5 size-4 shrink-0" />
                                    The /pay command only appears after your Minecraft name is verified and you have
                                    started a deposit. Nothing can be sent to the bot before that.
                                </p>
                            ) : (
                                <p>
                                    In game run the command the deposit gives you. A different amount, or paying before you
                                    start a deposit, will not be credited automatically.
                                </p>
                            )}
                        </Step>

                        <Step n={4} title="Coins arrive automatically">
                            The bot reads the &quot;paid you&quot; receipt and credits you within a second or two — no
                            ticket, no screenshot.
                        </Step>
                    </ol>
                </div>

                <aside className="flex flex-col gap-4 self-start">
                    <div
                        id="link-card"
                        className={cn(
                            'scroll-mt-24 rounded-2xl bg-surface p-5 ring-1 transition-all duration-300',
                            highlightLink ? 'ring-2 ring-lime shadow-[0_0_0_4px_rgba(163,230,53,0.15)]' : 'ring-line/60',
                        )}
                    >
                        <div className="flex items-center gap-2 font-semibold">
                            <MessageSquareCode className="size-4 text-lime" /> Your in-game name
                        </div>

                        {!auth.user ? (
                            <div className="mt-2 text-sm text-dim">
                                <Link href="/login" className="text-lime hover:underline">
                                    Log in
                                </Link>{' '}
                                to link your IGN and receive in-game deposits.
                            </div>
                        ) : isVerified ? (
                            <div className="mt-3 flex items-center gap-2 rounded-xl bg-lime/10 px-3 py-2.5 text-sm">
                                <ShieldCheck className="size-4 text-lime" />
                                <span className="flex-1">
                                    Linked as <b className="font-mono">{currentIgn}</b>
                                </span>
                            </div>
                        ) : linkCode ? (
                            <div className="mt-3">
                                <p className="text-xs text-dim">Whisper this code to the bot in game:</p>
                                <button
                                    type="button"
                                    onClick={() => linkInstruction && void copy(linkInstruction, 'link')}
                                    className="mt-2 flex w-full items-center gap-2 rounded-xl bg-[#0b0d11] px-3 py-2.5 text-left font-mono text-sm ring-1 ring-line hover:ring-lime/50"
                                >
                                    <span className="flex-1 truncate text-lime">{linkInstruction}</span>
                                    {copied === 'link' ? <Check className="size-4 text-lime" /> : <Copy className="size-4 text-dim" />}
                                </button>
                                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-dim">
                                    <Loader2 className="size-3 animate-spin" /> Waiting for the bot to confirm…
                                </p>
                            </div>
                        ) : (
                            <div className="mt-3">
                                <p className="text-xs text-dim">
                                    We never ask for your Minecraft password. One whisper from inside the game proves the
                                    name is yours.
                                </p>
                                {claimed && (
                                    <p className="mt-2 text-xs text-white/75">
                                        You signed up as <b className="font-mono">{claimed}</b> — confirm that name with the
                                        code.
                                    </p>
                                )}
                                <button
                                    type="button"
                                    onClick={startLink}
                                    disabled={busy === 'link'}
                                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-lime py-2.5 text-sm font-bold text-lime-ink disabled:opacity-40"
                                >
                                    {busy === 'link' ? <Loader2 className="size-4 animate-spin" /> : <Keyboard className="size-4" />}
                                    Get my link code
                                </button>
                            </div>
                        )}

                        {notice && <p className="mt-2 text-xs text-lime/90">{notice}</p>}
                        {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
                    </div>

                    {pending.length > 0 && (
                        <div className="rounded-2xl bg-surface p-5 ring-1 ring-line/60">
                            <div className="font-semibold">Waiting for payment</div>
                            <ul className="mt-3 space-y-3">
                                {pending.map((request) => (
                                    <li key={request.id} className="rounded-xl bg-surface-2/60 p-3">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="flex items-center gap-1.5 text-dim">
                                                <Clock className="size-3.5" /> {remaining(request)}
                                            </span>
                                            <span className="flex items-center gap-1 font-bold tabular-nums">
                                                <CoinIcon className="size-3.5" /> {formatCoins(request.coins, 0)}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => void copy(command(request.game_amount), `req-${request.id}`)}
                                            className="mt-2 flex w-full items-center gap-2 rounded-lg bg-[#0b0d11] px-2.5 py-2 font-mono text-xs ring-1 ring-line hover:ring-lime/50"
                                        >
                                            <span className="flex-1 truncate text-left text-lime">
                                                {command(request.game_amount)}
                                            </span>
                                            {copied === `req-${request.id}` ? (
                                                <Check className="size-3.5 text-lime" />
                                            ) : (
                                                <Copy className="size-3.5 text-dim" />
                                            )}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            <p className="mt-3 text-[11px] text-dim">
                                Each receipt must match an open deposit exactly. Up to {rate.max_pending} can be open at
                                once, {rate.ttl_minutes} minutes each.
                            </p>
                        </div>
                    )}

                    <div className="rounded-2xl bg-surface p-5 ring-1 ring-line/60">
                        <div className="font-semibold">Recent in-game deposits</div>
                        {recent.length === 0 ? (
                            <p className="mt-2 text-xs text-dim">Nothing yet. Your first payment shows up here.</p>
                        ) : (
                            <ul className="mt-3 divide-y divide-line/60">
                                {recent.map((d) => (
                                    <li key={d.id} className="flex items-center gap-2 py-2.5 text-sm">
                                        <Send className="size-3.5 text-dim" />
                                        <span className="flex-1 truncate text-dim" suppressHydrationWarning>
                                            {new Date(d.at).toLocaleString()}
                                        </span>
                                        <span className="flex items-center gap-1 font-bold tabular-nums">
                                            <CoinIcon className="size-4" /> {formatCoins(d.coins, 0)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </aside>
            </div>
        </>
    );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
    return (
        <li className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-lime/15 text-xs font-extrabold text-lime">
                {n}
            </span>
            <div className="min-w-0">
                <div className="font-semibold text-white">{title}</div>
                <div className="mt-1 text-sm leading-relaxed text-dim">{children}</div>
            </div>
        </li>
    );
}

/** Laravel sets the XSRF-TOKEN cookie; fetch has to echo it back as a header. */
function readCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}
