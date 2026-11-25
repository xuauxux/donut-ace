import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const RISKS = ['low', 'medium', 'high'] as const;
const BALL_CHOICES = [1, 3, 5, 10];

type BallDetail = {
    path: number[];
    bucket: number;
    multiplier: number;
    total_win: number;
};

type FlyingBall = { id: number; left: number; top: number };

type DropSummary = { count: number; stake: number; win: number };

export function Plinko({ game, bets, balance, config, related }: Props) {
    const { balance: coins, bet, setBet, playing, message, play } =
        useOriginalPlay('plinko', bets, balance);
    const [rows, setRows] = useState(12);
    const [risk, setRisk] = useState<(typeof RISKS)[number]>('medium');
    const [ballCount, setBallCount] = useState(1);
    const [balls, setBalls] = useState<FlyingBall[]>([]);
    const [landed, setLanded] = useState<Record<number, number>>({});
    const [drop, setDrop] = useState<DropSummary | null>(null);

    const alive = useRef(true);
    const nextBall = useRef(1);

    useEffect(() => {
        alive.current = true;

        return () => {
            alive.current = false;
        };
    }, []);

    const table = useMemo(
        () => config.table?.[String(rows)]?.[risk] ?? [],
        [config.table, rows, risk],
    );
    const spacing = 100 / (rows + 1);

    const maxBalls = config.max_balls ?? 10;
    const ballChoices = BALL_CHOICES.filter((n) => n <= maxBalls);
    const stake = bet * ballCount;
    const affordable = stake <= coins;

    /* A new table means new pockets — clear anything still falling. */
    useEffect(() => {
        setBalls([]);
        setLanded({});
        setDrop(null);
    }, [rows, risk]);

    /* One ball's walk: the path is known up front, so each ball animates on its
     * own and several can be in the air at the same time. */
    const fall = useCallback(
        async (id: number, path: number[], bucket: number, steps: number) => {
            const gap = 100 / (steps + 1);
            let rights = 0;

            for (let step = 1; step <= steps; step++) {
                rights += path[step - 1] ?? 0;
                const left = 50 + (rights + (steps - step) / 2 - steps / 2) * gap;
                const top = (step / (steps + 1)) * 84;

                if (!alive.current) {
                    return;
                }

                setBalls((prev) =>
                    prev.map((b) => (b.id === id ? { ...b, left, top } : b)),
                );
                await wait(95);
            }

            if (!alive.current) {
                return;
            }

            setLanded((prev) => ({
                ...prev,
                [bucket]: (prev[bucket] ?? 0) + 1,
            }));

            await wait(280);

            if (!alive.current) {
                return;
            }

            setBalls((prev) => prev.filter((b) => b.id !== id));
        },
        [],
    );

    const dropBalls = () =>
        play({ rows, risk, count: ballCount }, (result) => {
            const detail = result.detail as {
                balls?: BallDetail[];
                path?: number[];
                bucket?: number;
            };

            /* One ball comes back in the single-ball shape; several come back in
             * `balls`. Normalise both so the stage has one list to animate. */
            const outcomes: BallDetail[] = detail.balls ?? [
                {
                    path: detail.path ?? [],
                    bucket: detail.bucket ?? 0,
                    multiplier: result.multiplier,
                    total_win: result.total_win,
                },
            ];

            setLanded({});
            setDrop({
                count: outcomes.length,
                stake: result.bet,
                win: result.total_win,
            });

            outcomes.forEach((outcome, index) => {
                const id = nextBall.current++;

                /* Stagger the starts so the balls read as separate drops. */
                window.setTimeout(() => {
                    if (!alive.current) {
                        return;
                    }

                    setBalls((prev) => [...prev, { id, left: 50, top: 0 }]);
                    void fall(id, outcome.path, outcome.bucket, rows);
                }, index * 70);
            });
        });

    return (
        <OriginalShell
            game={game}
            balance={coins}
            bets={bets}
            bet={bet}
            onBet={setBet}
            playing={playing}
            onPlay={dropBalls}
            playLabel={
                ballCount > 1
                    ? `Drop ${ballCount} · ${formatCoins(stake, 0)}`
                    : `Drop · ${formatCoins(bet, 0)}`
            }
            playDisabled={!affordable}
            message={message}
            related={related}
            controls={
                <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1 rounded-lg bg-black/40 p-1 ring-1 ring-white/10">
                        <span className="px-1.5 text-[10px] font-bold tracking-wide text-dim uppercase">
                            Rows
                        </span>
                        {(config.rows ?? [8, 12, 16]).map((r) => (
                            <button
                                key={r}
                                type="button"
                                onClick={() => setRows(r)}
                                className={cn(
                                    'rounded-md px-2 py-1 text-[11px] font-bold',
                                    rows === r
                                        ? 'bg-lime text-lime-ink'
                                        : 'text-white/75',
                                )}
                            >
                                {r}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-1 rounded-lg bg-black/40 p-1 ring-1 ring-white/10">
                        <span className="px-1.5 text-[10px] font-bold tracking-wide text-dim uppercase">
                            Balls
                        </span>
                        {ballChoices.map((n) => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => setBallCount(n)}
                                className={cn(
                                    'rounded-md px-2 py-1 text-[11px] font-bold tabular-nums',
                                    ballCount === n
                                        ? 'bg-lime text-lime-ink'
                                        : 'text-white/75',
                                )}
                            >
                                {n}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-1 items-center gap-1 rounded-lg bg-black/40 p-1 ring-1 ring-white/10">
                        {RISKS.map((r) => (
                            <button
                                key={r}
                                type="button"
                                onClick={() => setRisk(r)}
                                className={cn(
                                    'flex-1 rounded-md px-2 py-1 text-[11px] font-bold capitalize',
                                    risk === r
                                        ? 'bg-lime text-lime-ink'
                                        : 'text-white/75',
                                )}
                            >
                                {r}
                            </button>
                        ))}
                    </div>

                    {!affordable && (
                        <p className="w-full text-[10px] font-semibold text-amber-300">
                            Not enough coins for {ballCount}{' '}
                            {ballCount === 1 ? 'ball' : 'balls'} at this bet —
                            lower the bet or the ball count.
                        </p>
                    )}
                </div>
            }
        >
            <div className="relative mx-auto h-[380px] w-full max-w-2xl overflow-hidden">
                {Array.from({ length: rows }).map((_, row) => (
                    <div key={row}>
                        {Array.from({ length: row + 1 }).map((__, i) => (
                            <span
                                key={i}
                                className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.45),inset_0_-1px_2px_rgba(0,0,0,0.5)]"
                                style={{
                                    left: `${50 + (i - row / 2) * spacing}%`,
                                    top: `${((row + 1) / (rows + 1)) * 84}%`,
                                }}
                            />
                        ))}
                    </div>
                ))}

                {balls.map((ball) => (
                    <Fragment key={ball.id}>
                        <span
                            className="absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime/25 blur-[6px] transition-all duration-100 ease-linear"
                            style={{
                                left: `${ball.left}%`,
                                top: `${ball.top}%`,
                            }}
                        />
                        <span
                            className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-white via-lime-200 to-lime-500 shadow-[0_0_16px_rgba(201,247,58,0.9)] transition-all duration-100 ease-linear"
                            style={{
                                left: `${ball.left}%`,
                                top: `${ball.top}%`,
                            }}
                        />
                    </Fragment>
                ))}

                <div className="absolute inset-x-0 bottom-0 flex items-end gap-0.5">
                    {table.map((m, i) => {
                        const peak = Math.max(...table, 1);
                        const height =
                            18 + (Math.log2(Math.max(m, 1)) / Math.log2(peak)) * 46;

                        return (
                            <div
                                key={i}
                                className={cn(
                                    'relative flex flex-1 items-start justify-center rounded-t-md pt-1 text-center text-[9px] font-bold tabular-nums transition-all sm:text-[10px]',
                                    m >= 2
                                        ? 'bg-gradient-to-t from-lime-600/70 to-lime text-lime-ink'
                                        : m >= 1
                                          ? 'bg-gradient-to-t from-white/25 to-white/60 text-[#0b0e13]'
                                          : 'bg-gradient-to-t from-rose-700/60 to-rose-400/90 text-rose-50',
                                    landed[i] &&
                                        'translate-y-[-4px] brightness-125 ring-2 ring-white',
                                )}
                                style={{ height: `${height}%` }}
                            >
                                {m.toFixed(2)}
                                {(landed[i] ?? 0) > 1 && (
                                    <span className="absolute -top-1.5 -right-1 flex size-4 items-center justify-center rounded-full bg-white text-[9px] font-black text-[#0b0e13] shadow">
                                        {landed[i]}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {drop && (
                <div
                    className={cn(
                        'mt-3 rounded-xl px-4 py-2 text-center text-sm font-bold',
                        drop.win > 0
                            ? 'bg-lime/15 text-lime'
                            : 'bg-black/30 text-dim',
                    )}
                >
                    {drop.count > 1 && (
                        <span className="mr-1.5 rounded-md bg-black/30 px-1.5 py-0.5 text-[11px] text-white/80">
                            {drop.count} balls
                        </span>
                    )}
                    {drop.win > 0
                        ? `+${formatCoins(drop.win)} coins · ${(drop.win / drop.stake).toFixed(2)}x`
                        : 'No win — try again'}
                </div>
            )}
        </OriginalShell>
    );
}
