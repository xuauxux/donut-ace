import { useState } from 'react';
import { TableCard } from '@/components/casino/arcade/table-card';
import { GameStage } from '@/components/casino/arcade/game-stage';
import { OriginalShell } from '@/components/casino/originals/original-shell';
import { useOriginalPlay } from '@/hooks/use-original-play';
import { formatCoins } from '@/lib/casino';
import { wait } from '@/lib/http';
import { cn } from '@/lib/utils';
import type { ArcadeConfig, Game, PlayingCardData } from '@/types';

type Props = {
    game: Game;
    bets: number[];
    balance: number;
    config: ArcadeConfig;
    related: Game[];
};

type Deal = {
    pick: 'player' | 'banker' | 'tie';
    winner: 'player' | 'banker' | 'tie';
    player: PlayingCardData[];
    banker: PlayingCardData[];
    player_total: number;
    banker_total: number;
    natural: boolean;
    won: boolean;
    push: boolean;
};

const PAYS: Record<string, number> = { player: 1.98, banker: 1.95, tie: 8.95 };

/** Punto Banco: pick a hand, the server deals from an eight-deck shoe. */
export function BaccaratTable({ game, bets, balance, config, related }: Props) {
    const play = useOriginalPlay(game.id, bets, balance, '/arcade');
    const markets = config.options.filter((option) => ['player', 'banker', 'tie'].includes(option.id));
    const [pick, setPick] = useState<string>(markets[0]?.id ?? 'player');
    const [deal, setDeal] = useState<Deal | null>(null);
    const [visible, setVisible] = useState(0);
    const [dealing, setDealing] = useState(false);

    const shown = (cards?: PlayingCardData[]) =>
        cards ? cards.slice(0, Math.max(0, Math.min(cards.length, visible))) : [];

    const playRound = () =>
        play.play({ pick }, async (result) => {
            setDeal(null);
            setVisible(0);
            setDealing(true);

            const outcome = result.detail as unknown as Deal;
            const total = outcome.player.length + outcome.banker.length;

            for (let index = 1; index <= total; index++) {
                await wait(230);
                setVisible(index);
            }

            setDeal(outcome);
            setDealing(false);
        });

    const handTotal = (cards: PlayingCardData[]) =>
        cards.reduce((sum, card) => sum + (card.value >= 10 ? 0 : card.value), 0) % 10;

    const playerCards = shown(deal?.player);
    const bankerCards = shown(deal?.banker);
    const payout = deal ? Math.round(play.bet * (PAYS[deal.winner] ?? 0)) : 0;

    const hand = (side: 'player' | 'banker', cards: PlayingCardData[]) => (
        <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
                <span
                    className={cn(
                        'text-xs font-bold tracking-wide uppercase',
                        side === 'player' ? 'text-sky-300' : 'text-rose-300',
                    )}
                >
                    {side === 'player' ? 'Player' : 'Banker'}
                </span>
                <span
                    className={cn(
                        'rounded-lg bg-white/5 px-2 py-0.5 text-sm font-extrabold tabular-nums',
                        deal?.winner === side ? 'text-lime' : 'text-white',
                    )}
                >
                    {cards.length > 0 ? handTotal(cards) : '—'}
                </span>
            </div>
            <div className="flex min-h-[168px] items-center gap-2">
                {cards.length > 0 ? (
                    cards.map((card, index) => (
                        <TableCard
                            key={`${side}-${index}`}
                            card={card}
                            size="md"
                            tilt={index === 2}
                            highlight={deal?.winner === side}
                        />
                    ))
                ) : (
                    <>
                        <TableCard faceDown size="md" backTone="red" />
                        <TableCard faceDown size="md" backTone="red" />
                    </>
                )}
            </div>
        </div>
    );

    return (
        <OriginalShell
            game={game}
            balance={play.balance}
            bets={bets}
            bet={play.bet}
            onBet={play.setBet}
            playing={play.playing || dealing}
            onPlay={playRound}
            playLabel={`Deal · ${formatCoins(play.bet, 0)}`}
            message={play.message}
            related={related}
            controls={
                <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-white/10 bg-black/40 p-1">
                    {markets.map((market) => (
                        <button
                            key={market.id}
                            type="button"
                            onClick={() => setPick(market.id)}
                            disabled={play.playing || dealing}
                            className={cn(
                                'rounded-lg px-1 py-2 text-center transition',
                                pick === market.id
                                    ? 'bg-lime/15 text-lime ring-1 ring-lime/40'
                                    : 'text-white/60 hover:text-white',
                            )}
                        >
                            <div className="text-[11px] font-bold">{market.label}</div>
                            <div className="text-[10px] tabular-nums opacity-80">{market.mult.toFixed(2)}×</div>
                        </button>
                    ))}
                </div>
            }
        >
            <GameStage plain className="p-4 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="text-[11px] tracking-wider text-dim uppercase">Punto Banco</div>
                        <div className="text-lg font-extrabold">
                            {deal ? (
                                deal.winner === 'tie' ? (
                                    <span className="text-amber-300">
                                        Tie {deal.player_total} – {deal.banker_total}
                                        {deal.pick === 'tie' ? ` · +${formatCoins(payout)}` : ' · bet returned'}
                                    </span>
                                ) : (
                                    <span className={deal.won ? 'text-lime' : 'text-rose-400'}>
                                        {deal.winner === 'player' ? 'Player' : 'Banker'} wins
                                        {deal.natural ? ' (natural)' : ''} · {deal.player_total} – {deal.banker_total}
                                    </span>
                                )
                            ) : dealing ? (
                                <span className="text-purple-300">Dealing from the shoe…</span>
                            ) : (
                                <span className="text-white/70">Pick a hand and deal</span>
                            )}
                        </div>
                    </div>
                    {deal && (
                        <div className="rounded-xl bg-white/5 px-3 py-1.5 text-xs font-bold tabular-nums">
                            {deal.won ? `+${formatCoins(payout)}` : deal.push ? 'Push' : '—'}
                        </div>
                    )}
                </div>

                <div className="my-6 grid grid-cols-1 items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
                    {hand('player', playerCards)}

                    <div className="hidden flex-col items-center gap-2 md:flex">
                        <div className="h-14 w-px bg-white/10" />
                        <span className="text-[10px] font-bold tracking-widest text-white/40">VS</span>
                        <div className="h-14 w-px bg-white/10" />
                    </div>

                    {hand('banker', bankerCards)}
                </div>

                <div className="flex flex-wrap gap-2 border-t border-white/5 pt-3 text-[11px] text-dim">
                    <span>8-deck shoe</span>
                    <span>·</span>
                    <span>Player 97.2% · Banker 97.9% · Tie 88.0%</span>
                    <span>·</span>
                    <span>Tie pushes Player &amp; Banker</span>
                </div>
            </GameStage>
        </OriginalShell>
    );
}
