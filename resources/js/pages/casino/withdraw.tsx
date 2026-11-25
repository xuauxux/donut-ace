import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowUpFromLine,
    Check,
    Clock,
    Loader2,
    Lock,
    Radio,
    Send,
    ShieldCheck,
    TriangleAlert,
    Wallet,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CoinIcon } from '@/components/casino/art';
import { PageTitle } from '@/components/casino/page-title';
import { formatCoins, formatCoinsCompact } from '@/lib/casino';
import { cn } from '@/lib/utils';

type Withdrawal = {
    id: number;
    game_amount: number;
    coins: number;
    status: 'pending' | 'sending' | 'paid' | 'failed' | 'unconfirmed';
    reason: string | null;
    at: string | null;
    completed_at: string | null;
};

type Props = {
    enabled: boolean;
    botIgn: string | null;
    ign: string | null;
    verified: boolean;
    online: boolean;
    balance: number;
    available: number;
    rate: { coins_per_million: number; min_game: number; max_game: number; tax_bps: number };
    limits: { daily_game: number; max_pending: number; ttl_minutes: number };
    pending: Withdrawal[];
    recent: Withdrawal[];
};

function gameShorthand(value: number): string {
    const trim = (n: number) => String(Number(n.toFixed(2)));
    if (value >= 1_000_000_000) return `${trim(value / 1_000_000_000)}b`;
    if (value >= 1_000_000) return `${trim(value / 1_000_000)}m`;
    if (value >= 1_000) return `${trim(value / 1_000)}k`;
    return String(value);
}

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
    disabled: 'Withdrawals are switched off right now.',
    not_linked: 'Link your Minecraft name before you can withdraw.',
    amount_out_of_range: 'That amount is outside the accepted range.',
    amount_too_small: 'That is worth less than one coin.',
    insufficient_balance: 'You do not have enough coins for that payout.',
    too_many_pending: 'You already have a withdrawal in the queue.',
    daily_limit: 'That would go over your daily withdrawal limit.',
    float_low: 'The bot does not hold enough in-game money for that payout right now.',
    busy: 'Another withdrawal is being checked. Try again in a moment.',
    not_pending: 'That request is already being paid or has finished.',
    not_found: 'That request no longer exists.',
};

const STATUS: Record<Withdrawal['status'], { label: string; tone: string; text: string }> = {
    pending: { label: 'Queued', tone: 'bg-amber-400/15 text-amber-300', text: 'text-amber-300' },
    sending: { label: 'Paying', tone: 'bg-sky/15 text-sky', text: 'text-sky' },
    paid: { label: 'Paid', tone: 'bg-lime/15 text-lime', text: 'text-lime' },
    failed: { label: 'Refunded', tone: 'bg-white/10 text-dim', text: 'text-dim' },
    unconfirmed: { label: 'Needs review', tone: 'bg-rose-400/15 text-rose-300', text: 'text-rose-300' },
};

export default function Withdraw({
    enabled,
    botIgn,
    ign,
    verified: initialVerified,
    online,
    balance: initialBalance,
    available: initialAvailable,
    rate,
    limits,
    pending: initialPending,
    recent: initialRecent,
}: Props) {
    const { auth } = usePage().props;

    const initialGame = useMemo(() => {
        if (initialAvailable >= 1_000_000) return 1_000_000;
        return Math.max(rate.min_game, Math.min(initialAvailable, rate.max_game));
    }, [initialAvailable, rate.min_game, rate.max_game]);

    const [verified, setVerified] = useState(initialVerified);
    const [currentIgn, setCurrentIgn] = useState<string | null>(ign);
    const [balance, setBalance] = useState(initialBalance);
    const [available, setAvailable] = useState(initialAvailable);
    const [amountText, setAmountText] = useState(gameShorthand(initialGame));
    const [pending, setPending] = useState<Withdrawal[]>(initialPending);
    const [recent, setRecent] = useState<Withdrawal[]>(initialRecent);
    const [busy, setBusy] = useState<'create' | 'cancel' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const gameAmount = useMemo(() => parseGameAmount(amountText), [amountText]);
    const coins = gameAmount === null ? 0 : Math.floor((gameAmount * rate.coins_per_million * 100) / 1_000_000);
    // Guests see the configured ceiling; unverified users see nothing until
    // they link, so the limit does not promise a payout they cannot request.
    const maxGames = auth.user ? (verified ? Math.min(available, rate.max_game) : 0) : rate.max_game;
    const amountValid =
        gameAmount !== null &&
        gameAmount >= rate.min_game &&
        gameAmount <= maxGames &&
        coins >= 1 &&
        coins <= balance;
    const hasPending = pending.length > 0;

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

    const known = useRef(new Map(initialRecent.map((w) => [w.id, w.status])));

    /** Status changes are the point where the wallet or a refund may have moved. */
    const applyLists = useCallback((nextPending: Withdrawal[], nextRecent: Withdrawal[]) => {
        let changed = false;

        for (const withdrawal of nextRecent) {
            const before = known.current.get(withdrawal.id);

            if (before !== undefined && before !== withdrawal.status) changed = true;
            known.current.set(withdrawal.id, withdrawal.status);
        }

        setPending(nextPending);
        setRecent(nextRecent);

        if (changed) router.reload({ only: ['wallet'] });
    }, []);

    const refresh = useCallback(async () => {
        const res = await fetch('/withdraw/status', { headers: { Accept: 'application/json' } });
        if (!res.ok) return;

        const json = (await res.json()) as {
            verified?: boolean;
            ign?: string | null;
            balance?: number;
            available?: number;
            pending?: Withdrawal[];
            recent?: Withdrawal[];
        };

        if (typeof json.verified === 'boolean') setVerified(json.verified);
        if (typeof json.ign === 'string') setCurrentIgn(json.ign);
        if (typeof json.balance === 'number') setBalance(json.balance);
        if (typeof json.available === 'number') setAvailable(json.available);

        if (Array.isArray(json.pending) && Array.isArray(json.recent)) {
            applyLists(json.pending, json.recent);
        }
    }, [applyLists]);

    useEffect(() => {
        if (!hasPending) return;

        const timer = setInterval(() => void refresh(), 5000);
        return () => clearInterval(timer);
    }, [hasPending, refresh]);

    const createRequest = async () => {
        if (!amountValid || gameAmount === null) return;
        setBusy('create');
        setError(null);
        setNotice(null);

        const { ok, json } = await post('/withdraw/create', { amount: gameAmount });

        if (ok && json.withdrawal && typeof json.withdrawal === 'object') {
            const withdrawal = json.withdrawal as Withdrawal;
            setPending((prev) => [...prev, withdrawal]);
            setRecent((prev) => [withdrawal, ...prev]);
            known.current.set(withdrawal.id, withdrawal.status);
            setNotice(
                `Queued. The bot will send $${gameShorthand(withdrawal.game_amount)} to ${currentIgn ?? 'your in-game name'}.`,
            );
            setAmountText(gameShorthand(initialGame));
            router.reload({ only: ['wallet'] });
            void refresh();
        } else {
            setError(ERRORS[String(json.error ?? '')] ?? 'Could not queue that withdrawal.');
        }

        setBusy(null);
    };

    const cancelRequest = async (withdrawal: Withdrawal) => {
        setBusy('cancel');
        setError(null);
        setNotice(null);

        const { ok, json } = await post('/withdraw/cancel', { id: withdrawal.id });

        if (ok) {
            setNotice('Withdrawal cancelled — coins returned to your balance.');
            router.reload({ only: ['wallet'] });
            void refresh();
        } else {
            setError(ERRORS[String(json.error ?? '')] ?? 'Could not cancel that request.');
        }

        setBusy(null);
    };

    return (
        <>
            <Head title="Withdraw in game" />
            <PageTitle icon={ArrowUpFromLine} title="Withdraw in game" />

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
                            {online ? 'Bot online' : 'Bot offline — payouts queue'}
                        </span>
                        <span className="text-xs text-dim">
                            1 coin = ${rate.coins_per_million / 1_000_000 === 1 ? '1' : (1_000_000 / rate.coins_per_million).toFixed(2)} in game
                        </span>
                    </div>

                    {!enabled && (
                        <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-400/10 p-3 text-sm text-amber-200">
                            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                            Withdrawals are switched off right now.
                        </p>
                    )}

                    {auth.user && !verified && (
                        <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-400/10 p-3 text-sm text-amber-200">
                            <Lock className="mt-0.5 size-4 shrink-0" />
                            <div>
                                <p>Withdrawals are locked until your Minecraft name is verified.</p>
                                <Link href="/deposit#link-card" className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-lime px-3 py-1.5 text-xs font-bold text-lime-ink">
                                    <ShieldCheck className="size-3.5" /> Verify my name
                                </Link>
                            </div>
                        </div>
                    )}

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl bg-surface-2/60 p-3.5">
                            <div className="text-xs text-dim">Your balance</div>
                            <div className="mt-1 flex items-center gap-1.5 text-lg font-bold tabular-nums">
                                <CoinIcon className="size-5" /> {formatCoins(balance)}
                            </div>
                        </div>
                        <div className="rounded-xl bg-surface-2/60 p-3.5">
                            <div className="text-xs text-dim">Available to withdraw</div>
                            <div className="mt-1 text-lg font-bold tabular-nums text-lime">
                                {auth.user && verified ? `$${maxGames.toLocaleString('en-US')}` : '—'}
                            </div>
                        </div>
                    </div>

                    <div className="mt-5">
                        <label className="text-sm font-semibold text-white">Amount to receive in game</label>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                            <label className="flex h-11 flex-1 items-center gap-2 rounded-xl bg-surface-2 px-3 font-mono ring-1 ring-line focus-within:ring-lime/50">
                                <span className="text-sm text-dim">$</span>
                                <input
                                    value={amountText}
                                    onChange={(e) => setAmountText(e.target.value.replace(/[^0-9.,kmbKMB]/g, ''))}
                                    disabled={!verified || !enabled || hasPending}
                                    placeholder="1m"
                                    className="w-full bg-transparent font-bold text-white outline-none placeholder:text-dim/60 disabled:opacity-50"
                                    aria-label="Amount to receive in game"
                                />
                            </label>
                            <button
                                type="button"
                                onClick={createRequest}
                                disabled={!verified || !enabled || !amountValid || busy !== null || hasPending || !auth.user}
                                className="flex items-center justify-center gap-1.5 rounded-xl bg-lime px-4 py-2.5 text-sm font-bold whitespace-nowrap text-lime-ink disabled:opacity-40"
                            >
                                {busy === 'create' ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                                Request payout
                            </button>
                        </div>
                        <div className="mt-1.5 text-xs text-dim">
                            {gameAmount !== null && coins > 0
                                ? `Costs ${formatCoins(coins)} coins. `
                                : 'Type an amount like 1m or 250m. '}
                            {auth.user && !verified
                                ? 'Verify your Minecraft name to unlock withdrawals.'
                                : maxGames < rate.min_game
                                  ? 'No payouts available right now — the bot needs in-game funds.'
                                  : `Limit ${gameShorthand(rate.min_game)}–${gameShorthand(maxGames)}. Daily cap ${gameShorthand(limits.daily_game)}.`}
                        </div>
                        {auth.user && verified && available < rate.min_game && (
                            <p className="mt-2 text-xs text-amber-200/90">
                                The bot has ${available.toLocaleString('en-US')} available to pay. Deposits fund withdrawals, so
                                this fills up as players deposit.
                            </p>
                        )}
                        {hasPending && (
                            <p className="mt-2 text-xs text-amber-200/90">
                                You already have a payout in the queue. Wait for it to finish or cancel it below.
                            </p>
                        )}
                        {notice && <p className="mt-2 text-xs text-lime/90">{notice}</p>}
                        {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
                    </div>

                    <ol className="mt-6 space-y-4 border-t border-line/60 pt-5 text-sm text-dim">
                        <Step n={1} title="Coins leave your balance immediately">
                            That reserves the payout and stops the same coins being spent twice.
                        </Step>
                        <Step n={2} title="The bot sends one /pay in game">
                            Payouts are paid in the order they were requested. The bot pays only your verified name.
                        </Step>
                        <Step n={3} title="Failed payouts are refunded">
                            If the bot cannot pay, the coins come back automatically. An unclear receipt is held for
                            review instead of being retried, so you are never paid twice.
                        </Step>
                    </ol>
                </div>

                <aside className="flex flex-col gap-4 self-start">
                    <div className="rounded-2xl bg-surface p-5 ring-1 ring-line/60">
                        <div className="flex items-center gap-2 font-semibold">
                            <Wallet className="size-4 text-lime" /> Payout account
                        </div>

                        {!auth.user ? (
                            <div className="mt-2 text-sm text-dim">
                                <Link href="/login" className="text-lime hover:underline">Log in</Link> to request an
                                in-game payout.
                            </div>
                        ) : verified ? (
                            <div className="mt-3 flex items-center gap-2 rounded-xl bg-lime/10 px-3 py-2.5 text-sm">
                                <ShieldCheck className="size-4 text-lime" />
                                <span className="flex-1">
                                    Pays <b className="font-mono">{currentIgn}</b>
                                </span>
                            </div>
                        ) : (
                            <p className="mt-2 text-xs text-dim">
                                Verify your name on the deposit page first. Payouts are sent only to a name proven
                                with a whisper code.
                            </p>
                        )}

                        {botIgn && (
                            <p className="mt-3 text-[11px] text-dim">
                                Payments come from <b className="font-mono text-white/80">{botIgn}</b>.
                            </p>
                        )}
                    </div>

                    {pending.length > 0 && (
                        <div className="rounded-2xl bg-surface p-5 ring-1 ring-line/60">
                            <div className="font-semibold">In the queue</div>
                            <ul className="mt-3 space-y-3">
                                {pending.map((withdrawal) => (
                                    <li key={withdrawal.id} className="rounded-xl bg-surface-2/60 p-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold uppercase', STATUS[withdrawal.status].tone)}>
                                                {STATUS[withdrawal.status].label}
                                            </span>
                                            <span className="text-sm font-bold tabular-nums">
                                                ${withdrawal.game_amount.toLocaleString('en-US')}
                                            </span>
                                        </div>
                                        <div className="mt-1.5 flex items-center justify-between text-[11px] text-dim">
                                            <span className="flex items-center gap-1">
                                                <Clock className="size-3" /> {withdrawal.at ? new Date(withdrawal.at).toLocaleTimeString() : '—'}
                                            </span>
                                            <span>{formatCoins(withdrawal.coins)} coins</span>
                                        </div>
                                        {withdrawal.status === 'pending' && (
                                            <button
                                                type="button"
                                                onClick={() => void cancelRequest(withdrawal)}
                                                disabled={busy !== null}
                                                className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-white/5 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10 disabled:opacity-40"
                                            >
                                                {busy === 'cancel' ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
                                                Cancel and refund
                                            </button>
                                        )}
                                        {withdrawal.status === 'sending' && (
                                            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-sky">
                                                <Loader2 className="size-3 animate-spin" /> The bot is paying this now.
                                            </p>
                                        )}
                                        {withdrawal.status === 'unconfirmed' && (
                                            <p className="mt-2 text-[11px] text-rose-300">
                                                The receipt was unclear. Coins stay reserved while this is checked.
                                            </p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                            <p className="mt-3 text-[11px] text-dim">
                                Unclaimed requests are refunded after {limits.ttl_minutes} minutes.
                            </p>
                        </div>
                    )}

                    <div className="rounded-2xl bg-surface p-5 ring-1 ring-line/60">
                        <div className="font-semibold">Recent withdrawals</div>
                        {recent.length === 0 ? (
                            <p className="mt-2 text-xs text-dim">Nothing yet. Your first payout shows up here.</p>
                        ) : (
                            <ul className="mt-3 divide-y divide-line/60">
                                {recent.map((withdrawal) => (
                                    <li key={withdrawal.id} className="flex items-center gap-2 py-2.5 text-sm">
                                        <ArrowUpFromLine className="size-3.5 text-dim" />
                                        <span className="flex-1 truncate text-dim" suppressHydrationWarning>
                                            {withdrawal.at ? new Date(withdrawal.at).toLocaleString() : '—'}
                                        </span>
                                        <span className="text-right">
                                            <span className="block font-bold tabular-nums">
                                                ${withdrawal.game_amount.toLocaleString('en-US')}
                                            </span>
                                            <span className={cn('block text-[10px] font-semibold', STATUS[withdrawal.status].text)}>
                                                {STATUS[withdrawal.status].label}
                                            </span>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="rounded-2xl bg-surface p-5 text-xs leading-relaxed text-dim ring-1 ring-line/60">
                        <div className="flex items-center gap-2 font-semibold text-white">
                            <Check className="size-4 text-lime" /> No cash payouts
                        </div>
                        <p className="mt-2">
                            This converts site coins into in-game DonutSMP money. It is not a cash withdrawal and has no
                            real-world value. The rate matches deposits, so {formatCoinsCompact(rate.coins_per_million * 100)}{' '}
                            coins per $1,000,000 in game.
                        </p>
                        {rate.tax_bps > 0 && (
                            <p className="mt-2">
                                DonutSMP adds a {(rate.tax_bps / 100).toFixed(2).replace(/\.?0+$/, '')}% tax to every /pay.
                                The house covers it; the available amount above already leaves room for it.
                            </p>
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

function readCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}
