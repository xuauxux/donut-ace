import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { ArcadeOption } from '@/types';

type BoardProps = {
    options: ArcadeOption[];
    drawnId: string | null;
    accent: string;
    pick: string | null;
    onPick: (id: string) => void;
    disabled: boolean;
};

/* ------------------------------------------------------------------ darts */

/** Dart lands at -38° from the centre, one point per ring depth. */
function dartPoint(index: number) {
    const radius = [0, 33, 53][index] ?? 53;
    const angle = (-38 * Math.PI) / 180;

    return {
        x: 100 + radius * Math.cos(angle),
        y: 100 + radius * Math.sin(angle),
    };
}

export function DartsBoard({
    options,
    drawnId,
    accent,
    pick,
    onPick,
    disabled,
}: BoardProps) {
    const rings = options.slice(0, 3);
    const dartIndex = rings.findIndex((option) => option.id === drawnId);
    const landing = dartIndex >= 0 ? dartPoint(dartIndex) : { x: 168, y: 3 };
    const picked = rings.find((option) => option.id === pick) ?? null;
    const drawn = rings.find((option) => option.id === drawnId) ?? null;
    /* The arcade pays 0.99 / probability, so the chance is exactly 99 / price. */
    const chance = (mult: number) => Math.max(1, Math.round(99 / Math.max(0.01, mult)));

    return (
        <div className="mx-auto w-full max-w-md">
            <div className="mb-3 text-center">
                <h3 className="text-sm font-black text-white sm:text-base">
                    {drawnId ? 'Where did it land?' : 'Back one ring'}
                </h3>
                <p className="mx-auto mt-1 max-w-[19rem] text-xs leading-relaxed text-dim">
                    The dart lands in one random ring. Pick the ring it will hit and
                    your bet pays that ring's price.
                </p>
            </div>

            <div className="relative mx-auto aspect-square w-full max-w-[360px] lg:max-w-[400px]">
                <svg
                    viewBox="0 0 200 200"
                    className="size-full drop-shadow-[0_22px_46px_rgba(0,0,0,0.55)]"
                >
                    <circle cx="100" cy="100" r="74" fill="#0e131b" stroke="rgba(255,255,255,0.09)" />

                    {/* Board wires: twenty thin sectors for dartboard texture. */}
                    <g stroke="rgba(255,255,255,0.05)" strokeWidth="0.7">
                        {Array.from({ length: 20 }).map((_, i) => {
                            const a = (i * 18 * Math.PI) / 180;

                            return (
                                <line
                                    key={i}
                                    x1={100 + 18 * Math.cos(a)}
                                    y1={100 + 18 * Math.sin(a)}
                                    x2={100 + 70 * Math.cos(a)}
                                    y2={100 + 70 * Math.sin(a)}
                                />
                            );
                        })}
                    </g>

                    {rings.map((option, index) => {
                        const r = [22, 44, 62][index] ?? 62;
                        const selected = pick === option.id;
                        const isDrawn = drawnId === option.id;
                        const base =
                            index === 0
                                ? '#7f1d1d'
                                : index === 1
                                  ? 'rgba(255,255,255,0.14)'
                                  : 'rgba(255,255,255,0.07)';

                        return (
                            <g
                                key={option.id}
                                role="button"
                                tabIndex={disabled ? -1 : 0}
                                aria-pressed={selected}
                                aria-label={`${option.label}, pays ${option.mult.toFixed(2)} times`}
                                onClick={() => !disabled && onPick(option.id)}
                                onKeyDown={(event) => {
                                    if (
                                        !disabled &&
                                        (event.key === 'Enter' ||
                                            event.key === ' ')
                                    ) {
                                        event.preventDefault();
                                        onPick(option.id);
                                    }
                                }}
                                className={cn(
                                    'outline-none',
                                    disabled
                                        ? 'cursor-default'
                                        : 'cursor-pointer',
                                )}
                            >
                                <circle
                                    cx="100"
                                    cy="100"
                                    r={r}
                                    fill={isDrawn ? accent : base}
                                    stroke={
                                        selected
                                            ? accent
                                            : 'rgba(0,0,0,0.45)'
                                    }
                                    strokeWidth={selected ? 2.4 : 0.9}
                                    className="transition-[fill,stroke] duration-200"
                                />
                                <text
                                    x="100"
                                    y={100 - (index === 0 ? 0 : r - 6)}
                                    dy={index === 0 ? 2 : 0}
                                    textAnchor="middle"
                                    fontSize={index === 0 ? 7.4 : 6.1}
                                    fontWeight="800"
                                    fill={
                                        isDrawn || index === 0
                                            ? 'rgba(255,255,255,0.92)'
                                            : 'rgba(255,255,255,0.7)'
                                    }
                                >
                                    {option.mult.toFixed(2)}x
                                </text>
                                <text
                                    x="100"
                                    y={index === 0 ? 106.5 : 100 - (r - 6) + 6}
                                    textAnchor="middle"
                                    fontSize={index === 0 ? 3.6 : 4.1}
                                    fontWeight="700"
                                    letterSpacing="0.4"
                                    fill={
                                        isDrawn
                                            ? 'rgba(11,14,19,0.7)'
                                            : 'rgba(255,255,255,0.4)'
                                    }
                                >
                                    {option.label.toUpperCase()}
                                </text>
                            </g>
                        );
                    })}

                    {/* The dart: needle tip sits on the landing point. */}
                    <g
                        style={{
                            transform: `translate(${landing.x}px, ${landing.y}px)`,
                            transition:
                                'transform 620ms cubic-bezier(0.2, 0.9, 0.25, 1)',
                        }}
                    >
                        <line
                            x1="0"
                            y1="0"
                            x2="13"
                            y2="13"
                            stroke="#cbd5e1"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                        />
                        <path
                            d="M13 13l9 1.5-2.5 6.5z"
                            fill={accent}
                        />
                        <path
                            d="M13 13l1.5 9-6.5-2.5z"
                            fill={accent}
                            opacity="0.7"
                        />
                    </g>
                </svg>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
                {rings.map((option, index) => {
                    const selected = pick === option.id;
                    const isDrawn = drawnId === option.id;
                    const tone = ['#e04747', 'rgba(255,255,255,0.75)', 'rgba(255,255,255,0.3)'][index];

                    return (
                        <button
                            key={option.id}
                            type="button"
                            disabled={disabled}
                            aria-pressed={selected}
                            onClick={() => onPick(option.id)}
                            className={cn(
                                'flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2 transition',
                                selected
                                    ? 'border-transparent text-black'
                                    : isDrawn
                                      ? 'border-white/40 bg-white/[0.1] text-white'
                                      : 'border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]',
                                disabled && 'cursor-not-allowed opacity-70',
                            )}
                            style={
                                selected
                                    ? {
                                          background: accent,
                                          boxShadow: `0 10px 22px -12px ${accent}`,
                                      }
                                    : undefined
                            }
                        >
                            <span className="flex items-center gap-1 text-[11px] font-black">
                                <span
                                    className="size-2 rounded-full ring-1 ring-black/40"
                                    style={{ background: tone }}
                                />
                                {option.label}
                            </span>
                            <span
                                className={cn(
                                    'text-[10px] font-semibold tabular-nums',
                                    selected ? 'text-black/70' : 'text-white/45',
                                )}
                            >
                                {chance(option.mult)}% · {option.mult.toFixed(2)}×
                            </span>
                        </button>
                    );
                })}
            </div>

            <p className="mt-3 text-center text-[11px] leading-relaxed text-dim">
                {drawn
                    ? picked && picked.id === drawn.id
                        ? `Dart landed in ${drawn.label} — you called it.`
                        : `Dart landed in ${drawn.label}${picked ? `; you backed ${picked.label}` : ''}.`
                    : picked
                      ? `Backed ${picked.label}: ${chance(picked.mult)}% chance, pays ${picked.mult.toFixed(2)}×.`
                      : 'Pick a ring above or on the board before you throw.'}
            </p>
        </div>
    );
}

/* ------------------------------------------------------------------ gems */

const GEM_COLOURS: Record<string, string> = {
    ruby: '#e11d48',
    sapphire: '#2563eb',
    emerald: '#059669',
    amethyst: '#7c3aed',
    citrine: '#eab308',
};

function GemArt({ colour }: { colour: string }) {
    return (
        <svg viewBox="0 0 64 64" className="size-full">
            <polygon points="32,2 54,21 32,62 10,21" fill={colour} />
            <polygon points="32,2 54,21 32,21" fill="#ffffff" opacity="0.34" />
            <polygon points="32,2 10,21 32,21" fill="#ffffff" opacity="0.16" />
            <polygon points="10,21 54,21 32,62" fill="#000000" opacity="0.22" />
            <polygon
                points="32,2 54,21 32,62 10,21"
                fill="none"
                stroke="rgba(255,255,255,0.45)"
                strokeWidth="1"
            />
        </svg>
    );
}

export function GemsBoard({
    options,
    drawnId,
    accent,
    pick,
    onPick,
    disabled,
}: BoardProps) {
    return (
        <div className="mx-auto w-full max-w-lg">
            <div className="mb-3 text-center">
                <h3 className="text-sm font-black text-white sm:text-base">
                    {drawnId ? 'The stone shines' : 'Pick your stone'}
                </h3>
                <p className="mt-1 text-xs text-dim">
                    {drawnId
                        ? 'Only the drawn stone pays.'
                        : 'Tap a stone to back it — the draw reveals one.'}
                </p>
            </div>

            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                {options.map((option) => {
                    const selected = pick === option.id;
                    const isDrawn = drawnId === option.id;
                    const faded = drawnId !== null && !isDrawn;
                    const colour =
                        GEM_COLOURS[option.id] ?? accent;

                    return (
                        <button
                            key={option.id}
                            type="button"
                            disabled={disabled}
                            aria-pressed={selected}
                            onClick={() => onPick(option.id)}
                            className={cn(
                                'group flex flex-col items-center gap-1 rounded-xl bg-black/30 px-1 py-3 ring-1 ring-white/[0.07] transition-all duration-150 sm:gap-2 sm:rounded-2xl sm:py-4',
                                !disabled &&
                                    'hover:-translate-y-0.5 hover:bg-white/[0.05]',
                                faded && 'opacity-40',
                                'disabled:hover:translate-y-0 disabled:hover:bg-black/30',
                            )}
                            style={{
                                boxShadow: isDrawn
                                    ? `0 0 0 2px ${accent}, 0 18px 40px -18px ${accent}`
                                    : selected
                                      ? `0 0 0 2px ${accent}88, inset 0 0 0 1px rgba(255,255,255,0.06)`
                                      : undefined,
                                background: selected
                                    ? `${accent}12`
                                    : undefined,
                            }}
                        >
                            <span
                                className="relative block size-10 transition-transform duration-200 group-hover:scale-105 sm:size-14"
                                style={{
                                    filter: isDrawn
                                        ? `drop-shadow(0 0 10px ${colour})`
                                        : 'none',
                                }}
                            >
                                <GemArt colour={colour} />
                                {selected && (
                                    <span
                                        className="absolute -top-1 -right-1 size-2 rounded-full ring-2 ring-black/40"
                                        style={{ background: accent }}
                                    />
                                )}
                            </span>
                            <span className="w-full truncate text-center text-[9px] font-bold text-white/85 sm:text-[11px]">
                                {option.label}
                            </span>
                            <span
                                className="text-[9px] font-bold tabular-nums sm:text-[10px]"
                                style={{
                                    color: isDrawn ? accent : '#94a3b8',
                                }}
                            >
                                {option.mult.toFixed(2)}x
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
