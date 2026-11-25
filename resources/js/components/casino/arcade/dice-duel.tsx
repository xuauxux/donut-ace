import { useState } from 'react';
import { BetChips } from '@/components/casino/arcade/bet-chips';
import { useI18n } from '@/components/casino/language-provider';
import { OriginalShell } from '@/components/casino/originals/original-shell';
import { useOriginalPlay } from '@/hooks/use-original-play';
import { formatCoins } from '@/lib/casino';
import { wait } from '@/lib/http';
import { cn } from '@/lib/utils';
import type { ArcadeConfig, Game } from '@/types';

type Props = {
    game: Game;
    bets: number[];
    balance: number;
    config: ArcadeConfig;
    related: Game[];
};

/** Pip slots on a 3 × 3 face. */
const PIPS: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
};

function pips(value: number) {
    return (PIPS[value] ?? [4]).map((slot) => ({
        cx: 36 + (slot % 3) * 24,
        cy: 36 + Math.floor(slot / 3) * 24,
    }));
}

/** One die: a bevelled white face, inset pips, and a cast shadow on the felt. */
function Die({
    value,
    tilt,
    rolling,
    landed,
    accent,
}: {
    value: number;
    tilt: number;
    rolling: boolean;
    landed: boolean;
    accent: string;
}) {
    return (
        <div className="relative" style={{ transform: `rotate(${tilt}deg)` }}>
            <div
                className={cn(
                    'absolute -bottom-2 left-1/2 h-3 w-16 -translate-x-1/2 rounded-full bg-black/60 blur-md transition-all duration-300',
                    rolling && 'scale-75 opacity-40',
                )}
            />

            <div className={cn('relative', rolling && 'dice-roll', landed && 'dice-land')}>
                <svg
                    viewBox="0 0 120 120"
                    className="relative size-[104px] drop-shadow-[0_16px_24px_rgba(0,0,0,0.55)] sm:size-32"
                    aria-hidden
                >
                    <defs>
                        <linearGradient id="die-face" x1="0" y1="0" x2="0.85" y2="1">
                            <stop offset="0%" stopColor="#ffffff" />
                            <stop offset="52%" stopColor="#f1f5f9" />
                            <stop offset="100%" stopColor="#bcc6d4" />
                        </linearGradient>
                        <radialGradient id="die-gloss" cx="30%" cy="20%" r="70%">
                            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                        </radialGradient>
                        <radialGradient id="die-pip" cx="35%" cy="30%" r="75%">
                            <stop offset="0%" stopColor="#334155" />
                            <stop offset="60%" stopColor="#111827" />
                            <stop offset="100%" stopColor="#020617" />
                        </radialGradient>
                    </defs>

                    <rect x="5" y="5" width="110" height="110" rx="26" fill="url(#die-face)" />
                    <rect
                        x="5"
                        y="5"
                        width="110"
                        height="110"
                        rx="26"
                        fill="url(#die-gloss)"
                        opacity="0.75"
                    />
                    <rect
                        x="5"
                        y="5"
                        width="110"
                        height="110"
                        rx="26"
                        fill="none"
                        stroke="rgba(15,23,42,0.14)"
                        strokeWidth="1.5"
                    />
                    <rect
                        x="12"
                        y="12"
                        width="96"
                        height="96"
                        rx="19"
                        fill="none"
                        stroke="rgba(255,255,255,0.7)"
                        strokeWidth="1"
                    />

                    {pips(value).map(({ cx, cy }) => (
                        <g key={`${cx}-${cy}`}>
                            <circle cx={cx} cy={cy + 1} r="8.6" fill="rgba(255,255,255,0.85)" />
                            <circle cx={cx} cy={cy} r="8.4" fill="url(#die-pip)" />
                            <circle cx={cx - 2.4} cy={cy - 2.6} r="1.7" fill="rgba(255,255,255,0.35)" />
                        </g>
                    ))}
                </svg>

                {landed && (
                    <span
                        className="pointer-events-none absolute inset-0 rounded-[26px]"
                        style={{ boxShadow: `0 0 0 3px ${accent}, 0 0 40px -6px ${accent}` }}
                    />
                )}
            </div>
        </div>
    );
}

export function DiceDuel({ game, bets, balance, config, related }: Props) {
    const { t } = useI18n();
    const { balance: coins, bet, setBet, playing, message, play } =
        useOriginalPlay(game.id, bets, balance, '/arcade');

    const accent = game.accent ?? '#a3e635';
    const options = config.options;

    const [pick, setPick] = useState(options[0]?.id ?? '');
    const [dice, setDice] = useState<[number, number]>([3, 4]);
    const [payout, setPayout] = useState<number | null>(null);
    const [shown, setShown] = useState(false);

    const won = (payout ?? 0) > 0;
    const total = dice[0] + dice[1];

    const run = () =>
        play({ pick }, async (result) => {
            const detail = result.detail as { dice?: [number, number] };

            setPayout(null);
            setShown(false);

            const started = Date.now();
            while (Date.now() - started < 820) {
                setDice([
                    Math.floor(Math.random() * 6) + 1,
                    Math.floor(Math.random() * 6) + 1,
                ]);
                await wait(70);
            }

            setDice(detail.dice ?? [1, 1]);
            setPayout(result.total_win);
            setShown(true);
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
            playLabel={`${t('game.roll')} · ${formatCoins(bet, 0)}`}
            message={message}
            related={related}
        >
            <div className="relative overflow-hidden py-1">
                {/* felt tray */}
                <div
                    className="relative mx-auto flex max-w-[420px] flex-col items-center rounded-[28px] px-4 pt-8 pb-4 ring-1 ring-white/10"
                    style={{
                        background:
                            'radial-gradient(120% 100% at 50% 0%, rgba(30,41,59,0.95), rgba(8,11,16,0.98))',
                        boxShadow:
                            'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -30px 60px rgba(0,0,0,0.55)',
                    }}
                >
                    <span
                        className="pointer-events-none absolute inset-x-10 top-3 h-24 rounded-full opacity-45 blur-2xl"
                        style={{ background: `${accent}22` }}
                    />

                    <div className="relative flex items-center justify-center gap-4 sm:gap-7">
                        <Die
                            value={dice[0]}
                            tilt={-7}
                            rolling={playing}
                            landed={shown && won}
                            accent={accent}
                        />
                        <Die
                            value={dice[1]}
                            tilt={6}
                            rolling={playing}
                            landed={shown && won}
                            accent={accent}
                        />
                    </div>

                    <div className="mt-5 flex items-center gap-3">
                        <span className="h-px w-8 bg-white/10" />
                        <span className="text-[10px] font-bold tracking-[0.28em] text-white/40 uppercase">
                            {t('game.total', { total })}
                        </span>
                        <span className="h-px w-8 bg-white/10" />
                    </div>

                    <div className="mt-1 text-4xl leading-none font-black tabular-nums text-white">
                        {total}
                    </div>
                </div>

                <div className="mt-3 h-7 text-center text-sm font-bold">
                    {shown ? (
                        <span
                            className={won ? '' : 'text-dim'}
                            style={won ? { color: accent } : undefined}
                        >
                            {won
                                ? t('draw.won', {
                                      coins: formatCoins(payout ?? 0),
                                      mult: ((payout ?? 0) / bet).toFixed(2),
                                  })
                                : t('draw.noWin')}
                        </span>
                    ) : (
                        <span className="text-xs font-normal text-dim">
                            {playing ? t('draw.resolving') : t('game.pickBet')}
                        </span>
                    )}
                </div>

                <BetChips
                    options={options}
                    selected={pick}
                    onSelect={setPick}
                    disabled={playing}
                    accent={accent}
                />
            </div>
        </OriginalShell>
    );
}
