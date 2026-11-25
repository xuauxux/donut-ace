import { useEffect, useRef, useState } from 'react';
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

const PRESETS = [1.2, 1.5, 2, 3, 5, 10, 25, 50];
const TILE = 96;
const GAP = 10;
const STEP = TILE + GAP;
const TILE_COUNT = 7;

/**
 * Minecraft mineral renders (minecraft.wiki), one per tile so the board reads
 * as a row of ore instead of seven identical diamonds.
 */
const MINERALS = [
    { id: 'diamond', label: 'Diamond' },
    { id: 'emerald', label: 'Emerald' },
    { id: 'gold', label: 'Gold ingot' },
    { id: 'iron', label: 'Iron ingot' },
    { id: 'redstone', label: 'Redstone dust' },
    { id: 'lapis', label: 'Lapis lazuli' },
    { id: 'amethyst', label: 'Amethyst shard' },
    { id: 'coal', label: 'Coal' },
    { id: 'quartz', label: 'Nether quartz' },
    { id: 'netherite', label: 'Netherite ingot' },
] as const;
/** Sweep time; the bezier eases out with a small overshoot so it settles. */
const SLIDE_MS = 2350;

type Board = { tiles: number[]; index: number };

/** A random board with the round's multiplier dropped into one slot. */
function makeBoard(point: number): Board {
    const tiles = Array.from({ length: TILE_COUNT }, () => {
        const value = 1 + Math.pow(Math.random(), 2.6) * 18;

        return Math.round(value * 100) / 100;
    });

    const index = Math.floor(Math.random() * TILE_COUNT);
    tiles[index] = Math.round(point * 100) / 100;

    return { tiles, index };
}

/**
 * Slide: pick a target multiplier, the cursor sweeps the board and stops on the
 * round's multiplier. Any target pays bet × target at 99% RTP, so the win chance
 * is 0.99 / target — the same maths as Limbo, different stage.
 */
export function SlideGame({ game, bets, balance, config, related }: Props) {
    const { balance: coins, bet, setBet, playing, message, play } =
        useOriginalPlay(game.id, bets, balance, '/arcade');

    const accent = game.accent ?? '#3ad07a';
    const max = config.max_multiplier ?? 1000;

    const trackRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(880);

    const [target, setTarget] = useState(2);
    const [board, setBoard] = useState<Board>({
        tiles: [1.18, 1.42, 2.6, 1.36, 1.62, 1.06, 3.4],
        index: 3,
    });
    const [offset, setOffset] = useState(0);
    const [animate, setAnimate] = useState(false);
    const [phase, setPhase] = useState<'idle' | 'spin' | 'done'>('idle');
    const [crash, setCrash] = useState<number | null>(null);
    const [payout, setPayout] = useState<number | null>(null);
    const [history, setHistory] = useState<number[]>([]);

    useEffect(() => {
        const el = trackRef.current;

        if (!el) {
            return;
        }

        const measure = () => setWidth(el.clientWidth || 880);
        measure();

        const observer = new ResizeObserver(measure);
        observer.observe(el);

        return () => observer.disconnect();
    }, []);

    const stripX = (index: number) => width / 2 - (index * STEP + TILE / 2);

    useEffect(() => {
        if (phase === 'idle') {
            setOffset(stripX(board.index));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [width]);

    const clamp = (value: number) =>
        Math.min(max, Math.max(1.01, Math.round(value * 100) / 100));

    const won = (payout ?? 0) > 0;
    const chance = Math.min(99, 99 / target);
    const profit = Math.max(0, Math.round(bet * target) - bet);
    const presets = PRESETS.filter((value) => value <= max);

    const run = () =>
        play({ target }, async (result) => {
            const detail = result.detail as { crash?: number };
            const point = detail.crash ?? 1;
            const next = makeBoard(point);

            setPayout(null);
            setCrash(null);
            setBoard(next);
            setPhase('spin');

            /* Park the strip off to the right without a transition, then let it
             * sweep left to the landed tile. */
            setAnimate(false);
            setOffset(width + 40);
            await wait(60);

            setAnimate(true);
            await wait(20);
            setOffset(stripX(next.index));
            await wait(SLIDE_MS + 80);

            setAnimate(false);
            setPhase('done');
            setCrash(point);
            setPayout(result.total_win);
            setHistory((current) => [point, ...current].slice(0, 10));
        });

    const landed = phase === 'done';

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
                        <span className="text-dim">Target Multiplier</span>
                        <span className="font-bold" style={{ color: accent }}>
                            {chance.toFixed(2)}% win chance
                        </span>
                    </div>

                    <div className="flex items-center gap-1 rounded-xl bg-black/40 p-1 ring-1 ring-white/10">
                        <input
                            type="number"
                            step="0.01"
                            min={1.01}
                            max={max}
                            value={target}
                            onChange={(event) =>
                                setTarget(clamp(Number(event.target.value) || 1.01))
                            }
                            disabled={playing || phase === 'spin'}
                            aria-label="Target multiplier"
                            className="min-w-0 flex-1 bg-transparent px-2 text-center text-sm font-black tabular-nums text-white outline-none disabled:opacity-60"
                        />
                        <span className="pr-1 text-xs font-bold text-dim">x</span>
                        <button
                            type="button"
                            onClick={() => setTarget((v) => clamp(v - 0.1))}
                            disabled={playing || phase === 'spin' || target <= 1.01}
                            className="rounded-lg px-2.5 py-1.5 text-sm font-bold text-white/80 ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-40"
                        >
                            −
                        </button>
                        <button
                            type="button"
                            onClick={() => setTarget((v) => clamp(v + 0.1))}
                            disabled={playing || phase === 'spin' || target >= max}
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
                                disabled={playing || phase === 'spin'}
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

                    <div className="space-y-1 rounded-xl bg-black/40 p-2.5 ring-1 ring-white/10">
                        <div className="flex items-center justify-between text-[11px] text-dim">
                            <span>Profit on Win</span>
                            <b className="tabular-nums text-white">
                                +{formatCoins(profit, 0)}
                            </b>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-dim">
                            <span>Total return</span>
                            <b className="tabular-nums" style={{ color: accent }}>
                                {formatCoins(Math.round(bet * target), 0)}
                            </b>
                        </div>
                    </div>
                </div>
            }
        >
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-2">
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {history.length === 0 && (
                        <span className="text-[11px] text-dim">
                            Recent landings appear here
                        </span>
                    )}
                    {history.map((value, slot) => (
                        <span
                            key={`${value}-${slot}`}
                            className="rounded-md px-2 py-1 text-[11px] font-bold tabular-nums"
                            style={{
                                background:
                                    value >= target
                                        ? 'rgba(190,242,100,0.16)'
                                        : 'rgba(244,63,94,0.16)',
                                color: value >= target ? '#bef264' : '#fda4af',
                            }}
                        >
                            {value.toFixed(2)}x
                        </span>
                    ))}
                </div>

                <div
                    ref={trackRef}
                    className="relative w-full overflow-hidden rounded-2xl bg-black/40 py-6 ring-1 ring-white/10"
                >
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 z-10"
                        style={{
                            background: `radial-gradient(ellipse at 50% 50%, ${accent}14, transparent 62%)`,
                        }}
                    />

                    <div
                        className="flex will-change-transform"
                        style={{
                            gap: GAP,
                            transform: `translateX(${offset}px)`,
                            transition: animate
                                ? `transform ${SLIDE_MS}ms cubic-bezier(0.15, 0.9, 0.2, 1.06)`
                                : 'none',
                        }}
                    >
                        {board.tiles.map((value, index) => {
                            const isLanded = landed && index === board.index;
                            const isWinner = isLanded && (crash ?? 0) >= target;

                            return (
                                <div
                                    key={`${index}-${value}`}
                                    className={cn(
                                        'relative flex h-40 shrink-0 flex-col items-center justify-between rounded-xl px-2 py-3 transition-colors duration-300',
                                        isLanded
                                            ? 'bg-white/[0.07]'
                                            : 'bg-white/[0.03]',
                                    )}
                                    style={{
                                        width: TILE,
                                        boxShadow: isLanded
                                            ? `inset 0 0 0 2px ${isWinner ? accent : '#f43f5e'}, 0 18px 40px -18px ${isWinner ? accent : '#f43f5e'}`
                                            : 'inset 0 0 0 1px rgba(255,255,255,0.06)',
                                    }}
                                >
                                    <span
                                        className={cn(
                                            'w-full rounded-md py-1 text-center text-sm font-black tabular-nums',
                                            isLanded
                                                ? 'text-white'
                                                : 'text-white/70',
                                        )}
                                        style={{
                                            background: isLanded
                                                ? isWinner
                                                    ? `${accent}2e`
                                                    : 'rgba(244,63,94,0.18)'
                                                : 'rgba(255,255,255,0.04)',
                                        }}
                                    >
                                        {value.toFixed(2)}x
                                    </span>
                                    <span
                                        className="flex items-center justify-center transition-opacity"
                                        style={{
                                            opacity: isLanded ? 1 : 0.78,
                                            filter: isLanded
                                                ? `drop-shadow(0 0 10px ${isWinner ? accent : '#f43f5e'})`
                                                : 'saturate(0.8)',
                                        }}
                                    >
                                        <img
                                            src={`/images/slide/${MINERALS[index % MINERALS.length].id}.png`}
                                            alt={`${MINERALS[index % MINERALS.length].label} sprite`}
                                            width={44}
                                            height={44}
                                            draggable={false}
                                            className="size-11 select-none"
                                            style={{ imageRendering: 'pixelated' }}
                                        />
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Cursor: the strip slides under this fixed line. */}
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-y-4 left-1/2 z-20 w-[2px] -translate-x-1/2 bg-gradient-to-b from-transparent via-white/80 to-transparent"
                    />
                    <div
                        aria-hidden
                        className="pointer-events-none absolute bottom-2 left-1/2 z-20 size-2 -translate-x-1/2 rounded-full bg-white/80"
                    />
                </div>

                <div className="min-h-6 text-center text-sm font-bold">
                    {phase === 'spin' ? (
                        <span className="text-xs font-normal text-dim">
                            Sliding…
                        </span>
                    ) : landed ? (
                        won ? (
                            <span className="text-lime">
                                Landed {(crash ?? 0).toFixed(2)}x · paid +
                                {formatCoins(payout ?? 0, 0)} coins
                            </span>
                        ) : (
                            <span className="text-dim">
                                Landed {(crash ?? 0).toFixed(2)}x —{' '}
                                {target.toFixed(2)}x needed
                            </span>
                        )
                    ) : (
                        <span className="text-xs font-normal text-dim">
                            {playing
                                ? 'Sliding…'
                                : 'Set a target, then play.'}
                        </span>
                    )}
                </div>
            </div>
        </OriginalShell>
    );
}
