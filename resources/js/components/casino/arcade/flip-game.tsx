import { Skull } from 'lucide-react';
import { useState } from 'react';
import { GameIcon } from '@/components/casino/game-icon';
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
 * Donut Flip: a coin is tossed onto a 4×4 board. Every tile is one sixteenth of
 * the board — a coin tile pays its multiplier, a skull tile pays nothing. The
 * server draws the landing tile; this board only animates and reports it.
 */
export function FlipGame({ game, bets, balance, config, related }: Props) {
    const { t, tOr } = useI18n();
    const { balance: coins, bet, setBet, playing, message, play } =
        useOriginalPlay(game.id, bets, balance, '/arcade');

    const accent = game.accent ?? '#bef264';
    const boards = config.difficulties;

    const [difficulty, setDifficulty] = useState(
        config.default_difficulty ?? boards[0]?.id ?? '',
    );
    const [landed, setLanded] = useState<number | null>(null);
    const [payout, setPayout] = useState<number | null>(null);
    const [rolling, setRolling] = useState<number | null>(null);
    const [history, setHistory] = useState<number[]>([]);

    const board = boards.find((b) => b.id === difficulty) ?? boards[0];

    if (!board) {
        return null;
    }

    const tiles = board.tiles;
    const drawn = landed !== null ? (tiles[landed] ?? 0) : null;
    const resultShown = drawn !== null && !playing;
    const won = (payout ?? 0) > 0;
    const boardLabel = tOr(`flip.${board.id}`, board.label);

    const coinTiles = tiles.filter((tile) => tile > 0).length;

    const run = () =>
        play({ difficulty: board.id }, async (result) => {
            const detail = result.detail as {
                index?: number;
                multiplier?: number;
            };

            setPayout(null);
            setLanded(null);

            const started = Date.now();
            while (Date.now() - started < 900) {
                setRolling(Math.floor(Math.random() * tiles.length));
                await wait(70);
            }

            setRolling(null);
            setLanded(detail.index ?? 0);
            setPayout(result.total_win);
            setHistory((current) =>
                [detail.multiplier ?? 0, ...current].slice(0, 5),
            );
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
            playLabel={t('flip.bet', { amount: formatCoins(bet, 0) })}
            message={message}
            related={related}
            controls={
                <div>
                    <div className="mb-1 text-[11px] font-semibold text-dim">
                        {t('flip.difficulty')}
                    </div>
                    <div className="flex gap-1 rounded-xl bg-black/40 p-1 ring-1 ring-white/10">
                        {boards.map((option) => {
                            const selected = option.id === board.id;

                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    disabled={playing}
                                    aria-pressed={selected}
                                    onClick={() => {
                                        setDifficulty(option.id);
                                        setLanded(null);
                                        setPayout(null);
                                    }}
                                    className={cn(
                                        'flex-1 rounded-lg py-1.5 text-[11px] font-bold transition',
                                        selected
                                            ? 'text-black'
                                            : 'text-dim hover:text-white',
                                        playing && 'opacity-60',
                                    )}
                                    style={
                                        selected
                                            ? {
                                                  background: `linear-gradient(180deg, ${accent}, ${accent}cc)`,
                                              }
                                            : undefined
                                    }
                                >
                                    {tOr(`flip.${option.id}`, option.label)}
                                </button>
                            );
                        })}
                    </div>
                    <p className="mt-1.5 text-[10px] leading-snug text-dim">
                        {t('flip.tiles', {
                            coins: coinTiles,
                            skulls: tiles.length - coinTiles,
                        })}
                    </p>
                </div>
            }
        >
            <div className="relative overflow-hidden py-1">
                <div className="mx-auto w-full max-w-[440px]">
                    <div className="mb-2 flex items-center justify-between text-[11px] font-semibold">
                        <span className="text-dim">
                            {t('flip.board', { label: boardLabel })}
                        </span>
                        <span className="text-dim">
                            {resultShown && won && (
                                <span style={{ color: accent }}>
                                    +{formatCoins(payout ?? 0)} coins
                                </span>
                            )}
                        </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                        {tiles.map((mult, index) => {
                            const isSkull = mult <= 0;
                            const isLanded = resultShown && landed === index;
                            const isRolling = playing && rolling === index;
                            const isWinner = isLanded && !isSkull;

                            return (
                                <div
                                    key={`${board.id}-${index}`}
                                    className={cn(
                                        'relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl',
                                        'bg-[linear-gradient(160deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] ring-1 ring-white/10',
                                        'shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-8px_14px_rgba(0,0,0,0.35)]',
                                        'transition-all duration-150',
                                        isRolling && 'scale-[1.04] ring-2 ring-white/45',
                                        isWinner && 'scale-[1.04]',
                                    )}
                                    style={
                                        isLanded
                                            ? isSkull
                                                ? {
                                                      background:
                                                          'linear-gradient(160deg, rgba(251,113,133,0.30), rgba(251,113,133,0.06))',
                                                      boxShadow:
                                                          '0 0 0 2px #fb7185, 0 16px 34px -16px #fb7185',
                                                  }
                                                : {
                                                      background: `linear-gradient(160deg, ${accent}42, ${accent}0f)`,
                                                      boxShadow: `0 0 0 2px ${accent}, 0 16px 34px -16px ${accent}`,
                                                  }
                                            : undefined
                                    }
                                >
                                    {isSkull ? (
                                        <Skull
                                            className={cn(
                                                'size-5 sm:size-6',
                                                isLanded
                                                    ? 'text-rose-200'
                                                    : 'text-white/25',
                                            )}
                                            strokeWidth={2.4}
                                        />
                                    ) : (
                                        <span
                                            className={cn(
                                                'px-1 text-[12px] font-extrabold tabular-nums sm:text-[15px]',
                                                isWinner
                                                    ? ''
                                                    : 'text-white/90',
                                            )}
                                            style={
                                                isWinner
                                                    ? { color: accent }
                                                    : undefined
                                            }
                                        >
                                            {mult.toFixed(2)}x
                                        </span>
                                    )}

                                    {isLanded && (
                                        <span className="pointer-events-none absolute inset-x-0 top-0.5 flex justify-center">
                                            <span className="coin-drop block leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
                                                <GameIcon glyph="🪙" size={16} />
                                            </span>
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-4 flex min-h-[2.75rem] flex-col items-center gap-2">
                        <div className="text-center text-sm font-bold">
                            {resultShown ? (
                                <span
                                    className={won ? '' : 'text-dim'}
                                    style={won ? { color: accent } : undefined}
                                >
                                    {won
                                        ? t('flip.win', {
                                              mult: drawn?.toFixed(2) ?? '',
                                          })
                                        : t('flip.loss')}
                                </span>
                            ) : (
                                <span className="text-xs font-normal text-dim">
                                    {playing ? t('flip.inAir') : t('flip.hint')}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-1.5">
                            {Array.from({ length: 5 }).map((_, slot) => {
                                const value = history[slot];
                                const filled = value !== undefined;
                                const hit = filled && value > 0;

                                return (
                                    <span
                                        key={slot}
                                        className="size-2 rounded-full transition-colors"
                                        style={{
                                            background: hit
                                                ? accent
                                                : filled
                                                  ? 'rgba(251,113,133,0.65)'
                                                  : 'rgba(255,255,255,0.12)',
                                        }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </OriginalShell>
    );
}
