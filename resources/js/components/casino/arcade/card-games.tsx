import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { PlayingCard, SUITS } from '@/components/casino/arcade/playing-card';
import type { Card } from '@/components/casino/arcade/playing-card';
import { cn } from '@/lib/utils';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/** Small seeded PRNG so a deal does not reshuffle on every render. */
function mulberry32(seed: number) {
    let state = seed >>> 0;

    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function cardFromIndex(index: number, rng: () => number): Card {
    return {
        rank: RANKS[Math.max(0, Math.min(12, index))],
        suit: SUITS[Math.floor(rng() * SUITS.length)],
    };
}

function rankValue(rank: string) {
    return RANKS.indexOf(rank);
}

/* -------------------------------------------------------------------- HiLo */

/**
 * HiLo: one card is on the table and the next one is either higher or lower.
 * The server decides which way it went, so the second card is dealt to match.
 */
export function HiLoBoard({
    drawnId,
    revealing,
    token,
    accent,
    pick,
}: {
    drawnId: string | null;
    revealing: boolean;
    token: number;
    accent: string;
    pick: string;
}) {
    /* Start between 3 and J so a higher *and* a lower card always exist. */
    const current = useMemo(
        () => cardFromIndex(2 + Math.floor(mulberry32(token * 17 + 5)() * 9), mulberry32(token * 3 + 1)),
        [token],
    );

    const next = useMemo(() => {
        if (!drawnId) {
            return null;
        }

        const rng = mulberry32(token * 31 + (drawnId === 'higher' ? 11 : 23));
        const value = rankValue(current.rank);
        const pool: number[] = [];

        if (drawnId === 'higher') {
            for (let i = value + 1; i < RANKS.length; i++) pool.push(i);
        } else {
            for (let i = 0; i < value; i++) pool.push(i);
        }

        return cardFromIndex(pool[Math.floor(rng() * pool.length)] ?? value, rng);
    }, [current, drawnId, token]);

    const higher = drawnId === 'higher';
    const shown = next !== null && !revealing;
    const called = drawnId === pick;

    return (
        <Table>
            <div className="flex items-start justify-center gap-4 sm:gap-9">
                <div className="flex flex-col items-center gap-2.5">
                    <PlayingCard card={current} className="w-[104px] sm:w-[128px]" />
                    <span className="text-[10px] font-bold tracking-[0.18em] text-dim uppercase">
                        Starting card
                    </span>
                </div>

                <div
                    className="mt-[62px] flex flex-col items-center sm:mt-[78px]"
                    style={{ color: shown ? accent : '#8a93a6' }}
                >
                    <span className="text-xl leading-none">
                        {shown ? (higher ? '▲' : '▼') : '·'}
                    </span>
                </div>

                <div className="flex flex-col items-center gap-2.5">
                    <PlayingCard
                        card={next ?? current}
                        faceDown={!shown}
                        className="w-[104px] sm:w-[128px]"
                        style={
                            shown
                                ? {
                                      borderRadius: 12,
                                      boxShadow: `0 0 0 2px ${accent}, 0 22px 46px -16px ${accent}99`,
                                  }
                                : undefined
                        }
                    />
                    <span
                        className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase',
                            shown ? 'text-black' : 'bg-white/[0.06] text-dim',
                        )}
                        style={shown ? { background: accent } : undefined}
                    >
                        {shown ? (higher ? 'Higher' : 'Lower') : 'Face down'}
                    </span>
                </div>
            </div>

            <div className="mt-4 text-center text-xs text-dim">
                {drawnId === null
                    ? 'Pick higher or lower, then deal the next card.'
                    : called
                      ? `The next card was ${higher ? 'higher' : 'lower'} — you called it.`
                      : `You called ${pick === 'higher' ? 'higher' : 'lower'}, but it came ${drawnId}.`}
            </div>
        </Table>
    );
}

/* ---------------------------------------------------------------- Baccarat */

const VALUE_RANKS: Record<number, string[]> = {
    0: ['10', 'J', 'Q', 'K'],
    1: ['A'],
    2: ['2'],
    3: ['3'],
    4: ['4'],
    5: ['5'],
    6: ['6'],
    7: ['7'],
    8: ['8'],
    9: ['9'],
};

function cardForValue(value: number, rng: () => number): Card {
    const ranks = VALUE_RANKS[value] ?? ['10'];
    const rank = ranks[Math.floor(rng() * ranks.length)];

    /* keep the dealt hand from looking like a copy-paste of one suit */
    return { rank, suit: SUITS[Math.floor(rng() * SUITS.length)] };
}

/** Two cards whose baccarat total (mod 10) is exactly `total`. */
function handForTotal(total: number, rng: () => number): Card[] {
    const pairs: [number, number][] = [];

    for (let a = 0; a <= 9; a++) {
        for (let b = 0; b <= 9; b++) {
            if ((a + b) % 10 === total) pairs.push([a, b]);
        }
    }

    const [a, b] = pairs[Math.floor(rng() * pairs.length)] ?? [0, 0];

    return [cardForValue(a, rng), cardForValue(b, rng)];
}

/** No card can appear twice in one deal: bump the suit until it is unique. */
function uniqueCards(cards: Card[]): Card[] {
    const used = new Set<string>();

    return cards.map((card) => {
        let index = SUITS.indexOf(card.suit);
        let suit = card.suit;

        while (used.has(`${card.rank}${suit}`)) {
            index = (index + 1) % SUITS.length;
            suit = SUITS[index];
        }

        used.add(`${card.rank}${suit}`);

        return { rank: card.rank, suit };
    });
}

function totalOf(cards: Card[]) {
    const values: Record<string, number> = {
        A: 1,
        '2': 2,
        '3': 3,
        '4': 4,
        '5': 5,
        '6': 6,
        '7': 7,
        '8': 8,
        '9': 9,
        '10': 0,
        J: 0,
        Q: 0,
        K: 0,
    };

    return cards.reduce((sum, card) => sum + (values[card.rank] ?? 0), 0) % 10;
}

/**
 * Baccarat: player and banker hands, two cards each. The drawn market decides
 * the winner, so the totals are dealt to match it.
 */
export function BaccaratBoard({
    drawnId,
    revealing,
    token,
    accent,
}: {
    drawnId: string | null;
    revealing: boolean;
    token: number;
    accent: string;
}) {
    const deal = useMemo(() => {
        const rng = mulberry32(token * 41 + 7);

        let playerTotal = 0;
        let bankerTotal = 0;

        if (drawnId === 'tie') {
            playerTotal = Math.floor(rng() * 10);
            bankerTotal = playerTotal;
        } else if (drawnId === 'player') {
            playerTotal = 1 + Math.floor(rng() * 9);
            bankerTotal = Math.floor(rng() * playerTotal);
        } else if (drawnId === 'banker') {
            bankerTotal = 1 + Math.floor(rng() * 9);
            playerTotal = Math.floor(rng() * bankerTotal);
        } else {
            playerTotal = Math.floor(rng() * 10);
            bankerTotal = Math.floor(rng() * 10);
        }

        const dealt = uniqueCards([
            ...handForTotal(playerTotal, rng),
            ...handForTotal(bankerTotal, rng),
        ]);
        const player = dealt.slice(0, 2);
        const banker = dealt.slice(2);

        return { player, banker, playerTotal: totalOf(player), bankerTotal: totalOf(banker) };
    }, [drawnId, token]);

    const shown = deal !== null && drawnId !== null && !revealing;
    const bankerWon = drawnId === 'banker';
    const playerWon = drawnId === 'player';
    const tie = drawnId === 'tie';

    return (
        <Table>
            <div className="flex items-start justify-center gap-3 sm:gap-7">
                <Hand
                    label="Player"
                    cards={deal.player}
                    total={deal.playerTotal}
                    shown={shown}
                    highlight={tie || playerWon}
                    accent={accent}
                />

                <div className="mt-14 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-black tracking-widest text-dim">
                        VS
                    </span>
                    {tie && shown && (
                        <span
                            className="rounded-full px-2 py-0.5 text-[9px] font-bold text-black"
                            style={{ background: accent }}
                        >
                            TIE
                        </span>
                    )}
                </div>

                <Hand
                    label="Banker"
                    cards={deal.banker}
                    total={deal.bankerTotal}
                    shown={shown}
                    highlight={tie || bankerWon}
                    accent={accent}
                />
            </div>

            <div className="mt-4 text-center text-xs text-dim">
                {drawnId === null
                    ? 'Banker pays 2.16x, player 2.22x, tie 10.40x.'
                    : shown
                      ? playerWon
                          ? `Player ${deal.playerTotal} beats banker ${deal.bankerTotal}.`
                          : bankerWon
                            ? `Banker ${deal.bankerTotal} beats player ${deal.playerTotal}.`
                            : `Both hands on ${deal.playerTotal} — tie.`
                      : 'Dealing…'}
            </div>
        </Table>
    );
}

function Hand({
    label,
    cards,
    total,
    shown,
    highlight,
    accent,
}: {
    label: string;
    cards: Card[];
    total: number;
    shown: boolean;
    highlight: boolean;
    accent: string;
}) {
    return (
        <div className="flex flex-col items-center gap-2">
            <span
                className={cn(
                    'rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase',
                    highlight && shown ? 'text-black' : 'bg-white/[0.06] text-dim',
                )}
                style={highlight && shown ? { background: accent } : undefined}
            >
                {label}
            </span>

            <div className="flex items-start">
                {cards.map((card, index) => (
                    <div
                        key={`${card.rank}${card.suit}-${index}`}
                        className={cn(
                            'relative rounded-[12px]',
                            index > 0 && '-ml-6 sm:-ml-8',
                        )}
                        style={{
                            transform: `rotate(${index === 0 ? -3.5 : 4.5}deg)`,
                            zIndex: index,
                            boxShadow:
                                highlight && shown && index === 0
                                    ? `0 0 0 2px ${accent}, 0 20px 44px -16px ${accent}aa`
                                    : undefined,
                        }}
                    >
                        <PlayingCard
                            card={card}
                            faceDown={!shown}
                            className="w-[92px] sm:w-[110px]"
                        />
                    </div>
                ))}
            </div>

            <span
                className={cn(
                    'rounded-md px-2 py-0.5 text-[11px] font-black tabular-nums',
                    highlight && shown
                        ? 'text-black'
                        : 'bg-black/40 text-white/70',
                )}
                style={highlight && shown ? { background: accent } : undefined}
            >
                {shown ? total : '—'}
            </span>
        </div>
    );
}

/* ---------------------------------------------------------------- the table */

/** Lays the cards straight on the game stage — no panel or tint behind them. */
function Table({ children }: { children: ReactNode }) {
    return (
        <div className="relative mx-auto flex w-full max-w-[34rem] flex-col items-center px-1">
            {children}
        </div>
    );
}
