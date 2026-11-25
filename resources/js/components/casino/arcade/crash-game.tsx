import { useState } from 'react';
import { CrashChart } from '@/components/casino/arcade/crash-chart';
import { OriginalShell } from '@/components/casino/originals/original-shell';
import { useOriginalPlay } from '@/hooks/use-original-play';
import { formatCoins } from '@/lib/casino';
import { wait } from '@/lib/http';
import { cn } from '@/lib/utils';
import type { ArcadeConfig, Game } from '@/types';

type Props = {
    game: Game;
    bets: number[];
    balance: number;
    config: ArcadeConfig;
    related: Game[];
};

const PRESETS = [1.5, 2, 5, 10, 50];
const GROWTH = 0.22;
/** Never make the player sit through a long climb. */
const MAX_CLIMB_MS = 4500;

/** Crash with an auto-cashout target and the reference's canvas graph. */
export function CrashGame({ game, bets, balance, config, related }: Props) {
    const { balance: coins, bet, setBet, playing, message, play } =
        useOriginalPlay(game.id, bets, balance, '/arcade');

    const accent = game.accent ?? '#f472b6';
    const max = Math.min(1000, config.max_multiplier ?? 100);

    const [target, setTarget] = useState(2);
    const [crash, setCrash] = useState<number | null>(null);
    const [payout, setPayout] = useState<number | null>(null);
    const [phase, setPhase] = useState<'idle' | 'run' | 'settled'>('idle');
    const [history, setHistory] = useState<number[]>([]);

    const won = (payout ?? 0) > 0;

    const run = () =>
        play({ multiplier: target }, async (result) => {
            const detail = result.detail as { crash?: number };
            const point = detail.crash ?? 1;
            const settleAt = Math.min(point, target);

            setCrash(point);
            setPayout(result.total_win);
            setHistory((prev) => [point, ...prev].slice(0, 6));
            setPhase('run');

            // Let the curve climb to the cash-out (or the crash) before settling.
            const climb = Math.min(
                MAX_CLIMB_MS,
                (Math.log(Math.max(1.001, settleAt)) / GROWTH) * 1000,
            );
            await wait(climb + 350);

            setPhase('settled');
        });

    const reset = () => {
        setCrash(null);
        setPayout(null);
        setPhase('idle');
    };

    return (
        <OriginalShell
            game={game}
            balance={coins}
            bets={bets}
            bet={bet}
            onBet={(value) => {
                reset();
                setBet(value);
            }}
            playing={playing}
            onPlay={run}
            playLabel={`Bet · ${formatCoins(bet, 0)}`}
            message={message}
            related={related}
            controls={
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold tracking-wide text-dim uppercase">
                            Auto cash out at
                        </span>
                        <span
                            className="text-sm font-black tabular-nums"
                            style={{ color: accent }}
                        >
                            {target.toFixed(2)}x
                        </span>
                    </div>
                    <input
                        type="range"
                        min={1.01}
                        max={Math.min(max, 100)}
                        step={0.01}
                        value={Math.min(target, 100)}
                        onChange={(e) => setTarget(Number(e.target.value))}
                        disabled={playing}
                        className="w-full accent-lime"
                        aria-label="Auto cash out multiplier"
                    />
                    <div className="flex flex-wrap gap-1.5">
                        {PRESETS.map((preset) => (
                            <button
                                key={preset}
                                type="button"
                                onClick={() => setTarget(preset)}
                                disabled={playing}
                                className={cn(
                                    'rounded-md px-2.5 py-1 text-[11px] font-bold transition',
                                    target === preset
                                        ? 'text-black'
                                        : 'bg-black/40 text-white/80 ring-1 ring-white/10',
                                )}
                                style={
                                    target === preset
                                        ? { background: accent }
                                        : undefined
                                }
                            >
                                {preset.toFixed(2)}x
                            </button>
                        ))}
                    </div>
                </div>
            }
        >
            <div className="space-y-3 py-1">
                <div className="flex min-h-6 items-center justify-end gap-1.5">
                    {history.length === 0 ? (
                        <span className="text-[11px] text-dim">
                            No rounds yet
                        </span>
                    ) : (
                        history.map((point, index) => (
                            <span
                                key={`${point}-${index}`}
                                className={cn(
                                    'rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums',
                                    point >= target
                                        ? 'bg-emerald-500/85 text-emerald-950'
                                        : 'bg-white/[0.07] text-white/70',
                                    index === 0 && 'ring-2 ring-lime/70',
                                )}
                            >
                                {point.toFixed(2)}×
                            </span>
                        ))
                    )}
                </div>

                <CrashChart
                    accent={accent}
                    target={target}
                    crashAt={crash}
                    phase={phase}
                    won={won}
                />

                <div className="text-center text-xs text-dim">
                    {crash === null ? (
                        playing ? (
                            'Round in progress…'
                        ) : (
                            `Cashing out at ${target.toFixed(2)}x`
                        )
                    ) : won ? (
                        <>
                            Cashed out at {target.toFixed(2)}x · +
                            {formatCoins(payout ?? 0)} coins
                        </>
                    ) : (
                        <>Crashed at {crash.toFixed(2)}x — no win</>
                    )}
                </div>
            </div>
        </OriginalShell>
    );
}
