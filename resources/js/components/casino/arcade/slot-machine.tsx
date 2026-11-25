import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/components/casino/language-provider';
import { GameIcon } from '@/components/casino/game-icon';
import { OriginalShell } from '@/components/casino/originals/original-shell';
import { useOriginalPlay } from '@/hooks/use-original-play';
import { formatCoins } from '@/lib/casino';
import { wait } from '@/lib/http';
import { cn } from '@/lib/utils';
import type { ArcadeConfig, Game, SlotConfig } from '@/types';

type Props = {
    game: Game;
    bets: number[];
    balance: number;
    config: ArcadeConfig;
    related: Game[];
};

type SpinDetail = {
    grid: string[][];
    lines: {
        line: number;
        symbol: string;
        count: number;
        coords: [number, number][];
        multiplier: number;
        payout: number;
    }[];
    scatter: { count: number; coords: [number, number][]; multiplier: number; payout: number } | null;
    total_multiplier: number;
};

type Grid = string[][];

const ROWS = 3;
const COLS = 5;

function randomGrid(slot: SlotConfig): Grid {
    const faces = slot.symbols.filter((symbol) => !symbol.wild && !symbol.scatter).map((symbol) => symbol.id);

    return Array.from({ length: COLS }, () =>
        Array.from({ length: ROWS }, () => faces[Math.floor(Math.random() * faces.length)] ?? 'wild'),
    );
}

/**
 * 5×3 slot machine with 20 fixed paylines — reels spin, winning cells light up
 * and the line that paid is traced underneath. The spin itself is resolved by
 * the server; the browser only animates the grid it is given.
 */
export function SlotMachine({ game, bets, balance, config, related }: Props) {
    const { t } = useI18n();
    const slot = config.slot;
    const play = useOriginalPlay(game.id, bets, balance, '/arcade');
    const [grid, setGrid] = useState<Grid>(() => randomGrid((config.slot ?? emptySlot) as SlotConfig));
    const [detail, setDetail] = useState<SpinDetail | null>(null);
    const [spinning, setSpinning] = useState(false);
    const stopped = useRef(true);

    useEffect(() => () => void (stopped.current = false), []);

    const faces = useMemo(() => {
        const map = new Map<string, string>();
        for (const symbol of slot?.symbols ?? []) {
            map.set(symbol.id, symbol.emoji);
        }

        return map;
    }, [slot]);

    const names = useMemo(() => {
        const map = new Map<string, string>();
        for (const symbol of slot?.symbols ?? []) {
            map.set(symbol.id, symbol.name);
        }

        return map;
    }, [slot]);

    const winning = useMemo(() => {
        const set = new Set<string>();
        if (!detail) {
            return set;
        }
        for (const line of detail.lines) {
            for (const [col, row] of line.coords) {
                set.add(`${col}-${row}`);
            }
        }
        for (const [col, row] of detail.scatter?.coords ?? []) {
            set.add(`${col}-${row}`);
        }

        return set;
    }, [detail]);

    const spin = () =>
        play.play({}, async (result) => {
            setDetail(null);
            setSpinning(true);

            const reel = setInterval(() => {
                if (stopped.current) {
                    setGrid(randomGrid((config.slot ?? emptySlot) as SlotConfig));
                }
            }, 90);

            const outcome = result.detail as unknown as SpinDetail;

            await wait(1200);
            clearInterval(reel);
            setGrid(outcome.grid);
            setSpinning(false);
            setDetail(outcome);

            if (result.total_win > 0) {
                await wait(450);
            }
        });

    const win = (detail?.total_multiplier ?? 0) > 0;

    return (
        <OriginalShell
            game={game}
            balance={play.balance}
            bets={bets}
            bet={play.bet}
            onBet={play.setBet}
            playing={play.playing || spinning}
            onPlay={spin}
            playLabel={`Spin · ${formatCoins(play.bet, 0)}`}
            message={play.message}
            related={related}
            controls={
                <div className="space-y-1.5 rounded-xl bg-black/30 p-2.5 ring-1 ring-white/10">
                    <div className="flex items-center justify-between text-[10px] font-bold tracking-wider text-dim uppercase">
                        <span>Paytable</span>
                        <span className="flex gap-2">
                            <span className="w-10 text-right">3 in row</span>
                            <span className="w-10 text-right">5 in row</span>
                        </span>
                    </div>
                    {(slot?.symbols ?? [])
                        .filter((symbol) => !symbol.wild && !symbol.scatter)
                        .slice(0, 4)
                        .map((symbol) => (
                            <div key={symbol.id} className="flex items-center gap-2 text-[11px] text-white/80">
                                <GameIcon glyph={symbol.emoji} size={18} />
                                <span className="flex-1 truncate">{symbol.name}</span>
                                <span className="w-10 text-right font-bold tabular-nums text-lime">
                                    {(((slot?.paytable[symbol.id]?.[3] ?? 0) * (slot?.scaler ?? 1)) / 200).toFixed(2)}×
                                </span>
                                <span className="w-10 text-right font-bold tabular-nums text-white/70">
                                    {(((slot?.paytable[symbol.id]?.[5] ?? 0) * (slot?.scaler ?? 1)) / 200).toFixed(2)}×
                                </span>
                            </div>
                        ))}
                    <div className="pt-1 text-[10px] text-dim">20 paylines · scatter pays anywhere</div>
                </div>
            }
        >
            <div className="rounded-2xl bg-[#0b0d11] p-3 ring-1 ring-line/60 sm:p-5">
                <div className="mb-3 flex items-center justify-between">
                    <span className="text-[11px] font-bold tracking-wider text-dim uppercase">{game.name}</span>
                    <span
                        className={cn(
                            'text-sm font-extrabold tabular-nums',
                            win ? 'text-lime' : 'text-white/60',
                        )}
                    >
                        {detail && detail.total_multiplier > 0
                            ? `+${formatCoins(Math.round((detail.total_multiplier ?? 0) * 100), 0)}`
                            : detail
                              ? 'No win'
                              : 'Ready'}
                    </span>
                </div>

                <div className="relative">
                    <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                        {Array.from({ length: COLS }).map((_, col) => (
                            <div key={col} className="flex flex-col gap-1.5 sm:gap-2">
                                {Array.from({ length: ROWS }).map((__, row) => {
                                    const id = grid[col]?.[row] ?? 'wild';
                                    const lit = winning.has(`${col}-${row}`);
                                    return (
                                        <div
                                            key={row}
                                            className={cn(
                                                'flex aspect-square items-center justify-center rounded-lg bg-white/[0.04] text-2xl ring-1 transition sm:text-3xl',
                                                lit
                                                    ? 'bg-lime/15 ring-lime shadow-[0_0_18px_-4px_rgba(190,242,100,0.7)]'
                                                    : 'ring-white/[0.06]',
                                                spinning && 'animate-pulse',
                                            )}
                                            title={names.get(id) ?? id}
                                        >
                                            <GameIcon
                                                glyph={faces.get(id) ?? '❔'}
                                                size={30}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-3 min-h-5 text-center text-[11px] text-dim">
                    {detail && detail.lines.length > 0
                        ? `${detail.lines.length} winning line${detail.lines.length === 1 ? '' : 's'} · ${detail.total_multiplier.toFixed(2)}×`
                        : detail?.scatter
                          ? `${detail.scatter.count} scatters · ${detail.scatter.multiplier.toFixed(2)}×`
                          : spinning
                            ? 'Spinning…'
                            : 'Press spin to play'}
                </div>
            </div>
        </OriginalShell>
    );
}

const emptySlot: SlotConfig = {
    symbols: [],
    scaler: 1,
    paytable: {},
    paylines: [],
    accent: null,
    background: null,
};
