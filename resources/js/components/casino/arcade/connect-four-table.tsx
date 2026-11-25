import { useState } from 'react';
import { GameStage } from '@/components/casino/arcade/game-stage';
import { OriginalShell } from '@/components/casino/originals/original-shell';
import { formatCoins } from '@/lib/casino';
import { postJson } from '@/lib/http';
import { cn } from '@/lib/utils';
import type { Game } from '@/types';

type Props = {
    game: Game;
    bets: number[];
    balance: number;
    related: Game[];
};

type Move = { row: number; col: number };

type ConnectFourRound = {
    round_id: string;
    status: 'open' | 'won' | 'lost';
    open: boolean;
    bet: number;
    stake: number;
    payout: number;
    balance: number;
    board: number[];
    rows: number;
    columns: number;
    outcome: 'win' | 'loss' | 'draw' | null;
    last_player: Move | null;
    last_house: Move | null;
};

const OUTCOMES: Record<string, string> = {
    win: 'Four in a row — you win',
    loss: 'The house connected four',
    draw: 'Board full — draw, stake returned',
};

const EMPTY_BOARD = Array.from({ length: 42 }, () => 0);

/**
 * Connect 4 against the house. The board lives on the server; each drop is a
 * move and the house answers after a short beat. Win pays 1.98x, a draw pushes.
 */
export function ConnectFourTable({ game, bets, balance, related }: Props) {
    const [coins, setCoins] = useState(balance);
    const [bet, setBet] = useState(bets[Math.min(1, bets.length - 1)] ?? 0);
    const [round, setRound] = useState<ConnectFourRound | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const accent = game.accent ?? '#f5b82e';
    const open = round?.open ?? false;
    const outcome = round?.outcome ?? null;
    const board = round?.board ?? EMPTY_BOARD;
    const columns = round?.columns ?? 7;
    const rows = round?.rows ?? 6;

    const request = async (url: string, body: Record<string, unknown>) => {
        setBusy(true);
        setMessage(null);

        try {
            const next = await postJson<ConnectFourRound>(url, body);

            /* The server resolves both discs at once. Show the player's drop on
             * its own for a beat so the house reply lands like a real move
             * instead of appearing together with it. */
            if (next.last_house) {
                const house = next.last_house;
                const boardBeforeReply = next.board.map((cell, index) =>
                    index === house.row * next.columns + house.col ? 0 : cell,
                );

                setRound({
                    ...next,
                    board: boardBeforeReply,
                    last_house: null,
                    status: 'open',
                    outcome: null,
                    payout: 0,
                });

                await new Promise((resolve) => setTimeout(resolve, 950));
            }

            setRound(next);
            setCoins(next.balance);
        } catch (error) {
            setMessage(
                error instanceof Error ? error.message : 'Something went wrong.',
            );
        } finally {
            setBusy(false);
        }
    };

    const start = () => request('/arcade/connect-4/start', { bet });

    const drop = (column: number) => {
        if (!round?.open || busy) {
            return;
        }

        void request('/arcade/connect-4/drop', {
            round_id: round.round_id,
            column,
        });
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
            onPlay={open ? () => undefined : start}
            playDisabled={open}
            playLabel={
                open
                    ? 'Your move'
                    : `New game · ${formatCoins(bet, 0)}`
            }
            message={message}
            related={related}
            controls={
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                        <span className="text-dim">Win pays</span>
                        <span className="font-bold" style={{ color: accent }}>
                            1.98× · draw returns stake
                        </span>
                    </div>
                    <p className="text-[10px] leading-relaxed text-dim">
                        You drop first. The house answers with a real search —
                        it is strong, not perfect. Skill game, so no fixed RTP.
                    </p>
                </div>
            }
        >
            <GameStage
                accent={accent}
                background={game.background}
                emblem={game.emoji?.[0]}
                className="p-4 sm:p-6"
            >
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-[11px] tracking-wider text-dim uppercase">
                            Connect 4
                        </div>
                        <div className="text-lg font-extrabold text-white">
                            {formatCoins(round?.stake ?? bet, 0)} per game
                        </div>
                    </div>
                    <div className="text-right text-xs font-bold">
                        {outcome ? (
                            <span
                                className={cn(
                                    outcome === 'loss'
                                        ? 'text-rose-400'
                                        : 'text-lime',
                                )}
                            >
                                {OUTCOMES[outcome] ?? outcome}
                            </span>
                        ) : open ? (
                            <span className="text-white/70">
                                {busy ? 'House thinking…' : 'Your move'}
                            </span>
                        ) : (
                            <span className="text-dim">Ready to start</span>
                        )}
                        {round?.payout ? (
                            <div className="text-[11px] text-lime">
                                Paid {formatCoins(round.payout)}
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="mt-4 rounded-2xl bg-[#0b1330]/70 p-2 ring-1 ring-white/10 sm:p-3">
                    <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                        {Array.from({ length: columns }).map((_, column) => (
                            <button
                                key={column}
                                type="button"
                                disabled={!open || busy}
                                onClick={() => drop(column)}
                                aria-label={`Drop a disc in column ${column + 1}`}
                                className="group flex flex-col gap-1 rounded-lg transition enabled:hover:bg-white/[0.05] disabled:cursor-default sm:gap-1.5"
                            >
                                <span className="h-3 text-center text-[9px] leading-none text-transparent transition group-enabled:group-hover:text-white/60">
                                    ▼
                                </span>

                                {Array.from({ length: rows }).map((_, row) => {
                                    const value = board[row * columns + column];
                                    const playerLast =
                                        round?.last_player?.row === row &&
                                        round?.last_player?.col === column;
                                    const houseLast =
                                        round?.last_house?.row === row &&
                                        round?.last_house?.col === column;

                                    return (
                                        <span
                                            key={`${column}-${row}`}
                                            className="relative aspect-square w-full rounded-full bg-[#04070d] shadow-[inset_0_2px_5px_rgba(0,0,0,0.75)] ring-1 ring-white/[0.06]"
                                        >
                                            {value === 1 && (
                                                <span
                                                    key={`p-${column}-${row}`}
                                                    className={cn(
                                                        'absolute inset-0 rounded-full',
                                                        playerLast && 'disc-drop',
                                                    )}
                                                    style={{
                                                        background: `radial-gradient(circle at 34% 28%, #ffe9a8, ${accent} 58%, #7a4c00)`,
                                                        boxShadow: playerLast
                                                            ? `0 0 0 2px rgba(255,255,255,0.65), 0 0 14px ${accent}88`
                                                            : undefined,
                                                    }}
                                                />
                                            )}
                                            {value === 2 && (
                                                <span
                                                    key={`h-${column}-${row}`}
                                                    className={cn(
                                                        'absolute inset-0 rounded-full',
                                                        houseLast && 'disc-drop',
                                                    )}
                                                    style={{
                                                        background:
                                                            'radial-gradient(circle at 34% 28%, #fecdd3, #e11d48 58%, #4c0519)',
                                                        boxShadow: houseLast
                                                            ? '0 0 0 2px rgba(255,255,255,0.65), 0 0 14px #e11d4888'
                                                            : undefined,
                                                    }}
                                                />
                                            )}
                                        </span>
                                    );
                                })}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] text-dim">
                    <span className="flex items-center gap-1.5">
                        <span
                            className="size-2 rounded-full"
                            style={{ background: accent }}
                        />
                        You
                        <span className="ml-2 size-2 rounded-full bg-rose-500" />
                        House
                    </span>
                    <span>
                        {open
                            ? busy
                                ? 'House is searching the board…'
                                : 'Click a column to drop your disc'
                            : 'Tap New game to take the house on'}
                    </span>
                </div>
            </GameStage>
        </OriginalShell>
    );
}
