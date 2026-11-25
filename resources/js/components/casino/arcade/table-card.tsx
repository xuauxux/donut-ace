import { cn } from '@/lib/utils';
import type { PlayingCardData } from '@/types';

/* Sizes only fix the width; the PNG keeps its 5:7 card proportions. */
const SIZES = {
    sm: { card: 'w-[58px]' },
    md: { card: 'w-[96px]' },
    lg: { card: 'w-[136px]' },
};

const RANK_FILE: Record<string, string> = {
    A: 'ace',
    J: 'jack',
    Q: 'queen',
    K: 'king',
};

type BackTone = 'blue' | 'red';

const BACK_FILE: Record<BackTone, string> = {
    blue: '/images/cards/back-blue.png',
    red: '/images/cards/back-red.png',
};

function faceFile(card: PlayingCardData): string {
    const rank = RANK_FILE[card.rank] ?? card.rank;

    return `/images/cards/${card.suit}/${rank}.png`;
}

/**
 * A table card backed by the CC0 public-domain deck. Images keep their native
 * 5:7 proportions, so faces and backs stay sharp at every table size.
 */
export function TableCard({
    card,
    faceDown = false,
    size = 'md',
    className,
    highlight = false,
    tilt = false,
    backTone = 'blue',
}: {
    card?: PlayingCardData | null;
    faceDown?: boolean;
    size?: keyof typeof SIZES;
    className?: string;
    highlight?: boolean;
    tilt?: boolean;
    backTone?: BackTone;
}) {
    const s = SIZES[size];
    const ring = highlight
        ? 'ring-2 ring-lime shadow-[0_0_34px_-8px_rgba(190,242,100,0.9)]'
        : 'ring-1 ring-white/15';
    const src = faceDown || !card ? BACK_FILE[backTone] : faceFile(card);

    return (
        <div
            className={cn(
                'relative aspect-[5/7] shrink-0 select-none overflow-hidden rounded-lg bg-white transition',
                s.card,
                ring,
                tilt && 'rotate-6',
                className,
            )}
            aria-label={faceDown ? 'Face-down card' : `${card?.rank ?? 'A'} of ${card?.suit ?? 'spades'}`}
        >
            <img
                src={src}
                alt=""
                draggable={false}
                className="absolute inset-0 h-full w-full object-fill"
            />
        </div>
    );
}
