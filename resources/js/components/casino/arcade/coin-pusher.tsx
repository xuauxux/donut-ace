import { useState } from 'react';
import { OriginalShell } from '@/components/casino/originals/original-shell';
import { useOriginalPlay } from '@/hooks/use-original-play';
import { formatCoins } from '@/lib/casino';
import { wait } from '@/lib/http';
import { cn } from '@/lib/utils';
import type { Game } from '@/types';

type Props = {
    game: Game;
    bets: number[];
    balance: number;
    related: Game[];
};

/** A fixed coin field so the shelf does not reshuffle between renders. */
const FIELD = Array.from({ length: 34 }, (_, index) => ({
    x: 8 + ((index * 37) % 84),
    y: 30 + ((index * 53) % 52),
    tilt: (index % 5) * 9 - 18,
    size: 15 + (index % 3) * 3,
}));

const LANES = 5;

/**
 * Coin Pusher: pick one of five drop lanes, the coin falls and the shelf pushes
 * what it can into the tray. The spill table is fixed and the board only
 * animates the result the server already drew.
 */
export function CoinPusher({ game, bets, balance, related }: Props) {
    const { balance: coins, bet, setBet, playing, message, play } = useOriginalPlay(
        game.id,
        bets,
        balance,
        '/arcade',
    );

    const [lane, setLane] = useState(2);
    const [advance, setAdvance] = useState(false);
    const [spill, setSpill] = useState<{ coins: number; mult: number; key: number } | null>(null);
    const [payout, setPayout] = useState<number | null>(null);
    const [tray, setTray] = useState(0);

    const accent = game.accent ?? '#f5b82e';

    const run = () =>
        play({ lane }, async (result) => {
            const detail = result.detail as { coins: number; mult: number };

            setPayout(null);
            setSpill(null);
            setAdvance(true);

            await wait(420);
            setAdvance(false);
            setSpill({ coins: detail.coins, mult: detail.mult, key: Date.now() });
            await wait(900);

            setPayout(result.total_win);
            setTray((current) => current + detail.coins);
        });

    return (
        <OriginalShell
            game={game}
            balance={coins}
            bets={bets}
            bet={bet}
            onBet={setBet}
            playing={playing}
            onPlay={run}
            playLabel={`Drop · ${formatCoins(bet, 0)}`}
            message={message}
            related={related}
            controls={
                <div className="space-y-2">
                    <div className="text-[11px] font-semibold text-dim">Drop lane</div>
                    <div className="grid grid-cols-5 gap-1.5">
                        {Array.from({ length: LANES }, (_, index) => (
                            <button
                                key={index}
                                type="button"
                                onClick={() => setLane(index)}
                                disabled={playing}
                                className={cn(
                                    'rounded-lg border py-2 text-[11px] font-bold transition',
                                    lane === index
                                        ? 'border-[#f5b82e]/70 bg-[#f5b82e]/15 text-white'
                                        : 'border-white/5 bg-black/40 text-dim hover:text-white',
                                )}
                            >
                                {index + 1}
                            </button>
                        ))}
                    </div>
                    <p className="pt-1 text-[10px] leading-relaxed text-dim">
                        Every lane feeds the same shelf; a full push can spill up to 10×.
                    </p>
                </div>
            }
        >
            <div className="overflow-hidden rounded-2xl ring-1 ring-line/60">
                <div
                    className="relative h-[320px] overflow-hidden"
                    style={{
                        background:
                            'radial-gradient(120% 90% at 50% -8%, #3a2f14 0%, #221b0d 48%, #100d08 100%)',
                    }}
                >
                    {/* lane lights */}
                    <div className="absolute inset-x-[10%] top-3 flex justify-between">
                        {Array.from({ length: LANES }, (_, index) => (
                            <span
                                key={index}
                                className={cn(
                                    'h-1.5 w-10 rounded-full transition',
                                    lane === index ? 'opacity-100' : 'opacity-25',
                                )}
                                style={{ background: accent }}
                            />
                        ))}
                    </div>

                    {/* pusher plate */}
                    <div
                        className={cn(
                            'absolute top-[62px] right-[8%] left-[8%] h-3.5 rounded-full transition-transform duration-300',
                            advance && 'translate-y-2.5',
                        )}
                        style={{
                            background: 'linear-gradient(180deg, #6b5a34, #3a3018)',
                            boxShadow: '0 6px 14px rgba(0,0,0,0.55)',
                        }}
                    />

                    {/* coin field */}
                    {FIELD.map((coin, index) => (
                        <span
                            key={index}
                            className={cn(
                                'absolute rounded-full transition-transform duration-300',
                                advance && 'translate-y-1',
                            )}
                            style={{
                                left: `${coin.x}%`,
                                top: `${coin.y}%`,
                                width: coin.size,
                                height: coin.size * 0.62,
                                transform: `rotate(${coin.tilt}deg)`,
                                background: 'radial-gradient(circle at 35% 28%, #ffe9a8, #f5b82e 58%, #b9820f)',
                                boxShadow: '0 3px 6px rgba(0,0,0,0.55)',
                                opacity: 0.9 - (index % 4) * 0.08,
                            }}
                        />
                    ))}

                    {/* drop chute */}
                    <div className="absolute top-6 left-1/2 h-[46px] w-[7px] -translate-x-1/2 rounded-full bg-white/10" />

                    {/* tray */}
                    <div className="absolute inset-x-0 bottom-0 h-[86px] border-t border-white/10 bg-black/55">
                        <div className="absolute inset-x-0 top-2 text-center text-[9px] font-bold tracking-[0.22em] text-white/25 uppercase">
                            Tray · {tray} coins
                        </div>

                        {spill &&
                            Array.from({ length: Math.min(spill.coins, 24) }, (_, index) => (
                                <span
                                    key={`${spill.key}-${index}`}
                                    className="absolute rounded-full"
                                    style={{
                                        left: `${14 + ((index * 29) % 72)}%`,
                                        bottom: `${10 + ((index * 17) % 44)}px`,
                                        width: 15,
                                        height: 9,
                                        background:
                                            'radial-gradient(circle at 35% 28%, #fff3c4, #f7c33d 58%, #b9820f)',
                                        boxShadow: '0 2px 5px rgba(0,0,0,0.6)',
                                        animation: `coin-fall 700ms ease-out ${index * 26}ms both`,
                                    }}
                                />
                            ))}

                        <div className="absolute right-3 bottom-2 text-xs font-black">
                            {payout !== null ? (
                                payout > 0 ? (
                                    <span className="text-lime">+{formatCoins(payout)}</span>
                                ) : (
                                    <span className="text-white/40">Nothing spilled</span>
                                )
                            ) : (
                                <span className="text-white/30">{spill ? `${spill.mult.toFixed(2)}×` : '—'}</span>
                            )}
                        </div>
                    </div>

                    <style>{`
                        @keyframes coin-fall {
                            0% { transform: translateY(-120px) rotate(0deg); opacity: 0; }
                            35% { opacity: 1; }
                            100% { transform: translateY(0) rotate(24deg); opacity: 1; }
                        }
                    `}</style>
                </div>
            </div>
        </OriginalShell>
    );
}
