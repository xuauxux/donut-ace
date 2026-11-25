<?php

namespace App\Http\Controllers\Casino;

use App\Http\Controllers\Controller;
use App\Services\Games\Originals;
use App\Services\Games\Originals\PlinkoGame;
use App\Services\Wallet\WagerService;
use App\Support\GamePresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;
use InvalidArgumentException;

class OriginalController extends Controller
{
    public function __construct(
        private readonly Originals $originals,
        private readonly WagerService $wager,
    ) {}

    public function show(Request $request, string $game): Response
    {
        abort_unless($this->originals->has($game), 404);

        return Inertia::render('casino/original', [
            'game' => GamePresenter::card($this->originals->find($game)),
            'bets' => config('originals.bets'),
            'balance' => (int) $request->user()->balance,
            'config' => $this->originals->clientConfig($game),
            'related' => GamePresenter::cards($this->originals->related($game)),
        ]);
    }

    /** One round: the bet is charged, the game resolves, any win is credited. */
    public function play(Request $request, string $game): JsonResponse
    {
        abort_unless($this->originals->has($game), 404);

        $data = $request->validate([
            'bet' => self::betRules(config('originals.bets')),
            ...$this->originals->rules($game),
        ]);

        $bet = (int) $data['bet'];
        /* Plinko can release several balls at once: they are settled as one
         * round for count x bet, so a single lock still covers the whole drop. */
        $count = $game === 'plinko' ? (int) ($data['count'] ?? 1) : 1;
        $stake = $bet * $count;
        $user = $request->user();

        if ($user->balance < $stake) {
            return response()->json(['message' => 'Not enough coins — top up to keep playing.'], 422);
        }

        // One round at a time per player: a double click must never be charged twice.
        $lock = Cache::lock('original:'.$user->id, 10);

        if (! $lock->get()) {
            return response()->json(['message' => 'A round is already in progress.'], 429);
        }

        try {
            $engine = $this->originals->make($game);
            $outcome = $this->wager->play(
                $user,
                $game,
                $stake,
                fn () => $engine instanceof PlinkoGame && $count > 1
                    ? $engine->playMany($data, $bet, $count)
                    : $engine->play($data, $bet),
            );
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } finally {
            $lock->release();
        }

        return response()->json([
            ...$outcome,
            'bet' => $stake,
            'count' => $count,
            'game' => $game,
        ]);
    }
}
