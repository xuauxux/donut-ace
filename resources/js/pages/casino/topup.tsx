import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowDownToLine, Check, Coins, Copy, Sparkles, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CoinIcon } from '@/components/casino/art';
import { IconBadge } from '@/components/casino/icon-badge';
import { PageTitle } from '@/components/casino/page-title';
import { formatCoins, formatCoinsCompact } from '@/lib/casino';
import { cn } from '@/lib/utils';

type Tier = { id: string; name: string; game_amount: number; coins: number };

type Deposit = { id: number; coins: number; game_amount: number; status: string; at: string };

type Rate = { coins_per_million: number; min_game: number; max_game: number };

const TONES = ['amber', 'sky', 'lime', 'violet', 'rose', 'amber'] as const;

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

export default function Topup({
    tiers,
    rate,
    botIgn,
    recent,
}: {
    tiers: Tier[];
    rate: Rate;
    botIgn: string | null;
    recent: Deposit[];
}) {
    const { auth, wallet } = usePage().props;
    const [custom, setCustom] = useState('');
    const [copied, setCopied] = useState<string | null>(null);

    const coinsFor = (game: number) => Math.floor((game * rate.coins_per_million * 100) / 1_000_000);

    const customGame = useMemo(() => parseGameAmount(custom), [custom]);
    const customValid =
        customGame !== null && customGame >= rate.min_game && customGame <= rate.max_game;

    const copy = async (value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(value);
            setTimeout(() => setCopied(null), 1600);
        } catch {
            setCopied(null);
        }
    };

    return (
        <>
            <Head title="Deposit coins" />
            <PageTitle icon={Coins} title="Deposit coins" />

            <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#161c28] via-[#1b3b78] to-[#2f86ff] p-6 ring-1 ring-line/60 md:p-8">
                <div className="bg-suits absolute inset-0 opacity-70" />
                <IconBadge icon={Coins} tone="amber" className="absolute top-1/2 right-10 hidden size-36 -translate-y-1/2 rotate-6 rounded-[40px] md:flex" iconClassName="size-18" />
                <div className="relative max-w-xl">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold backdrop-blur">
                        <Sparkles className="size-3.5 text-lime" /> Deposit with in-game money
                    </span>
                    <h2 className="mt-4 text-3xl leading-[1.05] font-extrabold tracking-tight md:text-[40px]">
                        Send coins in game,
                        <br /> keep the <span className="text-lime">fun</span> going
                    </h2>
                    <p className="mt-3 text-sm text-white/80">
                        No cards, no real money. You pay the deposit bot in Minecraft and the coins appear here
                        automatically — {(rate.coins_per_million / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 4 })}{' '}
                        {rate.coins_per_million === 1_000_000 ? 'coin' : 'coins'} per $1 in game.
                    </p>
                    {wallet && (
                        <p className="mt-2 flex items-center gap-2 text-sm text-white/80">
                            Current balance: <CoinIcon className="size-4" /> <b className="text-white tabular-nums">{formatCoins(wallet.balance)}</b>
                        </p>
                    )}
                </div>
            </section>

            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
                {tiers.map((tier, i) => (
                    <Link
                        key={tier.id}
                        href={`/deposit?amount=${gameShorthand(tier.game_amount)}`}
                        className="group relative flex flex-col items-center overflow-hidden rounded-2xl bg-surface p-3 pt-4 text-center ring-1 ring-line/60 transition hover:-translate-y-0.5 hover:ring-lime sm:p-4 sm:pt-5"
                    >
                        <IconBadge icon={i > 2 ? Zap : Coins} tone={TONES[i % TONES.length]} className="mt-1 size-12 rounded-2xl sm:size-14" iconClassName="size-6 sm:size-7" />
                        <div className="mt-3 text-xs font-semibold text-dim uppercase">{tier.name}</div>
                        <div className="mt-1 flex items-baseline gap-1 text-xl font-extrabold tabular-nums sm:text-2xl">
                            <span className="text-lime">{gameShorthand(tier.game_amount)}</span>
                            <span className="text-xs font-semibold text-dim">in game</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-sm text-white/80">
                            <CoinIcon className="size-4" /> {formatCoinsCompact(tier.coins)} coins
                        </div>
                        <div className="mt-3 w-full rounded-xl bg-surface-2 py-2 text-sm font-bold text-white transition group-hover:bg-lime group-hover:text-lime-ink">
                            Deposit {gameShorthand(tier.game_amount)}
                        </div>
                    </Link>
                ))}
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_360px]">
                <div className="rounded-2xl bg-surface p-5 ring-1 ring-line/60">
                    <div className="font-semibold">Any amount</div>
                    <div className="text-xs text-dim">
                        From {gameShorthand(rate.min_game)} to {gameShorthand(rate.max_game)} in game money.
                    </div>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <label className="flex h-12 flex-1 items-center gap-2 rounded-xl border border-line bg-surface-2/70 px-4 font-mono focus-within:border-lime/70 focus-within:ring-4 focus-within:ring-lime/15">
                            <span className="text-sm text-dim">$</span>
                            <input
                                value={custom}
                                onChange={(e) => setCustom(e.target.value.replace(/[^0-9.,kmbKMB]/g, ''))}
                                placeholder="250m"
                                className="w-full bg-transparent text-lg font-bold text-white outline-none placeholder:text-dim/60"
                                aria-label="Amount in game money"
                            />
                        </label>
                        {customValid ? (
                            <Link
                                href={`/deposit?amount=${gameShorthand(customGame)}`}
                                className="flex items-center justify-center gap-2 rounded-xl bg-lime px-5 py-3 text-sm font-bold whitespace-nowrap text-lime-ink"
                            >
                                Deposit {gameShorthand(customGame)} · {formatCoinsCompact(coinsFor(customGame))} coins
                            </Link>
                        ) : (
                            <span className="rounded-xl bg-surface-2 px-5 py-3 text-sm font-semibold text-dim">
                                {custom === '' ? 'Enter an amount' : 'Out of range'}
                            </span>
                        )}
                    </div>
                </div>

                <div className="rounded-2xl bg-surface p-5 ring-1 ring-line/60">
                    <div className="font-semibold">How to pay</div>
                    {botIgn ? (
                        <button
                            type="button"
                            onClick={() => void copy(`/pay ${botIgn} ${customValid ? gameShorthand(customGame) : '10m'}`)}
                            className="mt-3 flex w-full items-center gap-2 rounded-xl bg-[#0b0d11] px-3 py-2.5 font-mono text-sm ring-1 ring-line hover:ring-lime/50"
                        >
                            <span className="flex-1 truncate text-left text-lime">
                                /pay {botIgn} {customValid ? gameShorthand(customGame) : '10m'}
                            </span>
                            {copied ? <Check className="size-4 text-lime" /> : <Copy className="size-4 text-dim" />}
                        </button>
                    ) : (
                        <p className="mt-3 text-xs text-dim">The deposit bot is not connected yet — open the deposit page for details.</p>
                    )}
                    <Link href="/deposit" className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-lime py-3 text-sm font-bold text-lime-ink">
                        <ArrowDownToLine className="size-4" /> Open deposit page
                    </Link>
                    <p className="mt-3 text-[11px] leading-relaxed text-dim">
                        You must verify your IGN before the first deposit. Coins are a virtual currency for entertainment
                        only, with no cash value.
                    </p>
                </div>
            </div>

            {recent.length > 0 && (
                <section className="mt-8">
                    <div className="mb-3 text-sm font-semibold">Recent deposits</div>
                    <div className="divide-y divide-line/60 overflow-hidden rounded-2xl ring-1 ring-line/60">
                        {recent.map((d) => (
                            <div key={d.id} className="flex items-center gap-3 bg-surface-2/40 px-4 py-3 text-sm">
                                <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase', d.status === 'credited' ? 'bg-lime/15 text-lime' : 'bg-white/10 text-dim')}>
                                    {d.status}
                                </span>
                                <span className="flex-1 text-dim" suppressHydrationWarning>
                                    {new Date(d.at).toLocaleString()}
                                </span>
                                <span className="text-right tabular-nums">
                                    <span className="block font-bold">{formatCoins(d.coins, 0)} coins</span>
                                    <span className="text-xs text-dim">{gameShorthand(d.game_amount)} in game</span>
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </>
    );
}
