import { useState } from 'react';
import { useI18n } from '@/components/casino/language-provider';
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

/**
 * Scratch Card: nine cells under gold foil, three of a kind pays. The server
 * draws the card; this only wipes the foil off cell by cell.
 */
export function ScratchCard({ game, bets, balance, config, related }: Props) {
    const { t } = useI18n();
    const { balance: coins, bet, setBet, playing, message, play } =
        useOriginalPlay(game.id, bets, balance, '/arcade');

    const accent = game.accent ?? '#7dd3fc';

    const [grid, setGrid] = useState<string[] | null>(null);
    const [revealed, setRevealed] = useState(0);
    const [payout, setPayout] = useState<number | null>(null);
    const [symbol, setSymbol] = useState<string | null>(null);

    const won = (payout ?? 0) > 0;
    const done = revealed >= 9 && !playing;

    const run = () =>
        play({}, async (result) => {
            const detail = result.detail as {
                grid?: string[];
                symbol?: string | null;
            };

            setGrid(null);
            setRevealed(0);
            setPayout(null);
            setSymbol(null);

            setGrid(detail.grid ?? Array<string>(9).fill('⭐'));

            for (let cell = 1; cell <= 9; cell++) {
                setRevealed(cell);
                await wait(85);
            }

            /* let the last foil finish lifting before the result lands */
            await wait(320);

            setSymbol(detail.symbol ?? null);
            setPayout(result.total_win);
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
            playLabel={`${t('game.scratch')} · ${formatCoins(bet, 0)}`}
            message={message}
            related={related}
        >
            <div className="relative overflow-hidden py-1">
                {/* ticket */}
                <div
                    className="relative mx-auto w-full max-w-[370px] overflow-hidden rounded-[22px] shadow-[0_28px_60px_-24px_rgba(0,0,0,0.9)]"
                    style={{
                        background: 'linear-gradient(168deg, #fbfdff 0%, #e8eef6 62%, #d3dde9 100%)',
                    }}
                >
                    {/* header band */}
                    <div className="flex items-center justify-between bg-[#0d1420] px-4 py-2.5">
                        <span className="text-[10px] font-black tracking-[0.24em] text-white/70 uppercase">
                            Donut Ace · Scratch
                        </span>
                        <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-black tracking-wide"
                            style={{ background: `${accent}22`, color: accent }}
                        >
                            99% RTP
                        </span>
                    </div>

                    {/* foil grid */}
                    <div className="p-3">
                        <div className="grid grid-cols-3 gap-2">
                            {Array.from({ length: 9 }).map((_, index) => {
                                const glyph = grid?.[index] ?? '';
                                const open = index < revealed;
                                const isWinner = open && symbol !== null && glyph === symbol;

                                return (
                                    <div
                                        key={index}
                                        className={cn(
                                            'relative flex aspect-square items-center justify-center overflow-hidden rounded-xl',
                                            'bg-[linear-gradient(165deg,#ffffff,#eef3f9)]',
                                            'ring-1 ring-[#0d1420]/10',
                                            'shadow-[inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-6px_10px_rgba(15,23,42,0.06)]',
                                        )}
                                        style={
                                            isWinner
                                                ? {
                                                      background: `linear-gradient(165deg, ${accent}33, #ffffff)`,
                                                      boxShadow: `0 0 0 2px ${accent}, 0 10px 24px -12px ${accent}`,
                                                  }
                                                : undefined
                                        }
                                    >
                                        <span
                                            className={cn(
                                                'text-[34px] leading-none transition-transform duration-300',
                                                isWinner && 'scale-110',
                                                open ? 'opacity-100' : 'opacity-0',
                                            )}
                                        >
                                            {glyph}
                                        </span>

                                        {/* foil cover — lifts away as the cell is scratched */}
                                        <span
                                            className={cn(
                                                'absolute inset-0 flex items-center justify-center transition-all duration-300 ease-out',
                                                open
                                                    ? '-translate-y-full opacity-0'
                                                    : 'translate-y-0 opacity-100',
                                            )}
                                            style={{
                                                transitionDelay: `${(index % 3) * 30}ms`,
                                                background:
                                                    'linear-gradient(135deg,#f7e6b4 0%,#d9b45f 26%,#f3dda2 44%,#c99a3f 68%,#efd79b 100%)',
                                                boxShadow:
                                                    'inset 0 0 0 1px rgba(255,255,255,0.55), inset 0 -6px 10px rgba(120,80,10,0.35)',
                                            }}
                                        >
                                            <span className="absolute inset-0 bg-[repeating-linear-gradient(115deg,rgba(255,255,255,0.42)_0px,rgba(255,255,255,0.42)_1px,transparent_1px,transparent_7px)] opacity-70" />
                                            <span className="relative text-[15px] leading-none text-[#7a5510]/55">
                                                ✦
                                            </span>
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-3 flex items-center justify-between px-1">
                            <span className="text-[10px] font-bold tracking-[0.18em] text-[#0d1420]/45 uppercase">
                                Match three
                            </span>
                            <span className="text-[10px] font-bold tracking-[0.18em] text-[#0d1420]/45 uppercase">
                                {config.symbols.length} symbols
                            </span>
                        </div>
                    </div>

                    {/* tear-off edge */}
                    <div className="h-2 bg-[repeating-linear-gradient(90deg,#0d1420_0_6px,transparent_6px_12px)] opacity-25" />
                </div>

                <div className="mt-3 h-7 text-center text-sm font-bold">
                    {done ? (
                        <span
                            className={won ? '' : 'text-dim'}
                            style={won ? { color: accent } : undefined}
                        >
                            {won
                                ? `${t('game.threeOfAKind')} ${symbol} · +${formatCoins(payout ?? 0)}`
                                : t('game.noThree')}
                        </span>
                    ) : (
                        <span className="text-xs font-normal text-dim">
                            {playing ? t('draw.resolving') : t('game.pickBet')}
                        </span>
                    )}
                </div>
            </div>
        </OriginalShell>
    );
}
