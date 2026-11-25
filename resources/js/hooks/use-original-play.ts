import { useCallback, useState } from 'react';
import { postJson } from '@/lib/http';
import type { OriginalResult } from '@/types';

type Params = Record<string, unknown>;
type OnResult = (result: OriginalResult) => Promise<void> | void;

/**
 * Shared bet/balance/round state for an originals game. The server resolves the
 * round; `onResult` is awaited so the game can finish its animation before the
 * button comes back.
 */
export function useOriginalPlay(
    gameId: string,
    bets: number[],
    initialBalance: number,
    basePath = '/originals',
) {
    const [balance, setBalance] = useState(initialBalance);
    const [bet, setBet] = useState(bets[Math.min(2, bets.length - 1)] ?? 0);
    const [playing, setPlaying] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const play = useCallback(
        async (params: Params, onResult: OnResult) => {
            if (playing) {
                return;
            }
            if (balance < bet) {
                setMessage('Not enough coins — top up to keep playing.');
                return;
            }

            setMessage(null);
            setPlaying(true);

            try {
                const result = await postJson<OriginalResult>(
                    `${basePath}/${gameId}/play`,
                    { bet, ...params },
                );
                setBalance(result.balance);
                await onResult(result);
            } catch (error) {
                setMessage(
                    error instanceof Error
                        ? error.message
                        : 'Something went wrong.',
                );
            } finally {
                setPlaying(false);
            }
        },
        [balance, basePath, bet, gameId, playing],
    );

    return { balance, bet, setBet, playing, message, play, setMessage };
}
