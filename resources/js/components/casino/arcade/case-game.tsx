import { useRef, useState } from 'react';
import { GameIcon } from '@/components/casino/game-icon';
import { OriginalShell } from '@/components/casino/originals/original-shell';
import { useOriginalPlay } from '@/hooks/use-original-play';
import { formatCoins } from '@/lib/casino';
import { wait } from '@/lib/http';
import { cn } from '@/lib/utils';
import type { ArcadeConfig, ArcadeItem, Game } from '@/types';

type Props = {
    game: Game;
    bets: number[];
    balance: number;
    config: ArcadeConfig;
    related: Game[];
};

const TILE = 84;
const GAP = 6;
const STEP = TILE + GAP;
const WIN_INDEX = 44;
const STRIP = 52;
/** Reel flight time. The blur lifts early so the last stretch reads sharp. */
const SPIN_MS = 4400;
const BLUR_MS = 1900;

/** Cases and packs: a CS-style reel that scrolls to the item you won. */
export function CaseGame({ game, bets, balance, config, related }: Props) {
    const { balance: coins, bet, setBet, playing, message, play } =
        useOriginalPlay(game.id, bets, balance, '/arcade');

    const items = config.items;
    const accent = game.accent ?? '#bef264';

    const trackRef = useRef<HTMLDivElement>(null);
    const [strip, setStrip] = useState<ArcadeItem[]>(() => fill(items));
    const [shift, setShift] = useState(0);
    const [opened, setOpened] = useState<ArcadeItem | null>(null);
    const [payout, setPayout] = useState<number | null>(null);
    const [spinning, setSpinning] = useState(false);
    const [landed, setLanded] = useState(false);
    const [blur, setBlur] = useState(false);

    const open = () =>
        play({}, async (result) => {
            const item =
                (result.detail as { item?: ArcadeItem }).item ?? null;
            const width = trackRef.current?.clientWidth ?? 320;

            /* Reset to a fresh reel, then send it flying in one commit so the
             * browser has a 0 -> target transform to ease out of. */
            setOpened(null);
            setPayout(null);
            setLanded(false);
            setBlur(true);
            setStrip(fill(items, item ?? undefined));
            setShift(0);

            await wait(40);

            setSpinning(true);
            setShift(-(WIN_INDEX * STEP) + width / 2 - TILE / 2);

            /* Sharp again for the slow crawl into the marker. */
            await wait(BLUR_MS);
            setBlur(false);

            await wait(SPIN_MS - BLUR_MS + 140);

            setSpinning(false);
            setLanded(true);
            setOpened(item);
            setPayout(result.total_win);
        });

    const won = (payout ?? 0) > 0;

    return (
        <OriginalShell
            game={game}
            balance={coins}
            bets={bets}
            bet={bet}
            onBet={setBet}
            playing={playing}
            onPlay={open}
            playLabel={`Open · ${formatCoins(bet, 0)}`}
            message={message}
            related={related}
        >
            <div className="relative overflow-hidden py-2">
                <div
                    ref={trackRef}
                    className="relative overflow-hidden rounded-2xl bg-black/45 py-4 ring-1 ring-white/10"
                    style={{
                        maskImage:
                            'linear-gradient(90deg, transparent, black 10%, black 90%, transparent)',
                        WebkitMaskImage:
                            'linear-gradient(90deg, transparent, black 10%, black 90%, transparent)',
                        boxShadow:
                            'inset 0 18px 34px -24px rgba(0,0,0,0.95), inset 0 -18px 34px -24px rgba(0,0,0,0.95)',
                    }}
                >
                    {/* centre marker: band + caps */}
                    <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-[2px] -translate-x-1/2">
                        <span
                            className={cn(
                                'block size-full transition-opacity duration-300',
                                spinning ? 'opacity-100' : 'opacity-80',
                            )}
                            style={{
                                background: accent,
                                boxShadow: `0 0 ${spinning ? 22 : 12}px ${accent}`,
                            }}
                        />
                        <span
                            className="absolute top-0 left-1/2 -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent"
                            style={{ borderTopColor: accent }}
                        />
                        <span
                            className="absolute bottom-0 left-1/2 -translate-x-1/2 border-x-[5px] border-b-[6px] border-x-transparent"
                            style={{ borderBottomColor: accent }}
                        />
                    </div>

                    {/* soft spotlight on the marker column */}
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-24 -translate-x-1/2"
                        style={{
                            background: `radial-gradient(ellipse at center, ${accent}26, transparent 72%)`,
                        }}
                    />

                    <div
                        className="flex"
                        style={{
                            gap: GAP,
                            transform: `translate3d(${shift}px, 0, 0)`,
                            filter: blur ? 'blur(2.5px)' : 'blur(0px)',
                            willChange: 'transform, filter',
                            transition: spinning
                                ? `transform ${SPIN_MS}ms cubic-bezier(0.08, 0.86, 0.05, 1), filter 900ms ease-out`
                                : 'filter 900ms ease-out',
                        }}
                    >
                        {strip.map((item, index) => {
                            const tone = rarityOf(item.mult);
                            const winner = landed && index === WIN_INDEX;

                            return (
                                <div
                                    key={index}
                                    className={cn(
                                        'flex h-24 shrink-0 flex-col items-center justify-center rounded-lg ring-1 transition-all duration-300',
                                        tone.tile,
                                        landed &&
                                            !winner &&
                                            'scale-95 opacity-55',
                                        winner && 'case-land z-10',
                                    )}
                                    style={{
                                        width: TILE,
                                        boxShadow: winner
                                            ? `0 0 0 2px ${accent}, 0 14px 34px -12px ${accent}`
                                            : `inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -12px 20px rgba(0,0,0,0.35), 0 6px 18px -12px ${tone.glow}`,
                                    }}
                                >
                                    <span className="drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]">
                                        <GameIcon glyph={item.emoji} size={26} />
                                    </span>
                                    <span
                                        className={cn(
                                            'mt-1 text-[10px] font-bold',
                                            tone.text,
                                        )}
                                    >
                                        {item.mult.toFixed(2)}x
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-4 flex items-center justify-center gap-3">
                    <div className="relative">
                        {landed && won && (
                            <span
                                aria-hidden
                                className="case-burst pointer-events-none absolute inset-0 rounded-2xl"
                                style={{
                                    background: `radial-gradient(circle, ${accent}aa, transparent 70%)`,
                                }}
                            />
                        )}
                        <div
                            key={landed ? `open-${opened?.label ?? 'x'}` : 'idle'}
                            className={cn(
                                'relative flex size-20 items-center justify-center rounded-2xl bg-black/40 text-4xl ring-1 ring-white/10',
                                landed && 'case-pop',
                            )}
                            style={
                                opened && won
                                    ? {
                                          boxShadow: `0 0 0 2px ${accent}, 0 16px 48px -16px ${accent}`,
                                      }
                                    : undefined
                            }
                        >
                            <GameIcon
                                glyph={opened?.emoji ?? (spinning ? '🎲' : '🎁')}
                                size={44}
                            />
                        </div>
                    </div>
                    <div>
                        <div className="text-sm font-bold">
                            {opened ? (
                                <span style={won ? { color: accent } : undefined}>
                                    {opened.label} · {opened.mult.toFixed(2)}x
                                </span>
                            ) : (
                                <span className="text-dim">
                                    {spinning ? 'Opening…' : 'Ready to open'}
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-dim">
                            {opened && won
                                ? `+${formatCoins(payout ?? 0)} coins`
                                : opened
                                  ? 'Nothing this time'
                                  : `Bet ${formatCoins(bet, 0)} · ${items.length} possible items`}
                        </div>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-5 gap-1.5">
                    {items.map((item) => {
                        const tone = rarityOf(item.mult);

                        return (
                            <div
                                key={item.label}
                                className={cn(
                                    'rounded-lg px-1 py-2 text-center ring-1',
                                    tone.tile,
                                )}
                            >
                                <div className="flex justify-center leading-none">
                                    <GameIcon glyph={item.emoji} size={18} />
                                </div>
                                <div className="mt-1 truncate text-[9px] text-dim">
                                    {item.label}
                                </div>
                                <div
                                    className={cn(
                                        'text-[10px] font-bold',
                                        tone.text,
                                    )}
                                >
                                    {item.mult.toFixed(2)}x
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </OriginalShell>
    );
}

/** Rarity tint by payout, so a legendary item reads as legendary at a glance. */
function rarityOf(mult: number) {
    if (mult >= 8) {
        return {
            tile: 'bg-gradient-to-b from-amber-400/25 to-amber-700/10 ring-amber-300/50',
            text: 'text-amber-200',
            glow: 'rgba(251,191,36,0.85)',
        };
    }
    if (mult >= 3) {
        return {
            tile: 'bg-gradient-to-b from-fuchsia-500/25 to-fuchsia-800/10 ring-fuchsia-400/45',
            text: 'text-fuchsia-200',
            glow: 'rgba(217,70,239,0.8)',
        };
    }
    if (mult >= 1) {
        return {
            tile: 'bg-gradient-to-b from-sky-400/20 to-sky-800/10 ring-sky-300/40',
            text: 'text-sky-200',
            glow: 'rgba(56,189,248,0.7)',
        };
    }

    return {
        tile: 'bg-gradient-to-b from-white/10 to-white/[0.02] ring-white/10',
        text: 'text-white/70',
        glow: 'rgba(255,255,255,0.25)',
    };
}

function fill(items: ArcadeItem[], winner?: ArcadeItem): ArcadeItem[] {
    return Array.from({ length: STRIP }, (_, index) => {
        if (index === WIN_INDEX && winner) {
            return winner;
        }

        return items[Math.floor(Math.random() * items.length)] ?? items[0];
    });
}
