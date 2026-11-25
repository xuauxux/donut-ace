import { GameIcon } from '@/components/casino/game-icon';
import { cn } from '@/lib/utils';
import type { ArcadeOption } from '@/types';

/** Market chips shared by the table games (roulette, dice). */
export function BetChips({
    options,
    selected,
    onSelect,
    disabled,
    accent,
}: {
    options: ArcadeOption[];
    selected: string;
    onSelect: (id: string) => void;
    disabled: boolean;
    accent: string;
}) {
    return (
        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            {options.map((option) => {
                const active = selected === option.id;

                return (
                    <button
                        key={option.id}
                        type="button"
                        disabled={disabled}
                        aria-pressed={active}
                        onClick={() => onSelect(option.id)}
                        className={cn(
                            'group relative flex min-w-[7rem] items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-2.5',
                            'text-sm font-extrabold transition-all duration-150',
                            'disabled:cursor-not-allowed disabled:opacity-55',
                            active
                                ? 'text-black'
                                : 'bg-white/[0.04] text-white ring-1 ring-white/12',
                            active &&
                                'shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-2px_0_rgba(0,0,0,0.18)]',
                            !active &&
                                'hover:-translate-y-0.5 hover:bg-white/[0.09] hover:ring-white/25 active:translate-y-0',
                        )}
                        style={
                            active
                                ? {
                                      background: `linear-gradient(180deg, ${accent}, ${accent}cc)`,
                                      boxShadow: `0 12px 26px -12px ${accent}, 0 0 0 1px ${accent}66, inset 0 1px 0 rgba(255,255,255,0.55)`,
                                  }
                                : undefined
                        }
                    >
                        {active && (
                            <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-[linear-gradient(180deg,rgba(255,255,255,0.42),transparent)]" />
                        )}
                        <span className="relative flex items-center leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]">
                            <GameIcon glyph={option.emoji} size={16} />
                        </span>
                        <span className="relative">{option.label}</span>
                        <span
                            className={cn(
                                'relative rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums',
                                active
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
    );
}
