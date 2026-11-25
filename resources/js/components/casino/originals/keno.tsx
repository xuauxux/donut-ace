import { Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { OriginalShell } from '@/components/casino/originals/original-shell';
import { useOriginalPlay } from '@/hooks/use-original-play';
import { formatCoins } from '@/lib/casino';
import { wait } from '@/lib/http';
import { cn } from '@/lib/utils';
import type { Game, OriginalConfig } from '@/types';

type Props = {
    game: Game;
    bets: number[];
    balance: number;
    config: OriginalConfig;
    related: Game[];
};

export function Keno({ game, bets, balance, config, related }: Props) {
    const { balance: coins, bet, setBet, playing, message, play } =
        useOriginalPlay('keno', bets, balance);
    const pickMax = config.pick_max ?? 10;
    const maxNumber = config.max_number ?? 40;
    const [picks, setPicks] = useState<number[]>([]);
    const [drawn, setDrawn] = useState<number[]>([]);
    const [hits, setHits] = useState<number | null>(null);
    const [won, setWon] = useState<number | null>(null);

    const numbers = useMemo(
        () => Array.from({ length: maxNumber }, (_, i) => i + 1),
        [maxNumber],
    );
    const paytable = config.paytable?.[String(picks.length)] ?? [];

    const toggle = (n: number) => {
        if (playing) {
            return;
        }
        setPicks((current) =>
            current.includes(n)
                ? current.filter((x) => x !== n)
                : current.length >= pickMax
                  ? current
                  : [...current, n],
        );
    };

    const quickPick = () => {
        if (playing) {
            return;
        }
        const pool = [...numbers];
        const chosen: number[] = [];
        while (chosen.length < Math.max(3, picks.length || 5)) {
            chosen.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
        }
        setPicks(chosen.sort((a, b) => a - b));
    };

    const draw = () => {
        if (picks.length === 0) {
            return;
        }

        play({ picks }, async (result) => {
            const detail = result.detail as unknown as {
                draw: number[];
                hits: number;
            };

            setDrawn([]);
            setHits(null);
            setWon(null);

            for (let i = 0; i < detail.draw.length; i += 4) {
                setDrawn(detail.draw.slice(0, i + 4));
                await wait(90);
            }

            setDrawn(detail.draw);
            setHits(detail.hits);
            setWon(result.total_win);
        });
    };

    return (
        <OriginalShell
            game={game}
            balance={coins}
            bets={bets}
            bet={bet}
            onBet={setBet}
            playing={playing}
            onPlay={draw}
            playLabel={
                picks.length === 0
                    ? 'Pick your numbers'
                    : `Draw · ${formatCoins(bet, 0)}`
            }
            message={message}
            related={related}
            controls={
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-dim">
                        <span>
                            Picked{' '}
                            <b className="text-white">
                                {picks.length}/{pickMax}
                            </b>
                        </span>
                        <div className="flex gap-1.5">
                            <button
                                type="button"
                                onClick={quickPick}
                                className="rounded-lg bg-black/40 px-2.5 py-1 text-[11px] font-bold text-white ring-1 ring-white/10"
                            >
                                Random
                            </button>
                            <button
                                type="button"
                                onClick={() => setPicks([])}
                                className="rounded-lg bg-black/40 px-2.5 py-1 text-[11px] font-bold text-white ring-1 ring-white/10"
                            >
                                Clear
                            </button>
                        </div>
                    </div>

                    {paytable.length > 1 && (
                        <div className="flex flex-wrap gap-1">
                            {paytable.map((mult, hitCount) =>
                                mult > 0 ? (
                                    <span
                                        key={hitCount}
                                        className="rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] text-dim ring-1 ring-white/10"
                                    >
                                        {hitCount}/{picks.length}{' '}
                                        <b className="text-white">
                                            {mult.toFixed(2)}x
                                        </b>
                                    </span>
                                ) : null,
                            )}
                        </div>
                    )}
                </div>
            }
        >
            <div className="mx-auto grid w-full max-w-[560px] grid-cols-8 gap-2">
                {numbers.map((n) => {
                    const picked = picks.includes(n);
                    const isDrawn = drawn.includes(n);

                    return (
                        <button
                            key={n}
                            type="button"
                            onClick={() => toggle(n)}
                            aria-pressed={picked}
                            aria-label={picked ? `Deselect ${n}` : `Select ${n}`}
                            className={cn(
                                'flex aspect-square items-center justify-center rounded-xl text-sm font-bold tabular-nums transition-all duration-150',
                                'bg-white/[0.055] text-white/85 ring-1 ring-white/10',
                                'shadow-[inset_0_1px_0_rgba(255,255,255,0.10),inset_0_-8px_14px_rgba(0,0,0,0.3)]',
                                'hover:-translate-y-0.5 hover:ring-white/30',
                                // A picked tile turns lime and swaps its number for a check.
                                picked &&
                                    'bg-gradient-to-br from-lime-300 to-lime-500 text-lime-ink ring-0 shadow-[0_8px_22px_-8px_rgba(190,242,100,0.8)]',
                                isDrawn &&
                                    !picked &&
                                    'bg-gradient-to-br from-white/40 to-white/20 text-white ring-white/60',
                                isDrawn &&
                                    picked &&
                                    'ring-2 ring-white shadow-[0_0_18px_rgba(255,255,255,0.65)]',
                            )}
                        >
                            {picked && isDrawn ? (
                                <Check className="size-4" strokeWidth={3.5} />
                            ) : (
                                n
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-dim">
                <span>
                    {drawn.length > 0
                        ? `Drawn ${drawn.length}/${config.draw ?? 20}`
                        : 'Pick up to 10 numbers, then draw'}
                </span>
                {hits !== null && (
                    <span className="font-bold text-white">
                        {hits} hit{hits === 1 ? '' : 's'}
                    </span>
                )}
            </div>

            {won !== null && (
                <div
                    className={cn(
                        'mt-3 rounded-xl px-4 py-2 text-center text-sm font-bold',
                        won > 0
                            ? 'bg-lime/15 text-lime'
                            : 'bg-black/30 text-dim',
                    )}
                >
                    {won > 0
                        ? `+${formatCoins(won)} coins · ${(won / bet).toFixed(2)}x`
                        : 'No win — try again'}
                </div>
            )}
        </OriginalShell>
    );
}
