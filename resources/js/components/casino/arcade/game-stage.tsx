import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
    accent?: string | null;
    background?: [string, string] | null;
    className?: string;
    children: ReactNode;
    /** Texture laid over the felt: woven cloth, a light fan, or a fine grid. */
    pattern?: 'felt' | 'rays' | 'grid';
    /** Big, faint print in the middle of the felt — the game's own emblem. */
    emblem?: string | null;
    /** No table panel at all: the app's default background shows through. */
    plain?: boolean;
};

/**
 * The table frame every arcade stage sits in: an accent-tinted rim, woven felt
 * in the game's own colours, a soft spotlight and gold corner marks. Games keep
 * their own furniture — this is just the table they stand on.
 */
export function GameStage({
    accent = '#bef264',
    background,
    className,
    children,
    pattern = 'felt',
    emblem,
    plain = false,
}: Props) {
    const top = background?.[0] ?? '#0e1219';
    const bottom = background?.[1] ?? '#080a0f';

    const texture =
        pattern === 'grid'
            ? 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)'
            : pattern === 'rays'
              ? `repeating-conic-gradient(from 0deg at 50% -10%, ${accent}12 0deg 6deg, transparent 6deg 12deg)`
              : 'repeating-linear-gradient(45deg, rgba(255,255,255,0.018) 0 2px, transparent 2px 4px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.05) 0 2px, transparent 2px 4px)';

    return (
        <div
            className={cn(
                'relative overflow-hidden rounded-[22px]',
                !plain && 'p-px shadow-[0_30px_70px_-34px_rgba(0,0,0,0.95)]',
            )}
            style={
                plain
                    ? undefined
                    : {
                          background: `linear-gradient(155deg, ${accent}88 0%, rgba(255,255,255,0.09) 20%, rgba(0,0,0,0.55) 58%, ${accent}30 100%)`,
                      }
            }
        >
            <div
                className={cn('relative overflow-hidden rounded-[21px]', className)}
                style={
                    plain
                        ? undefined
                        : {
                              background: `radial-gradient(125% 95% at 50% -12%, ${top} 0%, ${bottom} 62%, #05070b 100%)`,
                              boxShadow:
                                  'inset 0 1px 0 rgba(255,255,255,0.07), inset 0 0 0 1px rgba(255,255,255,0.045), inset 0 -46px 80px -46px #000',
                          }
                }
            >
                {!plain && (
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 opacity-60"
                        style={{
                            backgroundImage: texture,
                            backgroundSize: pattern === 'grid' ? '26px 26px' : undefined,
                        }}
                    />
                )}

                {!plain && (
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 top-0 h-44"
                        style={{
                            background: `radial-gradient(62% 100% at 50% 0%, ${accent}22, transparent 72%)`,
                        }}
                    />
                )}

                {!plain && (
                    <span
                        aria-hidden
                        className="pointer-events-none absolute inset-x-12 top-0 h-px"
                        style={{
                            background: `linear-gradient(90deg, transparent, ${accent}aa, transparent)`,
                        }}
                    />
                )}

                {!plain && emblem ? (
                    <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10rem] leading-none opacity-[0.07] select-none"
                        style={{ filter: 'grayscale(1)' }}
                    >
                        {emblem}
                    </span>
                ) : null}

                {!plain &&
                    [
                        'top-2.5 left-2.5 border-t border-l',
                        'top-2.5 right-2.5 border-t border-r',
                        'bottom-2.5 left-2.5 border-b border-l',
                        'bottom-2.5 right-2.5 border-b border-r',
                    ].map((position) => (
                        <span
                            key={position}
                            aria-hidden
                            className={cn('pointer-events-none absolute size-3', position)}
                            style={{ borderColor: `${accent}55` }}
                        />
                    ))}

                <div className="relative">{children}</div>
            </div>
        </div>
    );
}
