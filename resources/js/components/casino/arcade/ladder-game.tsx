import { useState } from 'react';
import { ChickenRoad } from '@/components/casino/arcade/chicken-road';
import { BombIcon, GemIcon } from '@/components/casino/game-icons';
import { useI18n } from '@/components/casino/language-provider';
import { OriginalShell } from '@/components/casino/originals/original-shell';
import { formatCoins } from '@/lib/casino';
import { postJson } from '@/lib/http';
import { cn } from '@/lib/utils';
import type { ArcadeConfig, Game, LadderRound } from '@/types';

type Props = {
    game: Game;
    bets: number[];
    balance: number;
    config: ArcadeConfig;
    related: Game[];
};

/**
 * Cash-out games (mines, chicken, tower, pump…). The server owns the board; the
 * bet is taken when the round opens and cashing out pays the current step.
 */
export function LadderGame({ game, bets, balance, config, related }: Props) {
    const { t } = useI18n();
    const [coins, setCoins] = useState(balance);
    const [bet, setBet] = useState(bets[Math.min(1, bets.length - 1)] ?? 0);
    const [hazards, setHazards] = useState(config.default_hazards ?? 1);
    const [difficulty, setDifficulty] = useState(
        config.default_difficulty ?? config.difficulties[0]?.id ?? 'medium',
    );
    const [round, setRound] = useState<LadderRound | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const accent = game.accent ?? '#bef264';
    const open = round?.status === 'open';
    const finished = round !== null && !open;
    const step = round?.step ?? 0;
    const rows = config.rows ?? 0;
    const cells = config.cells ?? 0;
    const tower = config.shape === 'rows';
    /* Tower floors keep the width the round was dealt, so a mid-round change
     * can never reveal against the wrong board. */
    const rowOptions =
        round?.row_options ??
        config.difficulties.find((d) => d.id === difficulty)?.options ??
        config.row_options ??
        0;
    const floorSafe = rowOptions > 1 ? (rowOptions - 1) / rowOptions : 0;
    const multiplier = round?.multiplier ?? 1;
    const road = config.shape === 'road';
    const roadChance =
        round?.chance ??
        config.difficulties.find((d) => d.id === difficulty)?.chance ??
        0.85;
    const firstHit = (mines: number) =>
        cells > 0 ? 0.99 / ((cells - mines) / cells) : 0;

    const start = async () => {
        setBusy(true);
        setMessage(null);

        try {
            const next = await postJson<LadderRound>(
                `/arcade/${game.id}/start`,
                config.shape === 'grid'
                    ? { bet, hazards }
                    : road || tower
                      ? { bet, difficulty }
                      : { bet },
            );
            setRound(next);
            setCoins(next.balance);
        } catch (error) {
            setMessage(
                error instanceof Error ? error.message : 'Could not start.',
            );
        } finally {
            setBusy(false);
        }
    };

    const reveal = async (pick: number) => {
        if (!round || round.status !== 'open' || busy) {
            return;
        }

        setBusy(true);

        try {
            const next = await postJson<LadderRound>(
                `/arcade/${game.id}/reveal`,
                { round_id: round.round_id, pick },
            );
            setRound(next);
            setCoins(next.balance);

            if (next.status === 'lost') {
                setMessage('Hit a hazard — the round is over.');
            } else if (next.status === 'won') {
                setMessage(`Board cleared! +${formatCoins(next.payout)} coins`);
            }
        } catch (error) {
            setMessage(
                error instanceof Error ? error.message : 'Could not reveal.',
            );
        } finally {
            setBusy(false);
        }
    };

    const cashout = async () => {
        if (!round) {
            return;
        }

        setBusy(true);

        try {
            const next = await postJson<LadderRound>(
                `/arcade/${game.id}/cashout`,
                { round_id: round.round_id },
            );
            setRound(next);
            setCoins(next.balance);
            setMessage(`Cashed out +${formatCoins(next.payout)} coins`);
        } catch (error) {
            setMessage(
                error instanceof Error ? error.message : 'Could not cash out.',
            );
        } finally {
            setBusy(false);
        }
    };

    const hazardList = finished && round?.hazards ? round.hazards : [];
    const gridBomb = (index: number) =>
        Array.isArray(hazardList) && hazardList.includes(index);

    return (
        <OriginalShell
            game={game}
            balance={coins}
            bets={bets}
            bet={bet}
            onBet={setBet}
            /* an open round must keep the cash-out button live */
            playing={busy}
            betLocked={open}
            onPlay={open ? cashout : start}
            playDisabled={Boolean(road && open && step === 0)}
            playLabel={
                open
                    ? road && step === 0
                        ? 'Hop below to cash out'
                        : `${t('game.cashOut')} · ${formatCoins(Math.round(bet * multiplier), 0)}`
                    : `Bet · ${formatCoins(bet, 0)}`
            }
            message={message}
            related={related}
            controls={
                <div className="space-y-2">
                    {config.shape === 'grid' && !open && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-semibold">
                                <span className="text-dim">Mines</span>
                                <span
                                    className="font-bold"
                                    style={{ color: accent }}
                                >
                                    {firstHit(hazards).toFixed(2)}× first hit
                                </span>
                            </div>
                            <select
                                value={hazards}
                                onChange={(e) =>
                                    setHazards(Number(e.target.value))
                                }
                                disabled={busy}
                                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm font-bold text-white outline-none focus:border-lime/60"
                            >
                                {(config.hazards ?? []).map((count) => (
                                    <option key={count} value={count}>
                                        {count}{' '}
                                        {count === 1 ? 'mine' : 'mines'} —{' '}
                                        {firstHit(count).toFixed(2)}× first hit
                                    </option>
                                ))}
                            </select>
                            <div className="grid grid-cols-4 gap-1.5">
                                {(config.hazards ?? []).map((count) => (
                                    <button
                                        key={count}
                                        type="button"
                                        onClick={() => setHazards(count)}
                                        disabled={busy}
                                        className={cn(
                                            'rounded-lg border py-1.5 text-xs font-bold transition',
                                            hazards === count
                                                ? ''
                                                : 'border-white/5 bg-black/40 text-dim hover:text-white',
                                        )}
                                        style={
                                            hazards === count
                                                ? {
                                                      borderColor: `${accent}99`,
                                                      background: `${accent}22`,
                                                      color: accent,
                                                  }
                                                : undefined
                                        }
                                    >
                                        {count}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {(road || tower) && (
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-semibold">
                                <span className="text-dim">Difficulty</span>
                                <span
                                    className="font-bold"
                                    style={{ color: accent }}
                                >
                                    {road
                                        ? `${(roadChance * 100).toFixed(0)}% safe per lane`
                                        : `${(floorSafe * 100).toFixed(0)}% safe per floor`}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 gap-1.5">
                                {config.difficulties.map((option) => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => setDifficulty(option.id)}
                                        disabled={busy || open}
                                        className={cn(
                                            'rounded-lg border py-1.5 text-[11px] font-bold transition',
                                            difficulty === option.id
                                                ? ''
                                                : 'border-white/5 bg-black/40 text-dim hover:text-white',
                                            (busy || open) &&
                                                'cursor-not-allowed opacity-60',
                                        )}
                                        style={
                                            difficulty === option.id
                                                ? {
                                                      borderColor: `${accent}99`,
                                                      background: `${accent}22`,
                                                      color: accent,
                                                  }
                                                : undefined
                                        }
                                        title={
                                            option.step_multiplier
                                                ? `${option.step_multiplier.toFixed(2)}x per lane`
                                                : option.options
                                                  ? `${option.options} tiles per floor`
                                                  : undefined
                                        }
                                    >
                                        {option.label}
                                        <span className="block text-[9px] font-semibold opacity-70">
                                            {option.step_multiplier
                                                ? `${option.step_multiplier.toFixed(2)}x`
                                                : option.options
                                                  ? `${option.options} tiles`
                                                  : ''}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-dim">
                        <span>
                            Step{' '}
                            <b className="text-white">
                                {step}
                                {round ? `/${round.max_steps}` : ''}
                            </b>
                        </span>
                        <span>
                            Next{' '}
                            <b className="text-white">
                                {round
                                    ? `${round.next_multiplier.toFixed(2)}x`
                                    : '—'}
                            </b>
                        </span>
                    </div>
                </div>
            }
        >
            <div className="relative overflow-hidden py-2">


                {/* multiplier strip */}
                <div className="relative mx-auto mb-3 flex max-w-md items-stretch gap-2 rounded-2xl bg-black/40 p-2 ring-1 ring-white/10">
                    <Stat label="Multiplier" value={`${multiplier.toFixed(2)}x`} accent={accent} />
                    <Stat
                        label="Next step"
                        value={
                            round
                                ? `${round.next_multiplier.toFixed(2)}x`
                                : '—'
                        }
                    />
                    <Stat
                        label="Cash out"
                        value={formatCoins(Math.round(bet * multiplier), 0)}
                    />
                    <div className="absolute inset-x-2 bottom-0 h-[2px] overflow-hidden rounded-full bg-white/10">
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: round
                                    ? `${Math.min(100, (step / Math.max(1, round.max_steps)) * 100)}%`
                                    : '0%',
                                background: accent,
                            }}
                        />
                    </div>
                </div>

                {config.skin === 'road' ? (
                    <ChickenRoad
                        round={round}
                        open={open}
                        busy={busy}
                        steps={rows}
                        chance={roadChance}
                        accent={accent}
                        onHop={() => reveal(0)}
                    />
                ) : config.shape === 'grid' ? (
                    <div
                        className={cn(
                            'mx-auto grid max-w-[26rem] gap-2.5',
                            cells <= 9 ? 'grid-cols-3' : 'grid-cols-5',
                        )}
                    >
                        {Array.from({ length: cells }, (_, index) => {
                            const revealed =
                                round?.revealed.includes(index) ?? false;
                            const hit = round?.hit === index;
                            const bomb = gridBomb(index);
                            const clickable = open && !busy && !revealed;

                            return (
                                <button
                                    key={index}
                                    type="button"
                                    disabled={!clickable}
                                    onClick={() => reveal(index)}
                                    className={cn(
                                        'group relative aspect-square overflow-hidden rounded-2xl ring-1 ring-white/15 transition-all duration-200',
                                        'bg-[linear-gradient(160deg,rgba(255,255,255,0.16),rgba(255,255,255,0.02))]',
                                        'shadow-[inset_0_1px_0_rgba(255,255,255,0.10),inset_0_-10px_18px_rgba(0,0,0,0.35)]',
                                        clickable &&
                                            'hover:-translate-y-0.5 hover:ring-white/30 active:scale-95',
                                        revealed && 'ring-0',
                                        (hit || (bomb && finished)) && 'ring-0',
                                    )}
                                    style={{
                                        background: revealed
                                            ? `linear-gradient(160deg, ${accent}33, ${accent}0d)`
                                            : hit || (bomb && finished)
                                              ? 'linear-gradient(160deg, rgba(244,63,94,0.35), rgba(244,63,94,0.08))'
                                              : undefined,
                                        boxShadow: revealed
                                            ? `inset 0 0 0 1px ${accent}66`
                                            : undefined,
                                    }}
                                >
                                    <span
                                        className={cn(
                                            'flex size-full items-center justify-center text-2xl transition-transform',
                                            revealed && 'scale-110',
                                        )}
                                    >
                                        {!revealed &&
                                            !hit &&
                                            !(bomb && finished) && (
                                                <span className="absolute inset-0 flex items-center justify-center opacity-[0.07]">
                                                    <GemIcon className="size-9" />
                                                </span>
                                            )}
                                        {revealed ? (
                                            <GemIcon className="size-9 drop-shadow-[0_6px_14px_rgba(190,242,100,0.45)]" />
                                        ) : hit || (bomb && finished) ? (
                                            <BombIcon
                                                className="size-9"
                                                exploded={hit}
                                            />
                                        ) : null}
                                    </span>

                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="mx-auto flex max-w-sm flex-col-reverse gap-2">
                        {Array.from({ length: rows }, (_, row) => {
                            const cleared = step > row;
                            const active = open && step === row;
                            const lostHere =
                                finished && round?.hit !== null && step === row;

                            return (
                                <div
                                    key={row}
                                    className={cn(
                                        'flex items-center gap-2 rounded-xl px-1 py-1 transition-all',
                                        active && 'bg-white/[0.06]',
                                        // Only dim floors that are still locked mid-round.
                                        open && !active && !cleared && 'opacity-45',
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'w-5 text-center text-[10px] font-bold',
                                            cleared ? '' : 'text-dim',
                                        )}
                                        style={cleared ? { color: accent } : undefined}
                                    >
                                        {row + 1}
                                    </span>
                                    <div
                                        className={cn(
                                            'grid flex-1 gap-2',
                                            rowOptions <= 2
                                                ? 'grid-cols-2'
                                                : rowOptions === 3
                                                  ? 'grid-cols-3'
                                                  : 'grid-cols-4',
                                        )}
                                    >
                                        {Array.from(
                                            { length: rowOptions },
                                            (_, slot) => {
                                                const safe =
                                                    cleared && round
                                                        ? round.revealed[row] ===
                                                          slot
                                                        : false;
                                                const bombHere =
                                                    lostHere &&
                                                    (round?.hazards?.[row] ??
                                                        -1) === slot;

                                                return (
                                                    <button
                                                        key={slot}
                                                        type="button"
                                                        disabled={
                                                            !active || busy
                                                        }
                                                        onClick={() =>
                                                            reveal(slot)
                                                        }
                                                        className={cn(
                                                            'h-11 rounded-lg ring-1 ring-white/10 transition-all',
                                                            'bg-[linear-gradient(160deg,rgba(255,255,255,0.10),rgba(255,255,255,0.02))]',
                                                            active &&
                                                                'hover:-translate-y-0.5 hover:ring-white/30 active:scale-95',
                                                        )}
                                                        style={
                                                            safe
                                                                ? {
                                                                      background: `linear-gradient(160deg, ${accent}33, ${accent}0d)`,
                                                                      boxShadow: `inset 0 0 0 1px ${accent}66`,
                                                                  }
                                                                : bombHere
                                                                  ? {
                                                                        background:
                                                                            'linear-gradient(160deg, rgba(244,63,94,0.35), rgba(244,63,94,0.08))',
                                                                    }
                                                                  : undefined
                                                        }
                                                    >
                                                        {safe ? (
                                                            <GemIcon className="mx-auto size-7" />
                                                        ) : bombHere ? (
                                                            <BombIcon
                                                                className="mx-auto size-7"
                                                                exploded
                                                            />
                                                        ) : null}
                                                    </button>
                                                );
                                            },
                                        )}
                                    </div>
                                    <span
                                        className={cn(
                                            'w-12 text-right text-[11px] font-bold tabular-nums',
                                            cleared ? '' : 'text-dim',
                                        )}
                                        style={
                                            cleared
                                                ? { color: accent }
                                                : undefined
                                        }
                                    >
                                        {(
                                            0.99 *
                                            Math.pow(
                                                rowOptions /
                                                    Math.max(
                                                        1,
                                                        rowOptions - 1,
                                                    ),
                                                row + 1,
                                            )
                                        ).toFixed(2)}
                                        x
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="mt-4 text-center text-xs text-dim">
                    {round
                        ? round.status === 'open'
                            ? `${round.step} safe step${round.step === 1 ? '' : 's'} · ${multiplier.toFixed(2)}x waiting`
                            : round.status === 'won'
                              ? `Paid ${formatCoins(round.payout)} coins`
                              : 'Round lost — start a new one'
                        : 'Pick your settings and start a round.'}
                </div>
            </div>
        </OriginalShell>
    );
}

function Stat({
    label,
    value,
    accent,
}: {
    label: string;
    value: string;
    accent?: string;
}) {
    return (
        <div className="flex-1 text-center">
            <div className="text-[9px] font-semibold tracking-wide text-dim uppercase">
                {label}
            </div>
            <div
                className="text-sm font-black tabular-nums"
                style={accent ? { color: accent } : undefined}
            >
                {value}
            </div>
        </div>
    );
}
