<?php

namespace App\Http\Controllers\Casino;

use App\Http\Controllers\Controller;
use App\Services\Games\GameLibrary;
use App\Services\Games\SlotEngine;
use App\Services\SpinKit\SpinKitClient;
use App\Services\SpinKit\SpinKitException;
use App\Services\Wallet\GameSessionService;
use App\Services\Wallet\WagerService;
use App\Support\GamePresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use InvalidArgumentException;

class PlayController extends Controller
{
    public function __construct(
        private readonly SpinKitClient $spinKit,
        private readonly GameSessionService $sessions,
        private readonly GameLibrary $library,
        private readonly WagerService $wager,
    ) {}

    public function show(Request $request, string $gameId): Response|RedirectResponse
    {
        // Built-in games: played right here, no external game server involved.
        if ($this->library->find($gameId) !== null) {
            return Inertia::render('casino/slot', [
                'game' => GamePresenter::card($this->library->find($gameId)),
                'bets' => config('games.bets'),
                'balance' => $request->user()->balance,
                'symbols' => $this->library->symbols($gameId),
                'related' => GamePresenter::cards($this->library->related($gameId)),
            ]);
        }

        $game = $this->spinKit->findGame($gameId);
        abort_if($game === null, 404);

        try {
            $session = $this->sessions->launch($request->user(), $gameId, route('home'));
        } catch (SpinKitException $e) {
            Log::warning('SpinKit launch failed', ['game' => $gameId, 'code' => $e->errorCode, 'message' => $e->getMessage()]);

            Inertia::flash('toast', ['type' => 'error', 'message' => $this->friendly($e)]);

            return redirect()->route('home');
        }

        $related = collect($this->spinKit->games())
            ->where('game_id', '!=', $gameId)
            ->where('category', $game['category'])
            ->take(6)
            ->values()
            ->all();

        return Inertia::render('casino/play', [
            'game' => GamePresenter::card($game),
            'launchUrl' => $session['launch_url'],
            'related' => GamePresenter::cards($related),
        ]);
    }

    /** One spin of a built-in game: bet in, winnings out, settled atomically. */
    public function spin(Request $request, string $gameId): JsonResponse
    {
        abort_if($this->library->find($gameId) === null, 404);

        $data = $request->validate([
            'bet' => self::betRules(config('games.bets')),
        ]);

        $bet = (int) $data['bet'];
        $user = $request->user();

        if ($user->balance < $bet) {
            return response()->json(['message' => 'Not enough coins — top up to keep playing.'], 422);
        }

        // One spin at a time per player, so a double click can never be charged twice.
        $lock = Cache::lock('slot-spin:'.$user->id, 10);

        if (! $lock->get()) {
            return response()->json(['message' => 'A spin is already in progress.'], 429);
        }

        try {
            $outcome = $this->wager->play(
                $user,
                $gameId,
                $bet,
                fn () => SlotEngine::for($gameId)->spin($bet),
            );
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } finally {
            $lock->release();
        }

        return response()->json($outcome);
    }

    /** Close the game explicitly: coins come back to the main balance. */
    public function leave(Request $request): RedirectResponse
    {
        try {
            $this->sessions->settle($request->user());
        } catch (SpinKitException $e) {
            Log::warning('SpinKit settle failed', ['code' => $e->errorCode, 'message' => $e->getMessage()]);
        }

        return redirect()->route('home');
    }

    public function balance(Request $request): JsonResponse
    {
        return response()->json(['balance' => $this->sessions->liveBalance($request->user())]);
    }

    private function friendly(SpinKitException $e): string
    {
        // Locally show the real reason — production players only see the generic text.
        if (app()->isLocal() && $e->errorCode === 'MERCHANT_MISCONFIGURED') {
            return 'SpinKit merchant has demo_refill ON. Turn it off in SpinKit admin → Merchants, then run php artisan cache:clear.';
        }

        return match ($e->errorCode) {
            'GAME_DISABLED' => 'This game is currently unavailable.',
            'PLAYER_BLOCKED' => 'Your game account is blocked. Please contact support.',
            'INSUFFICIENT_FLOAT', 'MERCHANT_SUSPENDED', 'MERCHANT_MISCONFIGURED' => 'Games are temporarily unavailable. Please try again later.',
            'CONNECTION_FAILED' => 'Game server is not reachable right now.',
            default => 'Could not start the game. Please try again.',
        };
    }
}
