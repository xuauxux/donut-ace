import { useState } from 'react';
import { DiceCube } from '@/components/casino/originals/dice-cube';
import { OriginalShell } from '@/components/casino/originals/original-shell';
import { useOriginalPlay } from '@/hooks/use-original-play';
import { formatCoins } from '@/lib/casino';
import { wait } from '@/lib/http';
import { cn } from '@/lib/utils';
import type { Game, OriginalConfig } from '@/types';

type Props = {
    game: Game;
    bets: number[];
    balance: number;
    config: OriginalConfig;
    related: Game[];
};

const RTP = 99;

type Roll = { value: number; won: boolean };

export function Dice({ game, bets, balance, related }: Props) {
    const { balance: coins, bet, setBet, playing, message, play } =
        useOriginalPlay(game.id, bets, balance);
    const [direction, setDirection] = useState<'under' | 'over'>('under');
    const [target, setTarget] = useState(50);
    const [roll, setRoll] = useState<number | null>(null);
    const [ticker, setTicker] = useState(0);
    const [face, setFace] = useState(5);
    const [winAmount, setWinAmount] = useState<number | null>(null);
    const [history, setHistory] = useState<Roll[]>([]);

    const winChance = direction === 'under' ? target : 100 - target;
    const multiplier = winChance > 0 ? RTP / winChance : 0;
    const profit = Math.max(0, Math.round(bet * multiplier - bet));

    const rollDice = () =>
        play({ target, direction }, async (result) => {
            const detail = result.detail as unknown as { roll: number };

            setRoll(null);
            setWinAmount(null);

            const started = Date.now();

            while (Date.now() - started < 620) {
                setTicker(Math.random() * 100);
                setFace(1 + Math.floor(Math.random() * 6));
                await wait(55);
            }

            const value = detail.roll;

            setRoll(value);
            setFace(Math.min(6, 1 + Math.floor(value / 16.67)));
            setWinAmount(result.total_win);
            setHistory((prev) =>
                [{ value, won: result.total_win > 0 }, ...prev].slice(0, 12),
            );
        });

    const cubeState = playing
        ? 'rolling'
        : roll !== null
          ? (winAmount ?? 0) > 0
              ? 'win'
              : 'lose'
          : 'idle';

    return (
        <OriginalShell
            game={game}
            balance={coins}
            bets={bets}
            bet={bet}
            onBet={setBet}
            playing={playing}
            onPlay={rollDice}
            playLabel={`Roll · ${formatCoins(bet, 0)}`}
            message={message}
            related={related}
            controls={
                <div className="space-y-2.5">
                    <div className="flex gap-2">
                        {(['under', 'over'] as const).map((dir) => (
                            <button
                                key={dir}
                                type="button"
                                onClick={() => setDirection(dir)}
                                disabled={playing}
                                className={cn(
                                    'flex-1 rounded-lg py-1.5 text-xs font-bold uppercase transition',
                                    direction === dir
                                        ? 'bg-lime text-lime-ink'
                                        : 'bg-black/40 text-white/80 ring-1 ring-white/10',
                                )}
                            >
                                Roll {dir}
                            </button>
                        ))}
                    </div>

                    <input
                        type="range"
                        min={2}
                        max={98}
                        step={0.5}
                        value={target}
                        onChange={(e) => setTarget(Number(e.target.value))}
                        disabled={playing}
                        className="w-full accent-lime"
                        aria-label="Target"
                    />

                    <div className="grid grid-cols-3 gap-1.5">
                        {[
                            ['Multiplier', `${multiplier.toFixed(2)}x`],
                            [
                                direction === 'under' ? 'Roll Under' : 'Roll Over',
                                target.toFixed(2),
                            ],
                            ['Win chance', `${winChance.toFixed(2)}%`],
                        ].map(([label, value]) => (
                            <div
                                key={label}
                                className="rounded-lg bg-black/40 px-2 py-1.5 ring-1 ring-white/10"
                            >
                                <div className="text-[9px] font-semibold tracking-wide text-dim uppercase">
                                    {label}
                                </div>
                                <div className="text-sm font-black tabular-nums text-white">
                                    {value}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-black/40 px-2.5 py-1.5 text-[11px] ring-1 ring-white/10">
                        <span className="text-dim">Profit on win</span>
                        <span className="font-bold text-lime">
                            +{formatCoins(profit, 0)}
                        </span>
                    </div>
                </div>
            }
        >
            <div className="py-2">
                <div className="flex flex-col items-center justify-center gap-6 sm:flex-row">
                    <DiceCube face={face} state={cubeState} />

                    <div className="text-center">
                        <div
                            className={cn(
                                'inline-flex min-w-[150px] justify-center rounded-full px-6 py-2 text-4xl font-black tabular-nums transition-colors md:text-[42px]',
                                playing && 'bg-surface-2 text-white/70',
                                !playing &&
                                    roll !== null &&
                                    ((winAmount ?? 0) > 0
                                        ? 'bg-lime/15 text-lime'
                                        : 'bg-rose-500/15 text-rose-300'),
                                !playing && roll === null && 'bg-surface-2 text-white/80',
                            )}
                        >
                            {playing
                                ? ticker.toFixed(2)
                                : roll !== null
                                  ? roll.toFixed(2)
                                  : '00.00'}
                        </div>
                        <div className="mt-2 text-[11px] font-semibold text-dim">
                            Roll {direction} {target.toFixed(2)} ·{' '}
                            {multiplier.toFixed(2)}x
                        </div>
                    </div>
                </div>

                {/* range track: green inside the win zone, red outside */}
                <div className="relative mt-7 h-3 rounded-full bg-black/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
                    <div
                        className="absolute inset-0 rounded-full"
                        style={{
                            background:
                                direction === 'over'
                                    ? `linear-gradient(90deg, #ef4444 0%, #ef4444 ${target}%, #22c55e ${target}%, #22c55e 100%)`
                                    : `linear-gradient(90deg, #22c55e 0%, #22c55e ${target}%, #ef4444 ${target}%, #ef4444 100%)`,
                        }}
                    />
                    <div
                        className="absolute -top-1 h-5 w-0.5 bg-white/80"
                        style={{ left: `${target}%` }}
                    />
                    {roll !== null && (
                        <div
                            className="absolute -top-5 -translate-x-1/2 text-[11px] leading-none font-bold text-white"
                            style={{ left: `${roll}%` }}
                        >
                            ▼
                        </div>
                    )}
                </div>
                <div className="mt-2 flex justify-between px-1 text-[10px] text-dim">
                    {[0, 25, 50, 75, 100].map((tick) => (
                        <span key={tick}>{tick}</span>
                    ))}
                </div>

                {!playing && roll !== null && (
                    <div
                        className={cn(
                            'mt-5 rounded-xl px-4 py-2 text-center text-sm font-bold',
                            (winAmount ?? 0) > 0
                                ? 'bg-lime/15 text-lime'
                                : 'bg-rose-500/10 text-rose-300',
                        )}
                    >
                        {(winAmount ?? 0) > 0
                            ? `+${formatCoins(winAmount ?? 0)} coins · ${((winAmount ?? 0) / bet).toFixed(2)}x`
                            : `Lost ${formatCoins(bet, 0)} coins`}
                    </div>
                )}

                {history.length > 0 && (
                    <div className="mt-5">
                        <div className="mb-1.5 text-[10px] font-semibold tracking-wide text-dim uppercase">
                            Recent rolls
                        </div>
                        <div className="scrollbar-none flex gap-1.5 overflow-x-auto pb-1">
                            {history.map((entry, index) => (
                                <span
                                    key={`${entry.value}-${index}`}
                                    className={cn(
                                        'shrink-0 rounded-md px-2 py-1 text-[11px] font-bold tabular-nums',
                                        entry.won
                                            ? 'bg-emerald-500/20 text-emerald-300'
                                            : 'bg-rose-500/15 text-rose-300',
                                    )}
                                >
                                    {entry.value.toFixed(2)}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </OriginalShell>
    );
}
