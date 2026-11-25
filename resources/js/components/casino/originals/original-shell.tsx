import { router } from '@inertiajs/react';
import { ChevronLeft, Coins, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { GameIcon } from '@/components/casino/game-icon';
import { GameRail } from '@/components/casino/game-rail';
import { useI18n } from '@/components/casino/language-provider';
import { formatCoins } from '@/lib/casino';
import { cn } from '@/lib/utils';
import type { Game } from '@/types';

type Props = {
    game: Game;
    balance: number;
    bets: number[];
    bet: number;
    onBet: (bet: number) => void;
    playing: boolean;
    /** Keep the bet locked (e.g. while a cash-out round is open). */
    betLocked?: boolean;
    onPlay: () => void;
    playLabel: string;
    /** Block the main action while the round has nothing to pay out yet. */
    playDisabled?: boolean;
    message: string | null;
    children: ReactNode;
    /** Game-specific controls (target slider, risk selectors…) in the side panel. */
    controls?: ReactNode;
    related: Game[];
};

/**
 * Page chrome shared by every game: a betting panel on the left, the game stage
 * on the right. Games only supply the stage and their own controls.
 */
export function OriginalShell({
    game,
    balance,
    bets,
    bet,
    onBet,
    playing,
    betLocked = false,
    onPlay,
    playLabel,
    playDisabled = false,
    message,
    children,
    controls,
    related,
}: Props) {
    const { t } = useI18n();
    const [draft, setDraft] = useState<string | null>(null);

    const minBet = bets[0] ?? 100;
    const ladderMax = bets[bets.length - 1] ?? minBet;
    /* Any amount between the minimum and the table limit is a legal bet; the
     * balance caps it so a spin can never be offered for more than you hold. */
    const maxBet = Math.max(minBet, Math.min(ladderMax, balance));
    const locked = playing || betLocked;

    const clamp = (minor: number) => Math.min(maxBet, Math.max(minBet, Math.round(minor)));

    const accent = game.accent ?? '#bef264';
    const quickBets = Array.from(new Set(bets)).slice(0, 6);

    const onType = (raw: string) => {
        setDraft(raw);

        const coins = Number(raw.replace(/[^\d.]/g, ''));

        if (Number.isFinite(coins) && coins > 0) {
            onBet(clamp(coins * 100));
        }
    };

    const commit = (raw: string) => {
        onType(raw);
        setDraft(null);
    };

    /* A loss can leave the bet above the balance — drop it to one you can afford. */
    useEffect(() => {
        if (bet > maxBet && !locked) {
            onBet(maxBet);
        }
    }, [bet, maxBet, locked, onBet]);

    return (
        <div className="mx-auto w-full max-w-[1200px] px-3 pb-8 md:px-0">
            {/* ------------------------------------------------------- header */}
            <div className="mb-3 flex items-center gap-2.5">
                <button
                    type="button"
                    onClick={() => router.get('/')}
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2/80 text-white ring-1 ring-white/10 transition hover:bg-line active:scale-95"
                    aria-label={t('game.backToLobby')}
                >
                    <ChevronLeft className="size-4" />
                </button>

                <div className="ml-auto flex items-center gap-2.5">
                    <span className="hidden items-center gap-1.5 rounded-xl bg-surface/80 px-3 py-1.5 text-xs font-bold ring-1 ring-white/10 sm:flex">
                        <Coins className="size-3.5 text-lime" />
                        {formatCoins(balance)}
                    </span>

                    <button
                        type="button"
                        onClick={() => router.get('/')}
                        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2/80 text-dim ring-1 ring-white/10 transition hover:bg-line hover:text-white active:scale-95"
                        aria-label={t('game.closeGame')}
                    >
                        <X className="size-4" />
                    </button>
                </div>
            </div>

            <div className="grid w-full min-w-0 gap-3 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start lg:gap-4">
                {/* ---------------------------------------------------- controls */}
                <aside className="order-2 min-w-0 lg:sticky lg:top-3 lg:order-1">
                    <div className="rounded-3xl bg-[linear-gradient(180deg,rgba(35,42,54,0.94),rgba(22,27,36,0.97))] p-3 shadow-[0_30px_70px_-40px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.08] backdrop-blur-sm">
                        <div className="mb-1.5 flex items-center justify-between">
                            <span className="text-[10px] font-bold tracking-[0.16em] text-dim uppercase">
                                {t('common.betAmount')}
                            </span>
                            <span className="text-[10px] font-bold text-dim">
                                {t('common.max')}{' '}
                                <b className="text-white/80">
                                    {formatCoins(maxBet, 0)}
                                </b>
                            </span>
                        </div>

                        <div
                            className="mb-2 flex items-center gap-1 rounded-2xl bg-black/45 p-1 ring-1 ring-white/10 transition focus-within:ring-white/25"
                            style={{ boxShadow: `inset 0 0 0 1px rgba(0,0,0,0.35)` }}
                        >
                            <span className="pl-2">
                                <GameIcon glyph="🪙" size={16} />
                            </span>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={draft ?? formatCoins(bet, 0)}
                                onChange={(event) => onType(event.target.value)}
                                onBlur={(event) => commit(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        commit(event.currentTarget.value);
                                        event.currentTarget.blur();
                                    }
                                }}
                                disabled={locked}
                                aria-label={t('common.betAmount')}
                                className="min-w-0 flex-1 bg-transparent px-1.5 py-1.5 text-lg font-black tabular-nums text-white outline-none disabled:opacity-60"
                            />
                            <button
                                type="button"
                                onClick={() => onBet(clamp(Math.floor(bet / 2)))}
                                disabled={locked || bet <= minBet}
                                className="rounded-xl bg-white/[0.05] px-2.5 py-1.5 text-[11px] font-bold text-white/80 ring-1 ring-white/10 transition hover:bg-white/15 hover:text-white active:scale-95 disabled:opacity-40"
                            >
                                ½
                            </button>
                            <button
                                type="button"
                                onClick={() => onBet(clamp(bet * 2))}
                                disabled={locked || bet >= maxBet}
                                className="rounded-xl bg-white/[0.05] px-2.5 py-1.5 text-[11px] font-bold text-white/80 ring-1 ring-white/10 transition hover:bg-white/15 hover:text-white active:scale-95 disabled:opacity-40"
                            >
                                2×
                            </button>
                            <button
                                type="button"
                                onClick={() => onBet(maxBet)}
                                disabled={locked || bet >= maxBet}
                                className="rounded-xl bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-bold text-white/80 ring-1 ring-white/10 transition hover:bg-white/15 active:scale-95 disabled:opacity-40"
                            >
                                {t('common.max')}
                            </button>
                        </div>

                        <div className="mb-3 grid grid-cols-3 gap-1.5">
                            {quickBets.map((value) => {
                                const active = bet === value;

                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => onBet(clamp(value))}
                                        disabled={locked || value > maxBet}
                                        className={cn(
                                            'rounded-xl py-1.5 text-[11px] font-bold tabular-nums ring-1 transition',
                                            active
                                                ? 'text-black'
                                                : 'bg-black/30 text-white/65 ring-white/[0.07] hover:bg-white/[0.07] hover:text-white',
                                        )}
                                        style={
                                            active
                                                ? {
                                                      background: `linear-gradient(180deg, ${accent}, ${accent}c9)`,
                                                      boxShadow: `0 10px 22px -14px ${accent}`,
                                                      borderColor: 'transparent',
                                                  }
                                                : undefined
                                        }
                                    >
                                        {formatCoins(value, 0)}
                                    </button>
                                );
                            })}
                        </div>

                        {controls && (
                            <div className="mb-3 space-y-2 border-t border-white/[0.07] pt-3">
                                {controls}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={onPlay}
                            disabled={playing || bet <= 0 || playDisabled}
                            className={cn(
                                'group relative w-full overflow-hidden rounded-2xl py-4 text-sm font-extrabold tracking-[0.08em] uppercase',
                                'bg-[linear-gradient(180deg,#e9fdc1_0%,#bef264_44%,#84cc16_100%)] text-lime-ink',
                                'shadow-[0_18px_34px_-14px_rgba(190,242,100,0.85),inset_0_1px_0_rgba(255,255,255,0.75),inset_0_-2px_0_rgba(0,0,0,0.22)]',
                                'ring-1 ring-lime-200/40 transition duration-150',
                                'hover:brightness-105 active:translate-y-px active:brightness-95',
                                'disabled:opacity-60 disabled:hover:brightness-100 disabled:active:translate-y-0',
                            )}
                        >
                            <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-[linear-gradient(180deg,rgba(255,255,255,0.4),transparent)]" />
                            <span className="relative">
                                {playing ? t('common.playing') : playLabel}
                            </span>
                        </button>

                        {message && (
                            <p className="mt-2 rounded-xl bg-amber-300/10 px-2.5 py-1.5 text-center text-xs font-semibold text-amber-300 ring-1 ring-amber-300/20">
                                {message}
                            </p>
                        )}

                    </div>
                </aside>

                {/* ------------------------------------------------------- stage */}
                <section
                    className={cn(
                        'relative order-1 min-w-0 overflow-hidden rounded-3xl bg-background ring-1 ring-line/60 lg:order-2',
                        'min-h-[360px] shadow-[0_40px_90px_-50px_rgba(0,0,0,0.95)] lg:min-h-[520px]',
                    )}
                >
                    <div className="relative flex h-full min-h-[inherit] flex-col justify-center p-4 md:p-7">
                        {children}
                    </div>
                </section>
            </div>

            <div className="mt-4">
                <GameRail
                    title={t('game.moreGames')}
                    icon={Sparkles}
                    games={related}
                />
            </div>
        </div>
    );
}
