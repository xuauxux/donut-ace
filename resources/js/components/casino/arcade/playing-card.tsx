import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

export type Suit = '♠' | '♥' | '♦' | '♣';

export type Card = {
    rank: string;
    suit: Suit;
};

export const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];

export function isRed(suit: Suit) {
    return suit === '♥' || suit === '♦';
}

/** Pip placement per rank on a 3 × 5 grid, in percent of the card face. */
const PIPS: Record<string, [number, number][]> = {
    '2': [
        [0, 0],
        [0, 4],
    ],
    '3': [
        [0, 0],
        [1, 2],
        [0, 4],
    ],
    '4': [
        [0, 0],
        [2, 0],
        [0, 4],
        [2, 4],
    ],
    '5': [
        [0, 0],
        [2, 0],
        [1, 2],
        [0, 4],
        [2, 4],
    ],
    '6': [
        [0, 0],
        [2, 0],
        [0, 2],
        [2, 2],
        [0, 4],
        [2, 4],
    ],
    '7': [
        [0, 0],
        [2, 0],
        [1, 1],
        [0, 2],
        [2, 2],
        [0, 4],
        [2, 4],
    ],
    '8': [
        [0, 0],
        [2, 0],
        [1, 1],
        [0, 2],
        [2, 2],
        [1, 3],
        [0, 4],
        [2, 4],
    ],
    '9': [
        [0, 0],
        [2, 0],
        [0, 1.35],
        [2, 1.35],
        [1, 2],
        [0, 2.65],
        [2, 2.65],
        [0, 4],
        [2, 4],
    ],
    '10': [
        [0, 0],
        [2, 0],
        [1, 1],
        [0, 1.35],
        [2, 1.35],
        [0, 2.65],
        [2, 2.65],
        [1, 3],
        [0, 4],
        [2, 4],
    ],
};

type Props = {
    card: Card;
    faceDown?: boolean;
    /** Slightly recessed, for cards that are not part of the live hand. */
    muted?: boolean;
    className?: string;
    style?: CSSProperties;
};

/**
 * A drawn playing card: warm paper stock, printed keyline, standard pip layout,
 * mirrored court panels and a patterned house back. Flips when it turns over.
 */
export function PlayingCard({
    card,
    faceDown = false,
    muted = false,
    className,
    style,
}: Props) {
    /* Only animate a card that actually turns over — not one dealt face up. */
    const wasDown = useRef(faceDown);
    const turned = wasDown.current && !faceDown;

    useEffect(() => {
        wasDown.current = faceDown;
    }, [faceDown]);

    return (
        <div
            className={cn(
                'relative aspect-[5/7] w-[96px] select-none [perspective:900px]',
                muted && 'opacity-55 saturate-75',
                className,
            )}
            style={style}
            aria-label={
                faceDown ? 'Face-down card' : `${card.rank} of ${suitName(card.suit)}`
            }
        >
            <div
                className="card-deal absolute inset-0 overflow-hidden rounded-[11px] ring-1 ring-black/55"
                style={{
                    boxShadow:
                        '0 22px 38px -18px rgba(0,0,0,0.95), 0 2px 0 rgba(255,255,255,0.55) inset, 0 -1px 0 rgba(120,105,80,0.25) inset',
                }}
            >
                <div
                    key={faceDown ? 'back' : 'face'}
                    className={cn('absolute inset-0', turned && 'card-flip-in')}
                >
                    {faceDown ? <CardBack /> : <CardFace card={card} />}
                </div>
            </div>
        </div>
    );
}

function CardFace({ card }: { card: Card }) {
    const red = isRed(card.suit);
    const ink = red ? '#c1121f' : '#12161d';
    const court = card.rank === 'J' || card.rank === 'Q' || card.rank === 'K';
    const pips = PIPS[card.rank];

    return (
        <div className="absolute inset-0 bg-[linear-gradient(158deg,#fffefc_0%,#fefcf7_48%,#f6f2e8_100%)]">
            {/* paper grain */}
            <div className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:repeating-linear-gradient(48deg,#000_0_1px,transparent_1px_3px)]" />
            {/* printed keyline */}
            <div className="pointer-events-none absolute inset-[4px] rounded-[7px] ring-1 ring-black/[0.08]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-[11px] bg-[linear-gradient(180deg,rgba(255,255,255,0.85),transparent)]" />

            {/* faint suit watermark behind the pips */}
            <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center text-[86px] leading-none opacity-[0.03]"
                style={{ color: ink }}
            >
                {card.suit}
            </div>

            <CornerIndex rank={card.rank} suit={card.suit} ink={ink} />

            {court ? (
                <CourtPanel card={card} ink={ink} />
            ) : card.rank === 'A' ? (
                <AceFace suit={card.suit} ink={ink} />
            ) : (
                <div className="absolute inset-x-[16%] inset-y-[9%]">
                    {(pips ?? []).map(([col, row], index) => (
                        <span
                            key={`${col}-${row}-${index}`}
                            className={cn(
                                'absolute leading-none',
                                (pips?.length ?? 0) <= 2
                                    ? 'text-[24px] sm:text-[30px]'
                                    : (pips?.length ?? 0) <= 4
                                      ? 'text-[20px] sm:text-[25px]'
                                      : (pips?.length ?? 0) <= 6
                                        ? 'text-[17px] sm:text-[21px]'
                                        : 'text-[15px] sm:text-[18px]',
                            )}
                            style={{
                                color: ink,
                                left: `${18 + col * 32}%`,
                                top: `${12 + row * 19}%`,
                                transform: `translate(-50%, -50%)${row > 2 ? ' rotate(180deg)' : ''}`,
                                filter: 'drop-shadow(0 1px 0 rgba(255,255,255,0.75))',
                            }}
                        >
                            {card.suit}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

function CornerIndex({ rank, suit, ink }: { rank: string; suit: Suit; ink: string }) {
    return (
        <>
            <div
                className="absolute top-[5px] left-[6px] flex flex-col items-center leading-none"
                style={{ color: ink }}
            >
                <span className="font-serif text-[15px] font-bold tracking-tight sm:text-[18px]">
                    {rank}
                </span>
                <span className="text-[12px] leading-none sm:text-[14px]">{suit}</span>
            </div>
            <div
                className="absolute right-[6px] bottom-[5px] flex rotate-180 flex-col items-center leading-none"
                style={{ color: ink }}
            >
                <span className="font-serif text-[15px] font-bold tracking-tight sm:text-[18px]">
                    {rank}
                </span>
                <span className="text-[12px] leading-none sm:text-[14px]">{suit}</span>
            </div>
        </>
    );
}

/** Ace: one oversized pip inside a roughened diamond, the way aces are cut. */
function AceFace({ suit, ink }: { suit: Suit; ink: string }) {
    return (
        <div className="absolute inset-0 flex items-center justify-center">
            <div
                className="absolute size-[46%] rotate-45 rounded-[3px]"
                style={{ border: `1px solid ${ink}26` }}
            />
            <div
                className="absolute size-[38%] rotate-45 rounded-[2px]"
                style={{ border: `1px solid ${ink}12` }}
            />
            <span
                className="relative text-[46px] leading-none sm:text-[58px]"
                style={{ color: ink, filter: 'drop-shadow(0 1px 0 rgba(255,255,255,0.8))' }}
            >
                {suit}
            </span>
        </div>
    );
}

/** J/Q/K: two mirrored court halves inside a decorated frame. */
function CourtPanel({ card, ink }: { card: Card; ink: string }) {
    const crown = card.rank === 'K' ? '♛' : card.rank === 'Q' ? '♕' : '♞';

    return (
        <div
            className="absolute inset-x-[17.5%] inset-y-[9%] overflow-hidden rounded-[5px]"
            style={{
                border: `1px solid ${ink}4d`,
                boxShadow: `inset 0 0 0 1.5px ${ink}12`,
                background:
                    'linear-gradient(180deg, rgba(0,0,0,0.03), rgba(255,255,255,0.4) 50%, rgba(0,0,0,0.035))',
            }}
        >
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.06]"
                style={{
                    backgroundImage: `repeating-linear-gradient(45deg, ${ink} 0 1px, transparent 1px 5px)`,
                }}
            />
            <div
                className="relative flex h-[49.5%] rotate-180 flex-col items-center justify-center leading-none gap-[1px]"
                style={{ color: ink }}
            >
                <span className="text-[9px] leading-none opacity-70">{crown}</span>
                <span className="font-serif text-[19px] leading-none font-bold sm:text-[23px]">
                    {card.rank}
                </span>
                <span className="text-[12px] leading-none">{card.suit}</span>
            </div>

            <div className="relative flex h-[1%] items-center justify-center">
                <span
                    className="absolute inset-x-3 h-px"
                    style={{ background: `${ink}2e` }}
                />
                <span
                    className="relative flex size-[14px] items-center justify-center rounded-full bg-[#fdfbf5] text-[8px] leading-none"
                    style={{ color: `${ink}bb`, boxShadow: `0 0 0 1px ${ink}26` }}
                >
                    {card.suit}
                </span>
            </div>

            <div
                className="relative flex h-[49.5%] flex-col items-center justify-center leading-none gap-[1px]"
                style={{ color: ink }}
            >
                <span className="text-[12px] leading-none">{card.suit}</span>
                <span className="font-serif text-[19px] leading-none font-bold sm:text-[23px]">
                    {card.rank}
                </span>
                <span className="text-[9px] leading-none opacity-70">{crown}</span>
            </div>
        </div>
    );
}

function CardBack() {
    return (
        <div className="absolute inset-0 bg-[#0d1524]">
            <div className="absolute inset-[3px] rounded-[8px] bg-[linear-gradient(160deg,#1b2740,#121a2b_60%,#0f1725)] ring-1 ring-lime/25" />

            {/* guilloche lattice */}
            <div
                className="absolute inset-[7px] rounded-[6px] opacity-80"
                style={{
                    backgroundImage:
                        'repeating-linear-gradient(45deg, rgba(201,247,58,0.20) 0 1.5px, transparent 1.5px 7px), repeating-linear-gradient(-45deg, rgba(120,170,255,0.16) 0 1.5px, transparent 1.5px 7px)',
                }}
            />
            <div className="absolute inset-[11px] rounded-[4px] ring-1 ring-lime/20" />

            {/* centre medallion */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-[#0d1524] ring-1 ring-lime/45">
                    <div className="flex size-6 items-center justify-center rounded-full ring-2 ring-lime/80">
                        <span className="size-1.5 rounded-full bg-lime/80" />
                    </div>
                </div>
            </div>

            {/* gloss */}
            <div className="pointer-events-none absolute inset-0 rounded-[11px] bg-[linear-gradient(135deg,rgba(255,255,255,0.14),transparent_42%)]" />
        </div>
    );
}

export function suitName(suit: Suit) {
    return suit === '♠'
        ? 'spades'
        : suit === '♥'
            ? 'hearts'
            : suit === '♦'
                ? 'diamonds'
                : 'clubs';
}
