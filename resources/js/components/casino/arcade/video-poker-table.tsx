import { useState } from 'react';
import { GameStage } from '@/components/casino/arcade/game-stage';
import { TableCard } from '@/components/casino/arcade/table-card';
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

type VideoPokerRound = {
    round_id: string;
    status: 'open' | 'won' | 'lost';
    open: boolean;
    bet: number;
    payout: number;
    balance: number;
    hand: PlayingCardData[];
    outcome: string | null;
};

/**
 * Video poker: five cards, hold what you like, one draw. The server keeps the
 * rest of the deck, so the draw cannot be fished.
 */
export function VideoPokerTable({ game, bets, balance, config, related }: Props) {
    const [coins, setCoins] = useState(balance);
    const [bet, setBet] = useState(bets[Math.min(1, bets.length - 1)] ?? 0);
    const [round, setRound] = useState<VideoPokerRound | null>(null);
    const [holds, setHolds] = useState<number[]>([]);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const accent = game.accent ?? '#7dd3fc';
    const paytable = config.paytable ?? [];
    const open = round?.open ?? false;
    const outcome = round?.outcome ?? null;
    const outcomeRow = paytable.find((row) => row.id === outcome) ?? null;

    const request = async (url: string, body: Record<string, unknown>) => {
        setBusy(true);
        setMessage(null);

        try {
            const next = await postJson<VideoPokerRound>(url, body);
            setRound(next);
            setCoins(next.balance);

            if (next.open) {
                setHolds([]);
            }
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Something went wrong.');
        } finally {
            setBusy(false);
        }
    };

    const deal = () => request('/arcade/video-poker/deal', { bet });
    const draw = () => (round ? request('/arcade/video-poker/draw', { round_id: round.round_id, holds }) : undefined);

    const toggle = (index: number) => {
        if (!open || busy) {
            return;
        }

        setHolds((current) =>
            current.includes(index) ? current.filter((i) => i !== index) : [...current, index].slice(0, 5),
        );
    };

    return (
        <OriginalShell
            game={game}
            balance={coins}
            bets={bets}
            bet={bet}
            onBet={setBet}
            playing={busy}
            betLocked={open}
            onPlay={open ? draw : deal}
            playLabel={open ? `Draw · keep ${holds.length}` : `Deal · ${formatCoins(bet, 0)}`}
            message={message}
            related={related}
            controls={
                <div className="space-y-2">
                    <div className="text-[10px] font-bold tracking-[0.18em] text-dim uppercase">Paytable</div>
                    <div className="space-y-1">
                        {paytable
                            .filter((row) => row.id !== 'nothing')
                            .map((row) => {
                                const active = outcomeRow?.id === row.id;

                                return (
                                    <div
                                        key={row.id}
                                        className={cn(
                                            'flex items-center justify-between rounded-md px-2 py-1 text-[11px]',
                                            active ? 'text-black' : 'text-white/70',
                                        )}
                                        style={active ? { background: accent } : undefined}
                                    >
                                        <span className={cn(active ? 'font-black' : 'font-semibold')}>{row.label}</span>
                                        <span className="font-bold tabular-nums">{row.mult}×</span>
                                    </div>
                                );
                            })}
                    </div>
                    <p className="pt-1 text-[10px] leading-relaxed text-dim">
                        Jacks or Better, 9/6 · one draw per hand.
                    </p>
                </div>
            }
        >
            <GameStage plain className="p-4 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-[11px] tracking-wider text-dim uppercase">Video Poker</div>
                        <div className="text-lg font-extrabold text-white">
                            {outcomeRow ? outcomeRow.label : open ? 'Mark the cards to keep' : 'Jacks or Better'}
                        </div>
                    </div>
                    <div className="text-right text-xs font-bold">
                        {outcomeRow && outcomeRow.mult > 0 ? (
                            <span className="text-lime">+{formatCoins(round?.payout ?? 0)}</span>
                        ) : (
                            <span className="text-dim">{open ? 'One draw left' : 'Ready to deal'}</span>
                        )}
                    </div>
                </div>

                <div className="mt-6 flex flex-wrap items-start justify-center gap-2 sm:gap-3">
                    {(round?.hand ?? Array.from({ length: 5 }, () => null)).map((card, index) => (
                        <button
                            key={index}
                            type="button"
                            onClick={() => toggle(index)}
                            disabled={!open || busy}
                            className={cn(
                                'group relative flex flex-col items-center gap-2 rounded-xl p-1 transition',
                                open && 'cursor-pointer hover:-translate-y-0.5',
                            )}
                        >
                            <TableCard
                                card={card}
                                faceDown={!card}
                                size="md"
                                highlight={holds.includes(index)}
                            />
                            <span
                                className={cn(
                                    'rounded-full px-2 py-0.5 text-[9px] font-black tracking-[0.12em] uppercase',
                                    holds.includes(index)
                                        ? 'text-black'
                                        : 'bg-white/[0.06] text-white/30',
                                )}
                                style={holds.includes(index) ? { background: accent } : undefined}
                            >
                                {holds.includes(index) ? 'Hold' : 'Discard'}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-3 text-[11px] text-dim">
                    <span>Stake {formatCoins(round?.bet ?? bet, 0)}</span>
                    <span>
                        {holds.length === 5
                            ? 'Holding all five keeps the hand'
                            : open
                              ? 'Redraw the rest'
                              : 'One draw per hand'}
                    </span>
                </div>
            </GameStage>
        </OriginalShell>
    );
}
