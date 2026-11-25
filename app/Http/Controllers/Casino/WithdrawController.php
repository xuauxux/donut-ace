<?php

namespace App\Http\Controllers\Casino;

use App\Http\Controllers\Controller;
use App\Services\Deposits\BotDeposits;
use App\Services\Deposits\GameDeposits;
use App\Services\Withdrawals\WithdrawalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Coin → in-game money withdrawals.
 *
 * The page only creates a request; the Minecraft bridge claims it, sends one
 * /pay command and reports the result. Coins are debited at request time, so
 * the queue can never overdraw a wallet.
 */
class WithdrawController extends Controller
{
    public function __construct(
        private readonly WithdrawalService $withdrawals,
        private readonly GameDeposits $deposits,
        private readonly BotDeposits $bot,
    ) {}

    public function show(Request $request): Response
    {
        $user = $request->user();
        $cfg = config('casino.withdraw');

        $this->withdrawals->expireStale();
        $verified = $user ? $this->bot->verified($user) : false;

        return Inertia::render('casino/withdraw', [
            'enabled' => (bool) $cfg['enabled'],
            'botIgn' => $this->deposits->botIgn(),
            'ign' => $user?->minecraft_username,
            'verified' => $verified,
            'online' => $this->bridgeOnline(),
            'balance' => (int) ($user?->balance ?? 0),
            'available' => $user && $verified ? $this->withdrawals->availableFor($user) : 0,
            'rate' => [
                'coins_per_million' => (int) config('casino.deposit.coins_per_million'),
                'min_game' => (int) $cfg['min_game'],
                'max_game' => (int) $cfg['max_game'],
                'tax_bps' => (int) $cfg['tax_bps'],
            ],
            'limits' => [
                'daily_game' => (int) $cfg['daily_game'],
                'max_pending' => (int) $cfg['max_pending'],
                'ttl_minutes' => (int) $cfg['pending_ttl_minutes'],
            ],
            'pending' => $user ? $this->withdrawals->pending($user->id) : [],
            'recent' => $user ? $this->withdrawals->recent($user->id) : [],
        ]);
    }

    public function create(Request $request): JsonResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'integer', 'min:1', 'max:1000000000000'],
        ]);

        $result = $this->withdrawals->create($request->user(), (int) $data['amount']);

        return response()->json($result, $result['ok'] ? 200 : 422);
    }

    public function cancel(Request $request): JsonResponse
    {
        $data = $request->validate([
            'id' => ['required', 'integer', 'min:1'],
        ]);

        $result = $this->withdrawals->cancel($request->user(), (int) $data['id']);

        return response()->json($result, $result['ok'] ? 200 : 422);
    }

    public function status(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user === null) {
            return response()->json(['authenticated' => false]);
        }

        $this->withdrawals->expireStale();
        $verified = $this->bot->verified($user);

        return response()->json([
            'authenticated' => true,
            'verified' => $verified,
            'ign' => $user->minecraft_username,
            'online' => $this->bridgeOnline(),
            'balance' => (int) $user->balance,
            'available' => $verified ? $this->withdrawals->availableFor($user) : 0,
            'pending' => $this->withdrawals->pending($user->id),
            'recent' => $this->withdrawals->recent($user->id),
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
}
