import { Head, Link, router } from '@inertiajs/react';
import { ChevronLeft, Coins, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameIcon } from '@/components/casino/game-icon';
import { GameRail } from '@/components/casino/game-rail';
import { formatCoins, titleCase } from '@/lib/casino';
import { cn } from '@/lib/utils';
import type { Game, SlotSymbol, SlotWin } from '@/types';

type SpinResponse = {
    reels: string[][];
    wins: SlotWin[];
    total_win: number;
    scatter: number;
    scatter_win: number;
    balance: number;
};

type Props = {
    game: Game;
    bets: number[];
    balance: number;
    symbols: SlotSymbol[];
    related: Game[];
};

const COLS = 5;
const ROWS = 3;

function randomGrid(symbols: SlotSymbol[]): string[][] {
    const pick = () => symbols[Math.floor(Math.random() * symbols.length)].code;

    return Array.from({ length: COLS }, () => Array.from({ length: ROWS }, pick));
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function xsrfToken(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : '';
}

async function requestSpin(gameId: string, bet: number): Promise<SpinResponse> {
    const response = await fetch(`/play/${gameId}/spin`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-XSRF-TOKEN': xsrfToken(),
        },
        body: JSON.stringify({ bet }),
    });

    if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
            message?: string;
        };
        throw new Error(body.message ?? 'Spin failed. Please try again.');
    }

    return (await response.json()) as SpinResponse;
}

/** A built-in Donut Ace slot. Reels and wins come from the server; this only animates them. */
export default function Slot({
    game,
    bets,
    balance: initialBalance,
    symbols,
    related,
}: Props) {
    const meta = useMemo(
        () => new Map(symbols.map((s) => [s.code, s])),
        [symbols],
    );
    const [grid, setGrid] = useState<string[][]>(() => randomGrid(symbols));
    const [balance, setBalance] = useState(initialBalance);
    const [bet, setBet] = useState(bets[Math.min(2, bets.length - 1)]);
    const [spinning, setSpinning] = useState(false);
    const [wins, setWins] = useState<SlotWin[]>([]);
    const [totalWin, setTotalWin] = useState(0);
    const [message, setMessage] = useState<string | null>(null);
    const churn = useRef<number | null>(null);

    const stopChurn = useCallback(() => {
        if (churn.current !== null) {
            window.clearInterval(churn.current);
            churn.current = null;
        }
    }, []);

    useEffect(() => stopChurn, [stopChurn]);

    const winning = useMemo(
        () => new Set(wins.flatMap((w) => w.cells.map(([c, r]) => `${c}:${r}`))),
        [wins],
    );
    const betIndex = bets.indexOf(bet);
    const [bg1, bg2] = game.background ?? ['#242a36', '#10131a'];

    const spin = async () => {
        if (spinning) {
            return;
        }
        if (balance < bet) {
            setMessage('Not enough coins — top up to keep playing.');
            return;
        }

        setMessage(null);
        setWins([]);
        setTotalWin(0);
        setSpinning(true);
        churn.current = window.setInterval(
            () => setGrid(randomGrid(symbols)),
            70,
        );

        try {
            const [result] = await Promise.all([
                requestSpin(game.id, bet),
                wait(900),
            ]);

            stopChurn();
            setGrid(result.reels);
            setBalance(result.balance);
            setWins(result.wins);
            setTotalWin(result.total_win);
        } catch (error) {
            setMessage(
                error instanceof Error ? error.message : 'Spin failed.',
            );
        } finally {
            stopChurn();
            setSpinning(false);
        }
    };

    return (
        <>
            <Head title={game.name} />
            <div className="flex items-center gap-3 px-3 py-2 md:mb-3 md:px-0 md:py-0">
                <button
                    type="button"
                    onClick={() => router.get('/')}
                    className="flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-xs font-semibold text-white hover:bg-line"
                >
                    <ChevronLeft className="size-3.5" /> Lobby
                </button>
                <h1 className="truncate text-lg font-semibold">{game.name}</h1>
                <div className="ml-auto flex items-center gap-2">
                    <span className="flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1 text-xs font-bold ring-1 ring-line/60">
                        <Coins className="size-3.5 text-lime" />
                        {formatCoins(balance)}
                    </span>
                    <button
                        type="button"
                        onClick={() => router.get('/')}
                        className="flex size-8 items-center justify-center rounded-lg bg-surface-2 text-dim hover:text-white"
                        aria-label="Close game"
                    >
                        <X className="size-4" />
                    </button>
                </div>
            </div>

            <div
                className="relative overflow-hidden md:rounded-2xl md:ring-1 md:ring-line/60"
                style={{
                    background: `radial-gradient(120% 100% at 50% 0%, ${bg1}, ${bg2})`,
                }}
            >
                <div className="relative p-2.5 sm:p-4 md:p-5">
                    <div className="grid grid-cols-5 gap-1.5 md:gap-2.5">
                        {grid.map((column, ci) => (
                            <div
                                key={ci}
                                className="grid grid-rows-3 gap-1.5 md:gap-2.5"
                            >
                                {column.map((code, ri) => {
                                    const symbol = meta.get(code);
                                    const isWin = winning.has(`${ci}:${ri}`);

                                    return (
                                        <div
                                            key={ri}
                                            title={symbol?.name}
                                            className={cn(
                                                'flex aspect-square items-center justify-center rounded-lg bg-black/35 text-xl ring-1 ring-white/10 transition-all duration-150 sm:rounded-xl sm:text-3xl md:text-4xl',
                                                spinning &&
                                                    'opacity-70 blur-[1px]',
                                                isWin &&
                                                    'scale-105 bg-lime/20 ring-2 ring-lime shadow-[0_0_18px_rgba(201,247,58,0.45)]',
                                            )}
                                        >
                                            <span className="drop-shadow-md">
                                                <GameIcon
                                                    glyph={symbol?.emoji ?? '❔'}
                                                    size={44}
                                                />
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>

                    {totalWin > 0 && !spinning && (
                        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
                            <div className="animate-pulse rounded-full bg-lime px-4 py-1.5 text-sm font-extrabold text-lime-ink shadow-lg">
                                WIN {formatCoins(totalWin)}{' '}
                                {totalWin >= bet * 10 ? '🎉' : ''}
                            </div>
                        </div>
                    )}
                </div>

                <div className="border-t border-white/10 bg-black/35 p-2.5 md:p-3">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 rounded-xl bg-black/40 p-1 ring-1 ring-white/10">
                            <button
                                type="button"
                                onClick={() =>
                                    setBet(bets[Math.max(0, betIndex - 1)])
                                }
                                disabled={spinning || betIndex <= 0}
                                className="flex size-8 items-center justify-center rounded-lg bg-surface-2 text-lg leading-none font-bold text-white disabled:opacity-40"
                                aria-label="Lower bet"
                            >
                                −
                            </button>
                            <div className="min-w-[72px] text-center leading-tight">
                                <div className="text-[9px] font-semibold tracking-wide text-dim uppercase">
                                    Bet
                                </div>
                                <div className="text-sm font-bold tabular-nums">
                                    {formatCoins(bet, 0)}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() =>
                                    setBet(
                                        bets[
                                            Math.min(
                                                bets.length - 1,
                                                betIndex + 1,
                                            )
                                        ],
                                    )
                                }
                                disabled={
                                    spinning || betIndex >= bets.length - 1
                                }
                                className="flex size-8 items-center justify-center rounded-lg bg-surface-2 text-lg leading-none font-bold text-white disabled:opacity-40"
                                aria-label="Raise bet"
                            >
                                +
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={spin}
                            disabled={spinning}
                            className="flex-1 rounded-xl bg-lime py-3 text-sm font-extrabold tracking-wide text-lime-ink uppercase transition active:scale-[0.99] disabled:opacity-60"
                        >
                            {spinning
                                ? 'Spinning…'
                                : `Spin · ${formatCoins(bet, 0)}`}
                        </button>
                    </div>

                    {message && (
                        <p className="mt-2 text-center text-xs font-semibold text-amber-300">
                            {message}
                        </p>
                    )}
                    {totalWin > 0 && wins.length > 0 && (
                        <p className="mt-2 text-center text-xs text-dim">
                            {wins
                                .map(
                                    (w) =>
                                        `${w.line === 0 ? 'Scatter' : `Line ${w.line}`} ×${w.mult / 100}`,
                                )
                                .join(' · ')}
                        </p>
                    )}
                </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 px-3 text-xs md:px-0">
                {[
                    ['Mechanic', titleCase(game.mechanic)],
                    ['RTP', game.rtp],
                    ['Volatility', titleCase(game.volatility)],
                    [
                        'Max win',
                        game.max_win_x
                            ? `x${game.max_win_x.toLocaleString('en-US')}`
                            : '—',
                    ],
                    ['Lines', '10'],
                ].map(([label, value]) => (
                    <span
                        key={label}
                        className="rounded-lg bg-surface px-2.5 py-1 ring-1 ring-line/60"
                    >
                        <span className="text-dim">{label}:</span>{' '}
                        <span className="font-semibold text-white">
                            {value}
                        </span>
                    </span>
                ))}
                <Link
                    href="/legal/faq"
                    className="ml-auto text-dim underline-offset-2 hover:text-white hover:underline"
                >
                    Coins have no cash value
                </Link>
            </div>

            <div className="px-3 pb-6 md:px-0 md:pb-0">
                <GameRail
                    title="More built-in games"
                    icon={Sparkles}
                    games={related}
                />
            </div>
        </>
    );
}
