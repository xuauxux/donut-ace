<?php

namespace App\Http\Controllers\Casino;

use App\Http\Controllers\Controller;
use App\Models\DepositRequest;
use App\Models\GameDeposit;
use App\Services\Deposits\BotDeposits;
use App\Services\Deposits\GameDeposits;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

/**
 * In-game deposits, reference flow:
 *   1. link the IGN by whispering an 8-character code to the bot,
 *   2. say how much you are about to send (a 15-minute pending request),
 *   3. `/pay <bot> <amount>` — the receipt is matched to that request.
 */
class DepositController extends Controller
{
    public function __construct(
        private readonly GameDeposits $deposits,
        private readonly BotDeposits $bot,
    ) {}

    public function show(Request $request): Response
    {
        $user = $request->user();
        $cfg = config('casino.deposit');

        // Tier links arrive as ?amount=500m; anything else falls back to 1m.
        $amount = (string) $request->query('amount');
        if (! preg_match('/^[0-9][0-9.,]{0,20}[kKmMbB]?$/', $amount)) {
            $amount = '1m';
        }

        $this->bot->expireStale();

        return Inertia::render('casino/deposit', [
            'amount' => $amount,
            'enabled' => (bool) $cfg['enabled'],
            'botIgn' => $this->deposits->botIgn(),
            'ign' => $user?->minecraft_username,
            'claimed' => $user?->minecraft_ign_claim,
            'verified' => $user ? $this->bot->verified($user) : false,
            'online' => $this->bridgeOnline(),
            'rate' => [
                'coins_per_million' => (int) $cfg['coins_per_million'],
                'min_game' => (int) $cfg['min_game'],
                'max_game' => (int) $cfg['max_game'],
                'max_pending' => BotDeposits::MAX_PENDING,
                'ttl_minutes' => BotDeposits::REQUEST_TTL_MINUTES,
            ],
            'pending' => $user ? $this->pending($user->id) : [],
            'recent' => $user ? $this->recent($user->id) : [],
        ]);
    }

    /** Shows the code the player must whisper to the bot in game. */
    public function startLink(Request $request): JsonResponse
    {
        $result = $this->bot->startLink($request->user());

        return response()->json(
            $result + ['bot' => $this->deposits->botIgn()],
            isset($result['error']) ? 422 : 200,
        );
    }

    /** "I am about to send 500m" — creates the request the receipt must match. */
    public function create(Request $request): JsonResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'integer', 'min:1', 'max:1000000000000'],
        ]);

        $result = $this->bot->createRequest($request->user(), (int) $data['amount']);

        if ($result['ok']) {
            $result['bot'] = $this->deposits->botIgn();
        }

        return response()->json($result, $result['ok'] ? 200 : 422);
    }

    /** Polled by the deposit page while a link or a payment is in flight. */
    public function status(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user === null) {
            return response()->json(['authenticated' => false]);
        }

        $this->bot->expireStale();

        return response()->json([
            'authenticated' => true,
            'verified' => $this->bot->verified($user),
            'ign' => $user->minecraft_username,
            'online' => $this->bridgeOnline(),
            'pending' => $this->pending($user->id),
            'recent' => $this->recent($user->id),
        ]);
    }

    private function bridgeOnline(): bool
    {
        $beat = Cache::get('mc:bridge');

        return is_array($beat)
            && ($beat['state'] ?? null) === 'online'
            && isset($beat['at'])
            && Carbon::parse($beat['at'])->gt(now()->subSeconds(90));
    }

    /** @return array<int, array<string, mixed>> */
    private function pending(int $userId): array
    {
        return DepositRequest::query()
            ->where('user_id', $userId)
            ->where('status', 'pending')
            ->orderByDesc('id')
            ->limit(5)
            ->get()
            ->map(fn (DepositRequest $r) => $this->bot->present($r))
            ->all();
    }

    /** @return array<int, array<string, mixed>> */
    private function recent(int $userId): array
    {
        return GameDeposit::query()
            ->where('user_id', $userId)
            ->latest('id')
            ->limit(10)
            ->get()
            ->map(fn (GameDeposit $d) => [
                'id' => $d->id,
                'coins' => $d->coins,
                'game_amount' => $d->game_amount,
                'status' => $d->status,
                'at' => $d->seen_at->toIso8601String(),
            ])->all();
    }
}
