import { useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { GameStage } from '@/components/casino/arcade/game-stage';
import { TableCard } from '@/components/casino/arcade/table-card';
import { useI18n } from '@/components/casino/language-provider';
import { OriginalShell } from '@/components/casino/originals/original-shell';
import { formatCoins } from '@/lib/casino';
import { postJson } from '@/lib/http';
import { cn } from '@/lib/utils';
import type { ArcadeConfig, Game, PlayingCardData } from '@/types';

type Props = {
    game: Game;
    bets: number[];
    balance: number;
    config: ArcadeConfig;
    related: Game[];
};

export type HiLoRound = {
    round_id: string;
    status: 'open' | 'won' | 'lost';
    open: boolean;
    bet: number;
    payout: number;
    balance: number;
    card: PlayingCardData;
    next_card: PlayingCardData | null;
    history: PlayingCardData[];
    streak: number;
    multiplier: number;
    potential_win: number;
    odds: { higher_mult: number; lower_mult: number; higher_chance: number; lower_chance: number };
    last_status: 'win' | 'push' | 'loss' | 'cashed' | null;
};

/**
 * HiLo: deal a card, call the next one higher or lower, cash out any time.
 * The server keeps the streak and the shoe — the table only draws what it is
 * told.
 */
export function HiLoTable({ game, bets, balance, config, related }: Props) {
    const { t } = useI18n();
    const [coins, setCoins] = useState(balance);
    const [bet, setBet] = useState(bets[Math.min(1, bets.length - 1)] ?? 0);
    const [round, setRound] = useState<HiLoRound | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const open = round?.open ?? false;
    const multiplier = round?.multiplier ?? 1;
    const streak = round?.streak ?? 0;

    const deal = async () => {
        setBusy(true);
        setMessage(null);

        try {
            const next = await postJson<HiLoRound>('/arcade/hilo/start', { bet });
            setRound(next);
            setCoins(next.balance);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not deal.');
        } finally {
            setBusy(false);
        }
    };

    const guess = async (direction: 'higher' | 'lower') => {
        if (!round || !round.open || busy) {
            return;
        }

        setBusy(true);
        setMessage(null);

        try {
            const next = await postJson<HiLoRound>('/arcade/hilo/guess', {
                round_id: round.round_id,
                guess: direction,
            });
            setRound(next);
            setCoins(next.balance);

            if (next.last_status === 'loss') {
                setMessage('Missed — the streak is over.');
            } else if (next.last_status === 'push') {
                setMessage('Same rank — pushed, the streak is safe.');
            }
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not take the guess.');
        } finally {
            setBusy(false);
        }
    };

    const cashout = async () => {
        if (!round) {
            return;
        }

        setBusy(true);
        setMessage(null);

        try {
            const next = await postJson<HiLoRound>('/arcade/hilo/cashout', { round_id: round.round_id });
            setRound(next);
            setCoins(next.balance);
            setMessage(`Cashed out +${formatCoins(next.payout)} coins`);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not cash out.');
        } finally {
            setBusy(false);
        }
    };

    const higherLabel = round?.card.value === 1 ? 'Higher or same' : round?.card.value === 13 ? 'Same rank' : 'Higher';
    const lowerLabel = round?.card.value === 13 ? 'Lower or same' : round?.card.value === 1 ? 'Same rank' : 'Lower';

    return (
        <OriginalShell
            game={game}
            balance={coins}
            bets={bets}
            bet={bet}
            onBet={setBet}
            playing={busy}
            betLocked={open}
            onPlay={open ? cashout : deal}
            playLabel={
                open
                    ? streak === 0
                        ? 'Guess the next card first'
                        : `${t('game.cashOut')} · ${formatCoins(Math.round(bet * multiplier), 0)}`
                    : `Deal · ${formatCoins(bet, 0)}`
            }
            message={message}
            related={related}
            controls={
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => guess('higher')}
                        disabled={!open || busy}
                        className="flex flex-col items-center gap-0.5 rounded-xl border border-lime/30 bg-lime/10 py-2.5 text-white transition hover:bg-lime/20 disabled:opacity-40"
                    >
                        <span className="flex items-center gap-1 text-[11px] font-bold text-lime">
                            <ArrowUp className="size-3.5" /> {higherLabel}
                        </span>
                        <span className="text-[10px] tabular-nums text-white/70">
                            {round ? `${round.odds.higher_mult.toFixed(2)}× · ${round.odds.higher_chance}%` : '—'}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => guess('lower')}
                        disabled={!open || busy}
                        className="flex flex-col items-center gap-0.5 rounded-xl border border-rose-400/30 bg-rose-500/10 py-2.5 text-white transition hover:bg-rose-500/20 disabled:opacity-40"
                    >
                        <span className="flex items-center gap-1 text-[11px] font-bold text-rose-300">
                            <ArrowDown className="size-3.5" /> {lowerLabel}
                        </span>
                        <span className="text-[10px] tabular-nums text-white/70">
                            {round ? `${round.odds.lower_mult.toFixed(2)}× · ${round.odds.lower_chance}%` : '—'}
                        </span>
                    </button>
                </div>
            }
        >
            <GameStage plain className="p-4 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-[11px] tracking-wider text-dim uppercase">Active multiplier</div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-extrabold tabular-nums text-white">
                                {multiplier.toFixed(2)}×
                            </span>
                            <span className="text-[11px] text-dim">Streak {streak}</span>
                        </div>
                    </div>
                    <div className="text-right text-xs font-bold">
                        {round?.last_status === 'cashed' ? (
                            <span className="text-lime">Cashed out {formatCoins(round.payout)}</span>
                        ) : round?.last_status === 'loss' ? (
                            <span className="text-rose-400">Missed guess</span>
                        ) : round?.last_status === 'push' ? (
                            <span className="text-amber-300">Push · streak kept</span>
                        ) : open ? (
                            <span className="text-white/70">Pot {formatCoins(round?.potential_win ?? 0)}</span>
                        ) : (
                            <span className="text-dim">Ready to deal</span>
                        )}
                    </div>
                </div>

                <div className="my-6 flex flex-col items-center gap-3">
                    <TableCard
                        card={round?.card}
                        faceDown={!round}
                        size="lg"
                        highlight={round?.last_status === 'cashed' || (round?.last_status === 'win' && open)}
                        className={cn(round?.last_status === 'loss' && 'ring-2 ring-rose-500/70')}
                    />
                    <p className="text-center text-[11px] text-dim">
                        {round
                            ? `Current card: ${round.card.rank} (${round.card.value}/13) · equal rank pushes`
                            : 'Deal a card to start your streak'}
                    </p>
                </div>

                <div className="border-t border-white/5 pt-3">
                    <div className="mb-2 text-[11px] text-dim">Drawn sequence</div>
                    <div className="flex min-h-[76px] items-center gap-2 overflow-x-auto">
                        {round?.history?.length ? (
                            round.history.map((card, index) => (
                                <TableCard
                                    key={`${card.suit}-${card.rank}-${index}`}
                                    card={card}
                                    size="sm"
                                />
                            ))
                        ) : (
                            <span className="text-[11px] text-white/30">No cards drawn yet</span>
                        )}
                    </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 border-t border-white/5 pt-2 text-[11px] text-dim">
                    <span>Type: Table</span>
                    <span>·</span>
                    <span>RTP: {game.rtp}</span>
                    <span>·</span>
                    <span>Max win: x{game.max_win_x}</span>
                </div>
            </GameStage>
        </OriginalShell>
    );
}
