import { useState } from 'react';
import { GameStage } from '@/components/casino/arcade/game-stage';
import { TableCard } from '@/components/casino/arcade/table-card';
import { OriginalShell } from '@/components/casino/originals/original-shell';
import { formatCoins } from '@/lib/casino';
import { postJson } from '@/lib/http';
import { cn } from '@/lib/utils';
import type { Game, PlayingCardData } from '@/types';

type Props = {
    game: Game;
    bets: number[];
    balance: number;
    related: Game[];
};

type BlackjackRound = {
    round_id: string;
    status: 'open' | 'won' | 'lost';
    open: boolean;
    bet: number;
    payout: number;
    balance: number;
    player: PlayingCardData[];
    dealer: PlayingCardData[];
    dealer_hidden: boolean;
    player_total: number;
    player_soft: boolean;
    dealer_total: number | null;
    blackjack: boolean;
    can_hit: boolean;
    can_double: boolean;
    outcome: string | null;
};

const OUTCOMES: Record<string, string> = {
    blackjack: 'Blackjack — paid 3:2',
    'dealer-blackjack': 'Dealer blackjack',
    bust: 'Bust — over 21',
    'dealer-bust': 'Dealer busts',
    win: 'You beat the dealer',
    push: 'Push — stake returned',
    loss: 'Dealer wins',
};

/**
 * Blackjack: two cards each, dealer hole card face down. Hit, stand or double;
 * the server holds the shoe and settles the hand.
 */
export function BlackjackTable({ game, bets, balance, related }: Props) {
    const [coins, setCoins] = useState(balance);
    const [bet, setBet] = useState(bets[Math.min(1, bets.length - 1)] ?? 0);
    const [round, setRound] = useState<BlackjackRound | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const accent = game.accent ?? '#f5b82e';
    const open = round?.open ?? false;
    const outcome = round?.outcome ?? null;

    const request = async (url: string, body: Record<string, unknown>) => {
        setBusy(true);
        setMessage(null);

        try {
            const next = await postJson<BlackjackRound>(url, body);
            setRound(next);
            setCoins(next.balance);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Something went wrong.');
        } finally {
            setBusy(false);
        }
    };

    const deal = () => request('/arcade/blackjack/deal', { bet });
    const hit = () => (round ? request('/arcade/blackjack/hit', { round_id: round.round_id }) : undefined);
    const stand = () => (round ? request('/arcade/blackjack/stand', { round_id: round.round_id }) : undefined);
    const double = () => (round ? request('/arcade/blackjack/double', { round_id: round.round_id }) : undefined);

    return (
        <OriginalShell
            game={game}
            balance={coins}
            bets={bets}
            bet={bet}
            onBet={setBet}
            playing={busy}
            betLocked={open}
            onPlay={open ? stand : deal}
            playLabel={open ? 'Stand' : `Deal · ${formatCoins(bet, 0)}`}
            message={message}
            related={related}
            controls={
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={hit}
                        disabled={!open || busy || !round?.can_hit}
                        className="rounded-xl border border-lime/30 bg-lime/10 py-2.5 text-[12px] font-bold text-lime transition hover:bg-lime/20 disabled:opacity-35"
                    >
                        Hit
                    </button>
                    <button
                        type="button"
                        onClick={double}
                        disabled={!open || busy || !round?.can_double}
                        className="rounded-xl border border-amber-300/30 bg-amber-300/10 py-2.5 text-[12px] font-bold text-amber-200 transition hover:bg-amber-300/20 disabled:opacity-35"
                    >
                        Double
                    </button>
                    <p className="col-span-2 text-center text-[10px] leading-relaxed text-dim">
                        Six decks · dealer stands on 17 · blackjack pays 3:2
                    </p>
                </div>
            }
        >
            <GameStage plain className="p-4 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-[11px] tracking-wider text-dim uppercase">Blackjack</div>
                        <div className="text-lg font-extrabold text-white">{formatCoins(round?.bet ?? bet, 0)} per hand</div>
                    </div>
                    <div className="text-right text-xs font-bold">
                        {outcome ? (
                            <span className={cn(round?.payout && round.payout > 0 ? 'text-lime' : 'text-rose-400')}>
                                {OUTCOMES[outcome] ?? outcome}
                            </span>
                        ) : open ? (
                            <span className="text-white/70">Your move</span>
                        ) : (
                            <span className="text-dim">Ready to deal</span>
                        )}
                        {round?.payout ? (
                            <div className="text-[11px] text-lime">Paid {formatCoins(round.payout)}</div>
                        ) : null}
                    </div>
                </div>

                <div className="mt-5 space-y-5">
                    <Hand
                        label="Dealer"
                        cards={round?.dealer ?? []}
                        total={round?.dealer_total ?? null}
                        hidden={round?.dealer_hidden}
                        accent={accent}
                        highlight={!!outcome && outcome !== 'blackjack' && outcome !== 'win'}
                    />

                    <div className="flex items-center gap-3">
                        <span className="h-px flex-1 bg-white/10" />
                        <span className="text-[9px] font-bold tracking-[0.22em] text-white/25 uppercase">
                            {open ? 'Dealer must draw to 17' : 'Table limits apply'}
                        </span>
                        <span className="h-px flex-1 bg-white/10" />
                    </div>

                    <Hand
                        label="You"
                        cards={round?.player ?? []}
                        total={round?.player_total ?? null}
                        accent={accent}
                        highlight={!!outcome && (outcome === 'win' || outcome === 'blackjack' || outcome === 'dealer-bust')}
                        soft={round?.player_soft}
                    />
                </div>
            </GameStage>
        </OriginalShell>
    );
}

function Hand({
    label,
    cards,
    total,
    hidden = false,
    accent,
    highlight = false,
    soft = false,
}: {
    label: string;
    cards: PlayingCardData[];
    total: number | null;
    hidden?: boolean;
    accent: string;
    highlight?: boolean;
    soft?: boolean;
}) {
    const empty = cards.length === 0;

    return (
        <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-[0.18em] text-dim uppercase">{label}</span>
                <span
                    className={cn(
                        'rounded-md px-2 py-0.5 text-[11px] font-black tabular-nums',
                        highlight ? 'text-black' : 'bg-black/40 text-white/75',
                    )}
                    style={highlight ? { background: accent } : undefined}
                >
                    {total === null ? '—' : soft ? `${total} soft` : total}
                </span>
            </div>

            <div className="flex min-h-[132px] items-start">
                {empty ? (
                    <>
                        <TableCard faceDown size="md" backTone="red" />
                        <div className="-ml-7 sm:-ml-9">
                            <TableCard faceDown size="md" backTone="red" />
                        </div>
                    </>
                ) : (
                    cards.map((card, index) => (
                        <div
                            key={`${card.suit}-${card.rank}-${index}`}
                            className={cn('relative', index > 0 && '-ml-7 sm:-ml-9')}
                            style={{ zIndex: index, transform: `rotate(${index === 0 ? -2.5 : 2.5}deg)` }}
                        >
                            <TableCard
                                card={card}
                                size="md"
                                highlight={highlight && index === cards.length - 1}
                            />
                        </div>
                    ))
                )}

                {hidden && (
                    <div className="-ml-7 sm:-ml-9">
                        <TableCard faceDown size="md" backTone="red" />
                    </div>
                )}
            </div>
        </div>
    );
}
