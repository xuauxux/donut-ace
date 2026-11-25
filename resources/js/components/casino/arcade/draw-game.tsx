import { useState } from 'react';
import type { ComponentType } from 'react';
import {
    DartsBoard,
    GemsBoard,
} from '@/components/casino/arcade/arcade-boards';
import { BaccaratBoard, HiLoBoard } from '@/components/casino/arcade/card-games';
import {
    PaperIcon,
    RockIcon,
    ScissorsIcon,
} from '@/components/casino/game-icons';
import { GameIcon } from '@/components/casino/game-icon';
import { useI18n } from '@/components/casino/language-provider';
import { OriginalShell } from '@/components/casino/originals/original-shell';
import { useOriginalPlay } from '@/hooks/use-original-play';
import { formatCoins } from '@/lib/casino';
import { wait } from '@/lib/http';
import { cn } from '@/lib/utils';
import type { ArcadeConfig, ArcadeOption, Game } from '@/types';

type Props = {
    game: Game;
    bets: number[];
    balance: number;
    config: ArcadeConfig;
    related: Game[];
};

/**
 * Pick-and-draw games. Three presentations share one engine:
 *  - wheel: a spinning segmented wheel (Wheel)
 *  - card:  a card that flips to the drawn outcome (Tarot, HiLo, Baccarat)
 *  - tiles: a board of selectable markets (Flip, Darts, Bars, Diamonds…)
 */
export function DrawGame({ game, bets, balance, config, related }: Props) {
    const { t } = useI18n();
    const { balance: coins, bet, setBet, playing, message, play } =
        useOriginalPlay(game.id, bets, balance, '/arcade');

    const options = config.options;
    const skin = config.skin ?? 'tiles';
    const isPrize = config.mode === 'prize';
    const accent = game.accent ?? '#bef264';

    /* Tables where the player backs an outcome on the board itself (coin, darts,
     * gems, hands) start with nothing selected; the others keep their first
     * market. */
    const [pick, setPick] = useState(() =>
        ['coin', 'hands', 'target', 'gems'].includes(skin)
            ? ''
            : (options[0]?.id ?? ''),
    );
    const [drawnId, setDrawnId] = useState<string | null>(null);
    const [payout, setPayout] = useState<number | null>(null);
    const [angle, setAngle] = useState(0);
    /* bumps each round so a card deal is stable while the round plays out */
    const [roundToken, setRoundToken] = useState(() =>
        Math.floor(Math.random() * 100000),
    );

    const drawn = options.find((o) => o.id === drawnId) ?? null;
    const resultShown = drawnId !== null && !playing;

    const needsPick = !isPrize && pick === '';

    const run = () => {
        if (needsPick) {
            return;
        }

        setRoundToken((token) => token + 1);

        return play(isPrize ? {} : { pick }, async (result) => {
            const detail = result.detail as { drawn?: string };
            const id = detail.drawn ?? null;

            setPayout(null);
            setDrawnId(null);

            if (skin === 'wheel') {
                const index = Math.max(
                    0,
                    options.findIndex((o) => o.id === id),
                );
                const segment = 360 / options.length;

                setAngle((current) => {
                    const turns = Math.ceil(current / 360) + 4;

                    return (
                        turns * 360 - (index * segment + segment / 2)
                    );
                });

                await wait(2400);
            } else if (skin === 'card') {
                await wait(820);
            } else {
                const started = Date.now();
                while (Date.now() - started < 680) {
                    setDrawnId(
                        options[Math.floor(Math.random() * options.length)]
                            ?.id ?? null,
                    );
                    await wait(65);
                }
            }

            setDrawnId(id);
            setPayout(result.total_win);
        });
    };

    const won = (payout ?? 0) > 0;

    return (
        <OriginalShell
            game={game}
            balance={coins}
            bets={bets}
            bet={bet}
            onBet={setBet}
            playing={playing}
            onPlay={run}
            playLabel={`${isPrize ? 'Draw' : 'Bet'} · ${formatCoins(bet, 0)}`}
            playDisabled={needsPick}
            message={message}
            related={related}
        >
            <div className="relative overflow-hidden py-2">
                {skin === 'wheel' && (
                    <Wheel
                        options={options}
                        angle={angle}
                        accent={accent}
                        drawnId={resultShown ? drawnId : null}
                        spinning={playing}
                    />
                )}

                {skin === 'card' && game.id === 'hilo' && (
                    <HiLoBoard
                        drawnId={resultShown ? drawnId : null}
                        revealing={playing}
                        token={roundToken}
                        accent={accent}
                        pick={pick}
                    />
                )}

                {skin === 'card' && game.id === 'baccarat' && (
                    <BaccaratBoard
                        drawnId={resultShown ? drawnId : null}
                        revealing={playing}
                        token={roundToken}
                        accent={accent}
                    />
                )}

                {skin === 'card' &&
                    game.id !== 'hilo' &&
                    game.id !== 'baccarat' && (
                    <CardReveal
                        option={drawn}
                        accent={accent}
                        revealing={playing}
                        pick={
                            isPrize
                                ? null
                                : (options.find((o) => o.id === pick) ?? null)
                        }
                    />
                )}

                {skin === 'coin' && (
                    <CoinBoard
                        option={resultShown ? drawn : null}
                        pick={
                            isPrize
                                ? null
                                : (options.find((o) => o.id === pick) ?? null)
                        }
                        accent={accent}
                        spinning={playing}
                    />
                )}

                {skin === 'target' && (
                    <DartsBoard
                        options={options}
                        drawnId={resultShown ? drawnId : null}
                        accent={accent}
                        pick={pick}
                        onPick={setPick}
                        disabled={playing || isPrize}
                    />
                )}

                {skin === 'gems' && (
                    <GemsBoard
                        options={options}
                        drawnId={resultShown ? drawnId : null}
                        accent={accent}
                        pick={pick}
                        onPick={setPick}
                        disabled={playing || isPrize}
                    />
                )}

                {skin === 'reels' && (
                    <ReelBoard
                        options={options}
                        drawn={resultShown ? drawn : null}
                        accent={accent}
                    />
                )}

                {skin === 'hands' && (
                    <HandsBoard
                        options={options}
                        drawn={resultShown ? drawn : null}
                        accent={accent}
                        pick={pick}
                        onPick={setPick}
                        disabled={playing || isPrize}
                    />
                )}

                {skin === 'tiles' && (
                    <TileGrid
                        options={options}
                        pick={pick}
                        onPick={setPick}
                        disabled={playing || isPrize}
                        accent={accent}
                        drawnId={resultShown ? drawnId : null}
                    />
                )}

                {!isPrize &&
                    skin !== 'tiles' &&
                    skin !== 'hands' &&
                    skin !== 'target' &&
                    skin !== 'gems' && (
                    <div className="mt-5 flex flex-wrap justify-center gap-2 sm:gap-2.5">
                        {options.map((option) => {
                            const selected = pick === option.id;

                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    disabled={playing}
                                    aria-pressed={selected}
                                    onClick={() => setPick(option.id)}
                                    className={cn(
                                        'group relative flex min-w-0 flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-xl px-2 py-2.5 sm:min-w-[7.5rem] sm:flex-none sm:gap-2 sm:px-4',
                                        'text-[11px] font-extrabold transition-all duration-150 sm:text-sm',
                                        'disabled:cursor-not-allowed disabled:opacity-55',
                                        selected
                                            ? 'text-black'
                                            : 'bg-white/[0.04] text-white ring-1 ring-white/12',
                                        selected &&
                                            'shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-2px_0_rgba(0,0,0,0.18)]',
                                        !selected &&
                                            'hover:-translate-y-0.5 hover:bg-white/[0.09] hover:ring-white/25 active:translate-y-0',
                                    )}
                                    style={
                                        selected
                                            ? {
                                                  background: `linear-gradient(180deg, ${accent}, ${accent}cc)`,
                                                  boxShadow: `0 12px 26px -12px ${accent}, 0 0 0 1px ${accent}66, inset 0 1px 0 rgba(255,255,255,0.55)`,
                                              }
                                            : undefined
                                    }
                                >
                                    {selected && (
                                        <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-[linear-gradient(180deg,rgba(255,255,255,0.42),transparent)]" />
                                    )}
                                    <span className="relative flex items-center leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]">
                                        <GameIcon
                                            glyph={option.emoji}
                                            size={18}
                                        />
                                    </span>
                                    <span className="relative truncate">
                                        {option.label}
                                    </span>
                                    <span
                                        className={cn(
                                            'relative hidden rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums sm:inline-block',
                                            selected
                                                ? 'bg-black/15 text-black/75'
                                                : 'bg-black/40 text-white/70',
                                        )}
                                    >
                                        {option.mult.toFixed(2)}x
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                <div className="mt-4 h-6 text-center">
                    {resultShown ? (
                        <span
                            className={cn(
                                'text-sm font-bold',
                                won ? '' : 'text-dim',
                            )}
                            style={won ? { color: accent } : undefined}
                        >
                            {won
                                ? t('draw.won', {
                                      coins: formatCoins(payout ?? 0),
                                      mult: ((payout ?? 0) / bet).toFixed(2),
                                  })
                                : isPrize
                                  ? t('draw.noWinDraw')
                                  : t('draw.noWin')}
                        </span>
                    ) : (
                        <span className="text-xs text-dim">
                            {playing
                                ? t('draw.resolving')
                                : isPrize
                                  ? t('draw.prizeHint')
                                  : t('draw.marketHint')}
                        </span>
                    )}
                </div>
            </div>
        </OriginalShell>
    );
}

/* ---------------------------------------------------------------- tiles */

function TileGrid({
    options,
    pick,
    onPick,
    disabled,
    accent,
    drawnId,
}: {
    options: ArcadeOption[];
    pick: string;
    onPick: (id: string) => void;
    disabled: boolean;
    accent: string;
    drawnId: string | null;
}) {
    const columns =
        options.length <= 2
            ? 'grid-cols-2'
            : options.length === 3
              ? 'grid-cols-3'
              : options.length === 4
                ? 'grid-cols-2 sm:grid-cols-4'
                : 'grid-cols-3 sm:grid-cols-5';

    return (
        <div className={cn('mx-auto grid max-w-xl gap-2 pt-4', columns)}>
            {options.map((option) => {
                const selected = pick === option.id;
                const isDrawn = drawnId === option.id;

                return (
                    <button
                        key={option.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => onPick(option.id)}
                        className={cn(
                            'group relative flex flex-col items-center justify-center gap-1.5 overflow-hidden rounded-2xl px-2 py-4 ring-1 ring-white/12 transition-all duration-200',
                            'bg-[linear-gradient(160deg,rgba(255,255,255,0.14),rgba(255,255,255,0.03))]',
                            'shadow-[inset_0_1px_0_rgba(255,255,255,0.10),inset_0_-10px_18px_rgba(0,0,0,0.32)]',
                            !disabled &&
                                'hover:-translate-y-0.5 hover:ring-white/30',
                            isDrawn && 'scale-[1.03]',
                        )}
                        style={{
                            boxShadow: isDrawn
                                ? `0 0 0 2px ${accent}, 0 12px 40px -12px ${accent}`
                                : selected
                                  ? `0 0 0 2px ${accent}55`
                                  : undefined,
                        }}
                    >
                        <span className="flex items-center leading-none drop-shadow-[0_4px_14px_rgba(0,0,0,0.6)]">
                            <GameIcon glyph={option.emoji || '🎲'} size={30} />
                        </span>
                        <span className="px-1 text-[11px] font-semibold text-white/90">
                            {option.label}
                        </span>
                        <span
                            className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold"
                            style={{ color: accent }}
                        >
                            {option.mult.toFixed(2)}x
                        </span>
                        {selected && !disabled && (
                            <span
                                className="absolute inset-x-3 bottom-1 h-[3px] rounded-full"
                                style={{ background: accent }}
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
}

/* ---------------------------------------------------------------- wheel */

function Wheel({
    options,
    angle,
    accent,
    drawnId,
    spinning,
}: {
    options: ArcadeOption[];
    angle: number;
    accent: string;
    drawnId: string | null;
    spinning: boolean;
}) {
    const segment = 360 / Math.max(1, options.length);

    return (
        <div className="relative mx-auto aspect-square w-full max-w-[300px] pt-3 sm:max-w-[380px]">
            <div className="absolute inset-0 rounded-full bg-black/40 blur-md" />
            <svg
                viewBox="0 0 100 100"
                className="relative size-full drop-shadow-[0_18px_40px_rgba(0,0,0,0.6)]"
                style={{
                    transform: `rotate(${angle}deg)`,
                    transition: 'transform 2.4s cubic-bezier(0.16, 0.84, 0.2, 1)',
                }}
            >
                {options.map((option, index) => {
                    const start = (index * segment - 90) * (Math.PI / 180);
                    const end = ((index + 1) * segment - 90) * (Math.PI / 180);
                    const x1 = 50 + 47 * Math.cos(start);
                    const y1 = 50 + 47 * Math.sin(start);
                    const x2 = 50 + 47 * Math.cos(end);
                    const y2 = 50 + 47 * Math.sin(end);
                    const labelAngle = index * segment + segment / 2 - 90;
                    const lx = 50 + 32 * Math.cos(labelAngle * (Math.PI / 180));
                    const ly = 50 + 32 * Math.sin(labelAngle * (Math.PI / 180));
                    const isDrawn = drawnId === option.id;
                    const rotation = index * segment + segment / 2;
                    // Keep the numbers readable on the left half of the wheel.
                    const flip =
                        rotation > 95 && rotation < 265 ? 180 : 0;

                    return (
                        <g key={option.id}>
                            <path
                                d={`M50 50 L${x1} ${y1} A47 47 0 0 1 ${x2} ${y2} Z`}
                                fill={
                                    isDrawn
                                        ? accent
                                        : index % 2 === 0
                                          ? 'rgba(255,255,255,0.16)'
                                          : 'rgba(255,255,255,0.06)'
                                }
                                stroke="rgba(0,0,0,0.45)"
                                strokeWidth="0.4"
                            />
                            <text
                                x={lx}
                                y={ly}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize="4.2"
                                fontWeight="700"
                                fill={isDrawn ? '#0b0e13' : '#e7ecf3'}
                                transform={`rotate(${rotation + flip} ${lx} ${ly})`}
                            >
                                {option.mult.toFixed(2)}x
                            </text>
                        </g>
                    );
                })}
                <circle
                    cx="50"
                    cy="50"
                    r="47"
                    fill="none"
                    stroke={accent}
                    strokeOpacity="0.55"
                    strokeWidth="0.9"
                />
                <circle
                    cx="50"
                    cy="50"
                    r="7"
                    fill="#0b0e13"
                    stroke={accent}
                    strokeWidth="1.2"
                />
            </svg>

            <div
                className="absolute top-0 left-1/2 -translate-x-1/2 text-lg leading-none"
                style={{ color: accent, textShadow: `0 0 12px ${accent}` }}
            >
                ▼
            </div>

            {!spinning && drawnId && (
                <div className="absolute inset-x-0 -bottom-1 text-center text-xs font-semibold text-white/80">
                    {options.find((o) => o.id === drawnId)?.label}
                </div>
            )}
        </div>
    );
}

/* ---------------------------------------------------------------- coin */

function CoinBoard({
    option,
    pick,
    accent,
    spinning,
}: {
    option: ArcadeOption | null;
    /** The side the player has called — shown face-up before the toss. */
    pick: ArcadeOption | null;
    accent: string;
    spinning: boolean;
}) {
    const face = option ?? pick;

    return (
        <div className="mx-auto flex max-w-sm flex-col items-center gap-5 pt-2">
            <div className="relative [perspective:900px]">
                {/* Contact shadow — shrinks while the coin is airborne. */}
                <div
                    className={cn(
                        'absolute -bottom-4 left-1/2 h-3 w-28 -translate-x-1/2 rounded-full bg-black/55 blur-md transition-all duration-300',
                        spinning ? 'scale-75 opacity-30' : 'opacity-60',
                    )}
                />

                <div
                    className={cn(
                        'relative size-40 [transform-style:preserve-3d]',
                        spinning && 'coin-spin',
                        !spinning && option && 'coin-land',
                    )}
                >
                    {[0, 180].map((rotation) => (
                        <div
                            key={rotation}
                            className="absolute inset-0 flex items-center justify-center rounded-full bg-gradient-to-br from-amber-100 via-amber-400 to-amber-700 ring-4 ring-amber-200/50"
                            style={{
                                transform: `rotateY(${rotation}deg)`,
                                backfaceVisibility: 'hidden',
                                boxShadow:
                                    '0 24px 60px -18px rgba(251,191,36,0.75), inset 0 -8px 18px rgba(120,53,15,0.45), inset 0 8px 14px rgba(255,255,255,0.35)',
                            }}
                        >
                            <span className="absolute inset-[14px] rounded-full ring-2 ring-amber-900/25" />
                            <span className="absolute inset-[22px] rounded-full ring-1 ring-amber-50/35" />
                            <span className="relative text-[64px] leading-none font-black text-amber-900/75 drop-shadow-[0_2px_0_rgba(255,255,255,0.35)]">
                                {face ? face.label.charAt(0) : '★'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="text-center">
                <div className="text-lg font-black" style={{ color: accent }}>
                    {spinning
                        ? 'Flipping…'
                        : option
                          ? option.label
                          : pick
                            ? `You called ${pick.label}`
                            : 'Heads or tails?'}
                </div>
                <div className="text-xs text-dim">
                    {option
                        ? `${option.mult.toFixed(2)}x paid`
                        : spinning
                          ? 'Up in the air'
                          : pick
                            ? `Bet ${pick.mult.toFixed(2)}x on ${pick.label}`
                            : 'Pick a side, then bet'}
                </div>
            </div>
        </div>
    );
}

/* ---------------------------------------------------------------- reels */

function ReelBoard({
    options,
    drawn,
    accent,
}: {
    options: ArcadeOption[];
    drawn: ArcadeOption | null;
    accent: string;
}) {
    const bars = drawn ? Math.max(1, Math.round(drawn.mult)) : 0;

    return (
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 pt-6">
            <div className="flex gap-2">
                {[0, 1, 2].map((reel) => (
                    <div
                        key={reel}
                        className="flex h-28 w-24 items-center justify-center rounded-xl bg-black/40 text-4xl ring-1 ring-white/10"
                        style={
                            drawn && reel < Math.min(3, bars)
                                ? { boxShadow: `inset 0 0 0 2px ${accent}` }
                                : undefined
                        }
                    >
                        {drawn ? (reel < Math.min(3, bars) ? '🟩' : '⬜') : '🎰'}
                    </div>
                ))}
            </div>
            <div className="text-center">
                <div className="text-base font-black" style={{ color: accent }}>
                    {drawn ? `${drawn.label} · ${drawn.mult.toFixed(2)}x` : 'Spin for bars'}
                </div>
                <div className="text-xs text-dim">
                    {options.length} outcomes · 99% RTP
                </div>
            </div>
        </div>
    );
}

/* ---------------------------------------------------------------- hands */

/** Styled art for the three hand signs (matches the RPS cover). */
const HAND_ICONS: Record<string, ComponentType<{ className?: string }>> = {
    rock: RockIcon,
    paper: PaperIcon,
    scissors: ScissorsIcon,
};

function HandsBoard({
    options,
    drawn,
    accent,
    pick,
    onPick,
    disabled,
}: {
    options: ArcadeOption[];
    drawn: ArcadeOption | null;
    accent: string;
    pick: string;
    onPick: (id: string) => void;
    disabled: boolean;
}) {
    const picked = options.find((option) => option.id === pick) ?? null;
    const winner = options[0]?.mult.toFixed(2) ?? '2.97';

    return (
        <div className="mx-auto w-full max-w-xl">
            {!drawn && (
                <div className="mb-4 text-center">
                    <h3 className="text-sm font-black text-white sm:text-base">
                        Call the house&apos;s throw
                    </h3>
                    <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-dim">
                        Pick one hand. If the house throws the same hand you
                        win {winner}× your bet.
                    </p>
                </div>
            )}

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {options.map((option) => {
                    const selected = pick === option.id;
                    const revealed = drawn?.id === option.id;
                    const faded = drawn !== null && !selected && !revealed;
                    const Hand = HAND_ICONS[option.id];

                    return (
                        <button
                            key={option.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => onPick(option.id)}
                            aria-pressed={selected}
                            className={cn(
                                'group relative flex flex-col items-center gap-1.5 rounded-2xl px-1.5 py-4 ring-1 transition-all duration-150 sm:py-5',
                                selected
                                    ? 'bg-white/[0.06] ring-white/20'
                                    : 'bg-black/25 ring-white/[0.07] hover:-translate-y-0.5 hover:bg-white/[0.05]',
                                faded && 'opacity-45',
                                'disabled:hover:translate-y-0',
                            )}
                            style={
                                selected
                                    ? {
                                          boxShadow: `inset 0 0 0 2px ${accent}, 0 18px 36px -24px ${accent}`,
                                      }
                                    : revealed
                                      ? { boxShadow: `inset 0 0 0 2px ${accent}66` }
                                      : undefined
                            }
                        >
                            {selected && (
                                <span
                                    className="absolute top-1.5 right-1.5 rounded-full px-1.5 py-0.5 text-[8px] font-black tracking-wide uppercase"
                                    style={{ background: accent, color: '#0b0e13' }}
                                >
                                    Yours
                                </span>
                            )}
                            <span className="text-slate-100">
                                {Hand ? (
                                    <Hand className="size-14 sm:size-20" />
                                ) : (
                                    <GameIcon glyph={option.emoji} size={56} />
                                )}
                            </span>
                            <span className="text-[11px] font-bold text-white sm:text-xs">
                                {option.label}
                            </span>
                            <span className="text-[9px] text-dim sm:text-[10px]">
                                {option.mult.toFixed(2)}×
                                <span className="hidden sm:inline">
                                    {' '}if it matches
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>

            {drawn && (
                <div className="mt-4 rounded-2xl bg-black/30 p-3 ring-1 ring-white/10">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-[9px] font-bold tracking-[0.16em] text-dim uppercase">
                                You called
                            </span>
                            {picked && HAND_ICONS[picked.id] ? (
                                (() => {
                                    const Hand = HAND_ICONS[picked.id];

                                    return (
                                        <Hand className="size-12 text-slate-200" />
                                    );
                                })()
                            ) : (
                                <span className="text-xs text-dim">—</span>
                            )}
                            <span className="text-[11px] font-bold text-white">
                                {picked?.label ?? '—'}
                            </span>
                        </div>

                        <span className="text-[10px] font-black tracking-widest text-white/25">
                            VS
                        </span>

                        <div className="flex flex-col items-center gap-1">
                            <span className="text-[9px] font-bold tracking-[0.16em] text-dim uppercase">
                                House threw
                            </span>
                            {HAND_ICONS[drawn.id] ? (
                                (() => {
                                    const Hand = HAND_ICONS[drawn.id];

                                    return (
                                        <Hand className="size-12 text-slate-200" />
                                    );
                                })()
                            ) : (
                                <GameIcon glyph={drawn.emoji} size={40} />
                            )}
                            <span className="text-[11px] font-bold text-white">
                                {drawn.label}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            <p className="mt-3 text-center text-[9px] text-white/20">
                Hand icons by John Redman — game-icons.net (CC BY 3.0)
            </p>
        </div>
    );
}

/* ---------------------------------------------------------------- card */

function CardReveal({
    option,
    accent,
    revealing,
    pick,
}: {
    option: ArcadeOption | null;
    accent: string;
    revealing: boolean;
    pick: ArcadeOption | null;
}) {
    return (
        <div className="mx-auto flex max-w-sm flex-col items-center pt-3">
            <div className="[perspective:1200px]">
                <div
                    className="relative h-[210px] w-[150px] transition-transform duration-700 [transform-style:preserve-3d]"
                    style={{
                        transform:
                            option && !revealing
                                ? 'rotateY(180deg)'
                                : 'rotateY(0deg)',
                    }}
                >
                    {/* back */}
                    <div
                        className="absolute inset-0 flex items-center justify-center rounded-2xl ring-1 ring-white/15 [backface-visibility:hidden]"
                        style={{
                            background: `repeating-linear-gradient(45deg, ${accent}22 0 8px, #0b0e1366 8px 16px), #0b0e13`,
                        }}
                    >
                        <span className="text-4xl opacity-80">🂠</span>
                    </div>

                    {/* front */}
                    <div
                        className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-[#0f1420] ring-1 ring-white/20 [backface-visibility:hidden]"
                        style={{
                            transform: 'rotateY(180deg)',
                            boxShadow: option
                                ? `0 0 0 2px ${accent}, 0 18px 50px -18px ${accent}`
                                : undefined,
                        }}
                    >
                        <GameIcon glyph={option?.emoji || '🎴'} size={46} />
                        <span className="text-sm font-bold text-white">
                            {option?.label ?? ''}
                        </span>
                        <span
                            className="text-xs font-bold"
                            style={{ color: accent }}
                        >
                            {option?.mult?.toFixed(2)}x
                        </span>
                    </div>
                </div>
            </div>

            {pick && (
                <div className="mt-4 text-xs text-dim">
                    Your bet:{' '}
                    <b className="inline-flex items-center gap-1 text-white">
                        <GameIcon glyph={pick.emoji} size={14} />
                        {pick.label}
                    </b>{' '}
                    at {pick.mult.toFixed(2)}x
                </div>
            )}
        </div>
    );
}
