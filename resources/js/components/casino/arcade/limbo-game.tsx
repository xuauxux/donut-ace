import { useState } from 'react';
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

const PRESETS = [1.5, 2, 3, 5, 10, 25, 50, 100];
/** How long the multiplier takes to climb to the crash point. */
const CLIMB_MS = 1150;

/**
 * Limbo: set the multiplier you want, the round climbs to a crash point and pays
 * bet × target if it gets there. Every target is 99% RTP: the win chance is
 * 0.99 / target.
 */
export function LimboGame({ game, bets, balance, config, related }: Props) {
    const { balance: coins, bet, setBet, playing, message, play } =
        useOriginalPlay(game.id, bets, balance, '/arcade');

    const accent = game.accent ?? '#a78bfa';
    const max = config.max_multiplier ?? 1000;

    const [target, setTarget] = useState(2);
    const [display, setDisplay] = useState(1);
    const [crash, setCrash] = useState<number | null>(null);
    const [payout, setPayout] = useState<number | null>(null);
    const [history, setHistory] = useState<number[]>([]);

    const clamp = (value: number) =>
        Math.min(max, Math.max(1.01, Math.round(value * 100) / 100));

    const won = (payout ?? 0) > 0;
    const chance = Math.min(99, 99 / target);
    const potential = Math.round(bet * target);
    const presets = PRESETS.filter((value) => value <= max);

    const run = () =>
        play({ target }, async (result) => {
            const detail = result.detail as { crash?: number };

            setPayout(null);
            setCrash(null);
            setDisplay(1);

            /* Count up to the crash point; the curve is eased so it slows as
             * it approaches, the way a real limbo round reads. */
            const point = detail.crash ?? 1;
            const started = Date.now();

            while (Date.now() - started < CLIMB_MS) {
                const t = Math.min(1, (Date.now() - started) / CLIMB_MS);
                const eased = t * t * (3 - 2 * t);

                setDisplay(1 + (point - 1) * eased);
                await wait(45);
            }

            setDisplay(point);
            setCrash(point);
            setPayout(result.total_win);
            setHistory((current) => [point, ...current].slice(0, 6));
        });

    return (
        <OriginalShell
            game={game}
            balance={coins}
            bets={bets}
            bet={bet}
            onBet={setBet}
            playing={playing}
            onPlay={run}
            playLabel={`Play · ${formatCoins(bet, 0)}`}
            message={message}
            related={related}
            controls={
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                        <span className="text-dim">Target</span>
                        <span className="font-bold" style={{ color: accent }}>
                            {chance.toFixed(2)}% win chance
                        </span>
                    </div>

                    <div className="flex items-center gap-1 rounded-xl bg-black/40 p-1 ring-1 ring-white/10">
                        <button
                            type="button"
                            onClick={() => setTarget((v) => clamp(v - 0.1))}
                            disabled={playing || target <= 1.01}
                            className="rounded-lg px-2.5 py-1.5 text-sm font-bold text-white/80 ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-40"
                        >
                            −
                        </button>
                        <input
                            type="number"
                            step="0.01"
                            min={1.01}
                            max={max}
                            value={target}
                            onChange={(event) =>
                                setTarget(clamp(Number(event.target.value) || 1.01))
                            }
                            disabled={playing}
                            aria-label="Target multiplier"
                            className="min-w-0 flex-1 bg-transparent px-2 text-center text-sm font-black tabular-nums text-white outline-none disabled:opacity-60"
                        />
                        <span className="pr-1 text-xs font-bold text-dim">x</span>
                        <button
                            type="button"
                            onClick={() => setTarget((v) => clamp(v + 0.1))}
                            disabled={playing || target >= max}
                            className="rounded-lg px-2.5 py-1.5 text-sm font-bold text-white/80 ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-40"
                        >
                            +
                        </button>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                        {presets.map((value) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setTarget(clamp(value))}
                                disabled={playing}
                                className={cn(
                                    'rounded-lg border py-1.5 text-[11px] font-bold tabular-nums transition',
                                    target === value
                                        ? ''
                                        : 'border-white/5 bg-black/40 text-dim hover:text-white',
                                )}
                                style={
                                    target === value
                                        ? {
                                              borderColor: `${accent}99`,
                                              background: `${accent}22`,
                                              color: accent,
                                          }
                                        : undefined
                                }
                            >
                                {value.toFixed(2)}x
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-dim">
                        <span>Pays</span>
                        <b className="text-white">
                            {formatCoins(potential, 0)} coins
                        </b>
                    </div>
                </div>
            }
        >
            <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 py-2">
                <div className="relative w-full overflow-hidden rounded-2xl bg-black/40 p-6 ring-1 ring-white/10">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0"
                        style={{
                            background: `radial-gradient(ellipse at 50% 120%, ${accent}33, transparent 68%)`,
                        }}
                    />

                    <div className="relative text-center">
                        <div className="text-[10px] font-bold tracking-[0.2em] text-dim uppercase">
                            {crash === null
                                ? 'Target'
                                : won
                                  ? 'Crashed above target'
                                  : 'Crashed below target'}
                        </div>
                        <div
                            className={cn(
                                'mt-1 text-6xl font-black tabular-nums transition-colors sm:text-7xl',
                                crash === null
                                    ? 'text-white'
                                    : won
                                      ? 'text-lime'
                                      : 'text-rose-400',
                            )}
                            style={
                                crash === null
                                    ? { textShadow: `0 0 30px ${accent}55` }
                                    : undefined
                            }
                        >
                            {display.toFixed(2)}x
                        </div>

                        <div className="mt-2 text-xs text-dim">
                            {crash === null
                                ? `Win if it reaches ${target.toFixed(2)}x`
                                : `Crash point ${crash.toFixed(2)}x · target ${target.toFixed(2)}x`}
                        </div>
                    </div>

                    <div className="relative mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                            className="h-full rounded-full transition-[width] duration-100 ease-linear"
                            style={{
                                width: `${Math.min(100, (Math.log(Math.max(1, display)) / Math.log(max)) * 100)}%`,
                                background: `linear-gradient(90deg, ${accent}, ${accent}dd)`,
                                boxShadow: `0 0 14px ${accent}aa`,
                            }}
                        />
                        <span
                            aria-hidden
                            className="absolute inset-y-0 w-[2px] bg-white/70"
                            style={{
                                left: `${Math.min(100, (Math.log(target) / Math.log(max)) * 100)}%`,
                            }}
                        />
                    </div>

                    <div className="relative mt-3 flex items-center justify-center gap-1.5">
                        {Array.from({ length: 6 }).map((_, slot) => {
                            const value = history[slot];
                            const hit = value !== undefined && value >= target;

                            return (
                                <span
                                    key={slot}
                                    className="min-w-9 rounded-md px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums"
                                    style={{
                                        background:
                                            value === undefined
                                                ? 'rgba(255,255,255,0.06)'
                                                : hit
                                                  ? 'rgba(190,242,100,0.18)'
                                                  : 'rgba(244,63,94,0.16)',
                                        color:
                                            value === undefined
                                                ? 'rgba(255,255,255,0.25)'
                                                : hit
                                                  ? '#bef264'
                                                  : '#fda4af',
                                    }}
                                >
                                    {value === undefined
                                        ? '–'
                                        : `${value.toFixed(2)}x`}
                                </span>
                            );
                        })}
                    </div>
                </div>

                <div className="min-h-6 text-center text-sm font-bold">
                    {crash === null ? (
                        <span className="text-xs font-normal text-dim">
                            {playing
                                ? 'Climbing…'
                                : 'Pick a target and play.'}
                        </span>
                    ) : won ? (
                        <span className="text-lime">
                            Paid +{formatCoins(payout ?? 0)} coins ·{' '}
                            {target.toFixed(2)}x
                        </span>
                    ) : (
                        <span className="text-dim">
                            Missed it — {target.toFixed(2)}x needed
                        </span>
                    )}
                </div>
            </div>
        </OriginalShell>
    );
}
