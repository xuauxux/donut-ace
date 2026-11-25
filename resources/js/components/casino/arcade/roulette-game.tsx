import { useRef, useState } from 'react';
import { OriginalShell } from '@/components/casino/originals/original-shell';
import { formatCoins } from '@/lib/casino';
import { postJson, wait } from '@/lib/http';
import { cn } from '@/lib/utils';
import type { ArcadeConfig, Game, OriginalResult } from '@/types';

type Props = {
    game: Game;
    bets: number[];
    balance: number;
    config: ArcadeConfig;
    related: Game[];
};

/* European wheel order, clockwise from the top. Pocket 0 is green. */
const EUROPEAN_ORDER = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
    24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

/* Wheel geometry inside the 200 × 200 viewBox. */
const R_OUT = 84;
const R_IN = 57;
const GAP = 0.7;

const GOLD = '#f5b82e';

/* The wheel and the ball stop together, and the number is only revealed after
 * that — otherwise the ball would visibly slide from one pocket to another
 * once the result is already on screen. */
const WHEEL_MS = 4600;
const BALL_MS = 4600;
const REVEAL_MS = BALL_MS + 250;

const FELT =
    'radial-gradient(115% 80% at 50% -10%, #232a36 0%, #171d27 46%, #0f141c 100%)';

function polar(radius: number, deg: number): [number, number] {
    const rad = ((deg - 90) * Math.PI) / 180;

    return [100 + radius * Math.cos(rad), 100 + radius * Math.sin(rad)];
}

function wedgePath(from: number, to: number) {
    const [x1, y1] = polar(R_OUT, from);
    const [x2, y2] = polar(R_OUT, to);
    const [x3, y3] = polar(R_IN, to);
    const [x4, y4] = polar(R_IN, from);

    return [
        `M ${x1} ${y1}`,
        `A ${R_OUT} ${R_OUT} 0 0 1 ${x2} ${y2}`,
        `L ${x3} ${y3}`,
        `A ${R_IN} ${R_IN} 0 0 0 ${x4} ${y4}`,
        'Z',
    ].join(' ');
}

/** Cell colour of a pocket, matching the felt. */
function tone(key: string, red: Set<number>): 'red' | 'black' | 'green' | 'slate' {
    if (key === 'green' || key === 'double') {
        return 'green';
    }

    if (key.startsWith('n')) {
        return red.has(Number(key.slice(1))) ? 'red' : 'black';
    }

    return key === 'red' ? 'red' : key === 'black' ? 'black' : 'slate';
}

const TONE_FILL: Record<string, string> = {
    red: 'linear-gradient(180deg, #cf3543 0%, #a91b2c 52%, #7f1120 100%)',
    black: 'linear-gradient(180deg, #323a49 0%, #1d232d 55%, #12171e 100%)',
    green: 'linear-gradient(180deg, #25b465 0%, #14834a 55%, #0a5c32 100%)',
    slate: 'linear-gradient(180deg, #2c333f 0%, #1c222b 60%, #141920 100%)',
};

/** Compact chip label: 500 coins → "500", 2,500 → "2.5k". */
function chipLabel(minor: number) {
    const coins = minor / 100;
    const trim = (n: number) => String(Number(n.toFixed(1)));

    return coins >= 1_000_000 ? `${trim(coins / 1_000_000)}m` : coins >= 1_000 ? `${trim(coins / 1_000)}k` : String(Math.round(coins));
}

type Card = {
    key: string;
    label: string;
    col: number;
    row: number;
    colSpan?: number;
    rowSpan?: number;
    muted?: boolean;
};

/**
 * The whole table: the zero pocket(s) down the left, 36 numbers, columns,
 * dozens and calls. An American wheel stacks 0 and 00 in that first column.
 */
function board(zeros: number[]): Card[] {
    const zeroCells: Card[] =
        zeros.length > 1
            ? [
                  { key: 'green', label: '0', col: 1, row: 1, rowSpan: 2 },
                  { key: 'double', label: '00', col: 1, row: 3 },
              ]
            : [{ key: 'green', label: '0', col: 1, row: 1, rowSpan: 3 }];

    return [
        ...zeroCells,
        ...Array.from({ length: 36 }, (_, i) => {
            const n = i + 1;

            return {
                key: `n${n}`,
                label: String(n),
                col: 2 + Math.floor((n - 1) / 3),
                row: 3 - ((n - 1) % 3),
            };
        }),
        { key: 'c3', label: '2:1', col: 14, row: 1, muted: true },
        { key: 'c2', label: '2:1', col: 14, row: 2, muted: true },
        { key: 'c1', label: '2:1', col: 14, row: 3, muted: true },
        { key: 'd1', label: '1st 12', col: 2, row: 4, colSpan: 4, muted: true },
        { key: 'd2', label: '2nd 12', col: 6, row: 4, colSpan: 4, muted: true },
        { key: 'd3', label: '3rd 12', col: 10, row: 4, colSpan: 4, muted: true },
        { key: 'low', label: '1-18', col: 2, row: 5, colSpan: 2, muted: true },
        { key: 'even', label: 'Even', col: 4, row: 5, colSpan: 2, muted: true },
        { key: 'red', label: 'Red', col: 6, row: 5, colSpan: 2 },
        { key: 'black', label: 'Black', col: 8, row: 5, colSpan: 2 },
        { key: 'odd', label: 'Odd', col: 10, row: 5, colSpan: 2, muted: true },
        { key: 'high', label: '19-36', col: 12, row: 5, colSpan: 2, muted: true },
    ];
}

/**
 * Roulette with a real table: any number of chips can sit on the felt at once
 * (straight numbers, dozens, columns and the outside calls), with undo, clear
 * and rebet. The server spins and settles the whole table in one round; this
 * file only draws the wheel, the chips and the winning cells.
 */
export function RouletteGame({ game, bets, balance, config, related }: Props) {
    const order = config.order.length > 1 ? config.order : EUROPEAN_ORDER;
    const segment = 360 / order.length;
    const red = new Set(config.red);
    const zeros = config.zeros?.length ? config.zeros : [0];
    const isZero = (n: number) => zeros.includes(n);
    const zeroKey = (n: number) => (n === zeros[1] ? 'double' : n === zeros[0] ? 'green' : `n${n}`);
    const pocketLabel = (n: number) => (n === zeros[1] ? '00' : String(n));

    const chips = bets.length > 0 ? bets : [10_000, 25_000, 50_000, 100_000, 250_000];

    const [chip, setChip] = useState(chips[Math.min(2, chips.length - 1)] ?? 0);
    const [stakes, setStakes] = useState<Record<string, number>>({});
    const [placed, setPlaced] = useState<[string, number][]>([]);
    const [lastBet, setLastBet] = useState<[string, number][] | null>(null);

    const [coins, setCoins] = useState(balance);
    const [playing, setPlaying] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [result, setResult] = useState<{ number: number; net: number; pushed: boolean } | null>(null);
    const [won, setWon] = useState<string[]>([]);
    const [history, setHistory] = useState<number[]>([]);

    const [wheelAngle, setWheelAngle] = useState(0);
    const [ballAngle, setBallAngle] = useState(0);
    const [settled, setSettled] = useState(false);

    const wheelRef = useRef(0);
    const ballRef = useRef(0);

    const total = Object.values(stakes).reduce((sum, v) => sum + v, 0);
    const number = result?.number ?? null;

    const spinTo = (landed: number) => {
        const index = Math.max(0, order.indexOf(landed));
        const wheelNext = wheelRef.current + 360 * 4 + 71;
        const pocket = index * segment + wheelNext;
        const from = ballRef.current;
        const travel = ((((pocket - from) % 360) + 360) % 360) + 360 * 5;

        wheelRef.current = wheelNext;
        ballRef.current = from + travel;

        setWheelAngle(wheelNext);
        setBallAngle(ballRef.current);
    };

    const place = (key: string) => {
        if (playing) {
            return;
        }

        if (coins < total + chip) {
            setMessage('Not enough coins for that chip.');

            return;
        }

        setMessage(null);
        setResult(null);
        setWon([]);
        setStakes((s) => ({ ...s, [key]: (s[key] ?? 0) + chip }));
        setPlaced((p) => [...p, [key, chip]]);
    };

    const undo = () => {
        const last = placed[placed.length - 1];

        if (!last) {
            return;
        }

        setStakes((s) => {
            const next = { ...s };
            const left = (next[last[0]] ?? 0) - last[1];

            if (left > 0) {
                next[last[0]] = left;
            } else {
                delete next[last[0]];
            }

            return next;
        });
        setPlaced((p) => p.slice(0, -1));
    };

    const clear = () => {
        setStakes({});
        setPlaced([]);
        setResult(null);
        setWon([]);
    };

    const rebet = () => {
        if (!lastBet || placed.length > 0) {
            return;
        }

        const need = lastBet.reduce((sum, [, amount]) => sum + amount, 0);

        if (need > coins) {
            setMessage('Not enough coins to repeat that bet.');

            return;
        }

        const next: Record<string, number> = {};

        for (const [key, amount] of lastBet) {
            next[key] = (next[key] ?? 0) + amount;
        }

        setStakes(next);
        setPlaced(lastBet.slice());
        setMessage(null);
        setResult(null);
        setWon([]);
    };

    const spin = async () => {
        if (playing) {
            return;
        }

        if (total <= 0) {
            setMessage('Place at least one chip first.');

            return;
        }

        const snapshot = placed.slice();
        const stake = total;

        setPlaying(true);
        setMessage(null);
        setResult(null);
        setWon([]);
        setSettled(false);

        try {
            const res = await postJson<OriginalResult>(`/arcade/${game.id}/play`, {
                bet: stake,
                bets: stakes,
            });
            const detail = res.detail as {
                number?: number;
                won_bets?: string[];
                push_bets?: string[];
            };
            const landed = detail.number ?? 0;

            spinTo(landed);

            const nextBalance = res.balance;
            const win = res.total_win;

            await wait(REVEAL_MS);

            const net = win - stake;

            setCoins(nextBalance);
            setResult({ number: landed, net, pushed: net === 0 });
            setWon(detail.won_bets ?? []);
            setHistory((h) => [landed, ...h].slice(0, 12));
            setLastBet(snapshot);
            setStakes({});
            setPlaced([]);
            setSettled(true);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Something went wrong.');
        } finally {
            setPlaying(false);
        }
    };

    const pocketColour = (n: number) => (isZero(n) ? '#1faa5f' : red.has(n) ? '#c8323f' : '#252b34');

    return (
        <OriginalShell
            game={game}
            balance={coins}
            bets={bets}
            bet={chip}
            onBet={setChip}
            playing={playing}
            onPlay={spin}
            playLabel={`Spin · ${formatCoins(total, 0)}`}
            playDisabled={total === 0}
            message={message}
            related={related}
            controls={
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                        <span className="text-dim">Chip value</span>
                        <span className="text-white">{formatCoins(chip, 0)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                        {chips.map((value) => {
                            const on = chip === value;

                            return (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setChip(value)}
                                    disabled={playing}
                                    className={cn(
                                        'relative flex items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[11px] font-bold tabular-nums transition',
                                        on
                                            ? 'border-[#f5b82e]/70 bg-[#f5b82e]/15 text-white shadow-[0_0_14px_rgba(245,184,46,0.25)]'
                                            : 'border-white/5 bg-black/40 text-dim hover:text-white',
                                        playing && 'cursor-not-allowed opacity-60',
                                    )}
                                >
                                    <span
                                        className="size-3 rounded-full ring-1 ring-black/40"
                                        style={{
                                            background:
                                                'radial-gradient(circle at 35% 28%, #ffe9a8, #f5b82e 58%, #c98a12)',
                                        }}
                                    />
                                    {formatCoins(value, 0)}
                                </button>
                            );
                        })}
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                        {[
                            { label: 'Undo', run: undo, off: placed.length === 0 },
                            { label: 'Clear', run: clear, off: placed.length === 0 },
                            { label: 'Rebet', run: rebet, off: !lastBet || placed.length > 0 },
                        ].map((action) => (
                            <button
                                key={action.label}
                                type="button"
                                onClick={action.run}
                                disabled={playing || action.off}
                                className="rounded-lg bg-white/[0.06] py-1.5 text-[11px] font-bold text-white/80 ring-1 ring-white/5 transition hover:bg-white/15 disabled:opacity-40"
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-black/40 px-2 py-1.5 text-[11px] ring-1 ring-white/10">
                        <span className="text-dim">Total bet</span>
                        <b className="tabular-nums text-white">{formatCoins(total, 0)}</b>
                    </div>
                </div>
            }
        >
            <div
                className="relative overflow-hidden rounded-2xl p-2.5 ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_20px_40px_rgba(0,0,0,0.45)] sm:p-3.5"
                style={{ background: FELT }}
            >
                {/* felt weave + vignette */}
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.45]"
                    style={{
                        background:
                            'repeating-linear-gradient(45deg, rgba(255,255,255,0.016) 0 2px, transparent 2px 4px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.05) 0 2px, transparent 2px 4px)',
                    }}
                />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(245,184,46,0.10),transparent_70%)]" />

                <div className="relative flex flex-col items-center">
                    {/* previous results */}
                    <div className="mb-1.5 flex min-h-6 w-full items-center gap-1.5 overflow-hidden">
                        {history.length > 0 ? (
                            history.map((n, i) => (
                                <span
                                    key={`${n}-${i}`}
                                    className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white tabular-nums ring-1 ring-white/25 shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                                    style={{
                                        background: `radial-gradient(circle at 35% 25%, rgba(255,255,255,0.32), transparent 55%), ${pocketColour(n)}`,
                                        opacity: 1 - i * 0.055,
                                    }}
                                >
                                    {pocketLabel(n)}
                                </span>
                            ))
                        ) : (
                            <span className="text-[10px] font-bold tracking-[0.18em] text-white/25 uppercase">
                                Previous results
                            </span>
                        )}
                    </div>

                    <div className="relative aspect-square w-full max-w-[286px] sm:max-w-[318px]">
                        <div className="absolute inset-6 rounded-full bg-black/70 blur-2xl" />

                        {/* wheel — spins clockwise */}
                        <div
                            className="absolute inset-0"
                            style={{
                                transform: `rotate(${wheelAngle}deg)`,
                                transition: `transform ${WHEEL_MS}ms cubic-bezier(0.12, 0.6, 0.1, 1)`,
                            }}
                        >
                            <svg viewBox="0 0 200 200" className="size-full drop-shadow-[0_22px_44px_rgba(0,0,0,0.7)]">
                                <defs>
                                    <radialGradient id="rl-bezel" cx="50%" cy="35%" r="65%">
                                        <stop offset="0%" stopColor="#3d4552" />
                                        <stop offset="55%" stopColor="#191f28" />
                                        <stop offset="100%" stopColor="#080b10" />
                                    </radialGradient>
                                    <radialGradient id="rl-track" cx="50%" cy="30%" r="70%">
                                        <stop offset="0%" stopColor="#1a2029" />
                                        <stop offset="100%" stopColor="#05080c" />
                                    </radialGradient>
                                    <radialGradient id="rl-red" cx="50%" cy="20%" r="85%">
                                        <stop offset="0%" stopColor="#e04a58" />
                                        <stop offset="70%" stopColor="#b3182b" />
                                        <stop offset="100%" stopColor="#7d0d1d" />
                                    </radialGradient>
                                    <radialGradient id="rl-black" cx="50%" cy="20%" r="85%">
                                        <stop offset="0%" stopColor="#3a4353" />
                                        <stop offset="70%" stopColor="#1a2029" />
                                        <stop offset="100%" stopColor="#0d1117" />
                                    </radialGradient>
                                    <radialGradient id="rl-green" cx="50%" cy="20%" r="85%">
                                        <stop offset="0%" stopColor="#2fc274" />
                                        <stop offset="70%" stopColor="#12854a" />
                                        <stop offset="100%" stopColor="#0a5730" />
                                    </radialGradient>
                                    <radialGradient id="rl-cone" cx="50%" cy="34%" r="70%">
                                        <stop offset="0%" stopColor="#2b3341" />
                                        <stop offset="60%" stopColor="#151b24" />
                                        <stop offset="100%" stopColor="#0a0e14" />
                                    </radialGradient>
                                    <linearGradient id="rl-sheen" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
                                        <stop offset="45%" stopColor="#ffffff" stopOpacity="0.02" />
                                        <stop offset="100%" stopColor="#000000" stopOpacity="0.22" />
                                    </linearGradient>
                                </defs>

                                {/* outer bezel */}
                                <circle cx="100" cy="100" r="99" fill="url(#rl-bezel)" />
                                <circle cx="100" cy="100" r="99" fill="none" stroke="rgba(245,184,46,0.5)" strokeWidth="0.9" />
                                <circle cx="100" cy="100" r="95" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.6" />

                                {/* ball track */}
                                <circle cx="100" cy="100" r="89" fill="url(#rl-track)" />
                                <circle cx="100" cy="100" r="89" fill="none" stroke="rgba(245,184,46,0.22)" strokeWidth="0.6" />
                                <circle cx="100" cy="100" r="85.6" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />

                                {order.map((pocket, index) => {
                                    const from = index * segment - segment / 2 + GAP;
                                    const to = (index + 1) * segment - segment / 2 - GAP;
                                    const mid = index * segment;
                                    const fill = isZero(pocket)
                                        ? 'url(#rl-green)'
                                        : red.has(pocket)
                                          ? 'url(#rl-red)'
                                          : 'url(#rl-black)';
                                    const lit = settled && pocket === number;

                                    return (
                                        <g key={`${pocket}-${index}`}>
                                            <path
                                                d={wedgePath(from, to)}
                                                fill={fill}
                                                stroke="rgba(11,14,19,0.85)"
                                                strokeWidth="0.45"
                                            />
                                            <path
                                                d={wedgePath(from, to)}
                                                fill="none"
                                                stroke="rgba(245,184,46,0.42)"
                                                strokeWidth="0.28"
                                            />
                                            {lit && (
                                                <path d={wedgePath(from, to)} fill="#ffffff" opacity="0.3" />
                                            )}
                                            <g transform={`rotate(${mid} 100 100)`}>
                                                <text
                                                    x="100"
                                                    y="29.6"
                                                    textAnchor="middle"
                                                    fontSize="6.2"
                                                    fontWeight="800"
                                                    fill="#ffffff"
                                                    stroke="rgba(0,0,0,0.45)"
                                                    strokeWidth="0.24"
                                                    style={{ paintOrder: 'stroke' }}
                                                >
                                                    {pocketLabel(pocket)}
                                                </text>
                                            </g>
                                        </g>
                                    );
                                })}

                                {/* cone / turret */}
                                <circle cx="100" cy="100" r="57" fill="url(#rl-cone)" />
                                <circle cx="100" cy="100" r="57" fill="none" stroke="rgba(245,184,46,0.65)" strokeWidth="1.1" />
                                <circle cx="100" cy="100" r="51" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                                <circle cx="100" cy="100" r="30" fill="url(#rl-cone)" stroke="rgba(245,184,46,0.28)" strokeWidth="0.5" />
                                {[0, 90, 180, 270].map((deg) => (
                                    <line
                                        key={deg}
                                        x1="100"
                                        y1="72"
                                        x2="100"
                                        y2="42"
                                        stroke="rgba(245,184,46,0.24)"
                                        strokeWidth="1.1"
                                        transform={`rotate(${deg} 100 100)`}
                                    />
                                ))}
                                <circle cx="100" cy="100" r="26" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="1" />

                                {/* glass sheen */}
                                <circle cx="100" cy="100" r="99" fill="url(#rl-sheen)" />
                            </svg>
                        </div>

                        {/* hub */}
                        <svg viewBox="0 0 200 200" className="pointer-events-none absolute inset-0 size-full">
                            <defs>
                                <linearGradient id="rl-hub-sheen" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.14" />
                                    <stop offset="60%" stopColor="#ffffff" stopOpacity="0.01" />
                                    <stop offset="100%" stopColor="#000000" stopOpacity="0.25" />
                                </linearGradient>
                            </defs>
                            <circle cx="100" cy="100" r="25.4" fill="none" stroke="rgba(245,184,46,0.9)" strokeWidth="1.4" />
                            <circle cx="100" cy="100" r="23.6" fill="#11161e" stroke="rgba(0,0,0,0.65)" strokeWidth="0.8" />
                            <circle cx="100" cy="100" r="23.6" fill="url(#rl-hub-sheen)" />

                            {playing ? (
                                <text
                                    x="100"
                                    y="104.5"
                                    textAnchor="middle"
                                    fontSize="12"
                                    fontWeight="900"
                                    fill="rgba(255,255,255,0.45)"
                                >
                                    …
                                </text>
                            ) : number !== null ? (
                                <>
                                    <text
                                        x="100"
                                        y="103"
                                        textAnchor="middle"
                                        fontSize="15"
                                        fontWeight="900"
                                        fill="#ffffff"
                                        style={{ fontVariantNumeric: 'tabular-nums' }}
                                    >
                                        {pocketLabel(number)}
                                    </text>
                                    <text
                                        x="100"
                                        y="111"
                                        textAnchor="middle"
                                        fontSize="3"
                                        fontWeight="800"
                                        letterSpacing="1"
                                        fill={
                                            isZero(number)
                                                ? '#3ddc84'
                                                : red.has(number)
                                                  ? '#ff6b7d'
                                                  : 'rgba(255,255,255,0.45)'
                                        }
                                    >
                                        {isZero(number) ? 'GREEN' : red.has(number) ? 'RED' : 'BLACK'}
                                    </text>
                                </>
                            ) : (
                                <>
                                    <text
                                        x="100"
                                        y="102.5"
                                        textAnchor="middle"
                                        fontSize="6.4"
                                        fontWeight="900"
                                        letterSpacing="1"
                                        fill={GOLD}
                                        opacity="0.75"
                                    >
                                        ACE
                                    </text>
                                    <text
                                        x="100"
                                        y="109"
                                        textAnchor="middle"
                                        fontSize="2.9"
                                        fontWeight="700"
                                        letterSpacing="0.9"
                                        fill="rgba(255,255,255,0.3)"
                                    >
                                        EUROPEAN
                                    </text>
                                </>
                            )}
                        </svg>

                        {/* ball — orbits the other way, then drops into the pocket */}
                        <div
                            className="pointer-events-none absolute inset-0"
                            style={{
                                transform: `rotate(${ballAngle}deg)`,
                                transition: `transform ${BALL_MS}ms cubic-bezier(0.2, 0.72, 0.06, 1)`,
                            }}
                        >
                            <span
                                className="absolute left-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2"
                                style={{
                                    top: settled ? '16%' : '5.5%',
                                    transition: 'top 0.9s cubic-bezier(0.4, 0, 0.2, 1)',
                                }}
                            >
                                <span
                                    className={cn(
                                        'block size-full rounded-full',
                                        'bg-[radial-gradient(circle_at_34%_26%,#ffffff,#eef1f5_48%,#9aa4b3)]',
                                        'shadow-[0_2px_6px_rgba(0,0,0,0.85),0_0_14px_rgba(255,255,255,0.4)]',
                                    )}
                                />
                            </span>
                        </div>

                        {/* pointer */}
                        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2">
                            <div className="size-0 border-x-[9px] border-t-[14px] border-x-transparent border-t-[#f5b82e] drop-shadow-[0_3px_4px_rgba(0,0,0,0.65)]" />
                        </div>
                    </div>

                    <div className="mt-1.5 h-6 text-center text-sm font-bold">
                        {result ? (
                            result.net > 0 ? (
                                <span style={{ color: game.accent ?? '#c9f73a' }}>
                                    {pocketLabel(result.number)}
                                    {isZero(result.number) ? ' green' : red.has(result.number) ? ' red' : ' black'} · Won{' '}
                                    {formatCoins(result.net, 0)}
                                </span>
                            ) : result.pushed ? (
                                <span className="text-white/70">{pocketLabel(result.number)} · chips returned</span>
                            ) : (
                                <span className="text-dim">
                                    {pocketLabel(result.number)}
                                    {isZero(result.number) ? ' green' : red.has(result.number) ? ' red' : ' black'} · Lost{' '}
                                    {formatCoins(-result.net, 0)}
                                </span>
                            )
                        ) : (
                            <span className="text-xs text-dim">
                                {playing ? 'No more bets…' : 'Place your chips, then spin'}
                            </span>
                        )}
                    </div>

                    {/* the table */}
                    <div className="relative -mx-1 mt-1 w-full">
                        <div className="scrollbar-none w-full overflow-x-auto px-1 pb-1">
                        <div
                            className="mx-auto grid gap-[3px] rounded-xl p-[3px] ring-1 ring-black/50 shadow-[inset_0_0_0_1px_rgba(245,184,46,0.08),inset_0_2px_18px_rgba(0,0,0,0.55)]"
                            style={{
                                gridTemplateColumns: '46px repeat(12, minmax(0, 1fr)) 46px',
                                gridTemplateRows: 'repeat(3, 44px) 36px 36px',
                                minWidth: 566,
                                background:
                                    'radial-gradient(120% 140% at 50% 0%, rgba(255,255,255,0.035), rgba(0,0,0,0.35) 75%)',
                            }}
                        >
                            {board(zeros).map((cell) => {
                                const cellTone = tone(cell.key, red);
                                const amount = stakes[cell.key] ?? 0;
                                const landing = number !== null && cell.key === zeroKey(number);
                                const hit = settled && (won.includes(cell.key) || landing);
                                const isRedCell = cell.key === 'red';
                                const wide = (cell.colSpan ?? 1) > 1;

                                return (
                                    <button
                                        key={cell.key}
                                        type="button"
                                        onClick={() => place(cell.key)}
                                        disabled={playing}
                                        aria-label={`Bet ${cell.label}`}
                                        className={cn(
                                            'relative flex items-center justify-center rounded-[5px] text-[13px] font-extrabold text-white/95 tabular-nums transition duration-150',
                                            'ring-1 ring-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-2px_6px_rgba(0,0,0,0.35)]',
                                            'disabled:cursor-not-allowed',
                                            !playing && 'hover:z-10 hover:brightness-[1.22] hover:ring-[#f5b82e]/60 active:scale-[0.96]',
                                            settled && !hit && 'opacity-70',
                                        )}
                                        style={{
                                            gridColumn: `${cell.col} / span ${cell.colSpan ?? 1}`,
                                            gridRow: `${cell.row} / span ${cell.rowSpan ?? 1}`,
                                            background: cell.muted
                                                ? TONE_FILL.slate
                                                : isRedCell
                                                  ? TONE_FILL.red
                                                  : cell.key === 'black'
                                                    ? TONE_FILL.black
                                                    : TONE_FILL[cellTone],
                                            textShadow: '0 1px 2px rgba(0,0,0,0.55)',
                                            boxShadow: hit
                                                ? '0 0 0 2px #f5b82e, 0 0 24px rgba(245,184,46,0.55), inset 0 1px 0 rgba(255,255,255,0.3)'
                                                : undefined,
                                            filter: hit ? 'brightness(1.2)' : undefined,
                                        }}
                                    >
                                        <span className="pointer-events-none relative z-10">{cell.label}</span>
                                        {amount > 0 && (
                                            <span
                                                className={cn(
                                                    'flex shrink-0 items-center justify-center rounded-full font-black text-[#2a1d00]',
                                                    wide
                                                        ? 'ml-2 size-[21px] text-[8px]'
                                                        : 'absolute top-1/2 left-1/2 size-[25px] -translate-x-1/2 -translate-y-1/2 text-[9px]',
                                                )}
                                                title={`${formatCoins(amount, 0)} coins`}
                                                style={{
                                                    background:
                                                        'radial-gradient(circle at 34% 26%, #ffeeb8, #f5b82e 52%, #cc8f13 100%)',
                                                    boxShadow:
                                                        '0 3px 7px rgba(0,0,0,0.6), inset 0 0 0 2px rgba(0,0,0,0.22)',
                                                }}
                                            >
                                                <span className="absolute inset-[3px] rounded-full border border-dashed border-black/45" />
                                                {chipLabel(amount)}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                            </div>
                        </div>
                        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#10151d] to-transparent sm:hidden" />
                    </div>
                    <div className="mt-1 text-[10px] font-semibold text-white/30 sm:hidden">
                        Swipe the table sideways for every bet
                    </div>
                </div>
            </div>
        </OriginalShell>
    );
}
