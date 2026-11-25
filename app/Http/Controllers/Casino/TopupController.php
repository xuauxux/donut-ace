<?php

namespace App\Http\Controllers\Casino;

use App\Http\Controllers\Controller;
use App\Models\GameDeposit;
use App\Services\Deposits\GameDeposits;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Coins are only ever topped up with in-game money: players pay the bot and the
 * bridge credits them. This page picks an amount; there is no card checkout.
 */
class TopupController extends Controller
{
    public function __construct(private readonly GameDeposits $deposits) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $cfg = config('casino.deposit');
        $rate = (int) $cfg['coins_per_million'];

        return Inertia::render('casino/topup', [
            'tiers' => collect($cfg['tiers'] ?? [])->map(fn (array $tier) => [
                'id' => $tier['id'],
                'name' => $tier['name'],
                'game_amount' => (int) $tier['game'],
                'coins' => intdiv((int) $tier['game'] * $rate * 100, 1_000_000),
            ])->values()->all(),
            'rate' => [
                'coins_per_million' => $rate,
                'min_game' => (int) $cfg['min_game'],
                'max_game' => (int) $cfg['max_game'],
            ],
            'botIgn' => $this->deposits->botIgn(),
            'recent' => $user
                ? GameDeposit::query()->where('user_id', $user->id)->latest('id')->limit(6)->get()
                    ->map(fn (GameDeposit $d) => [
                        'id' => $d->id,
                        'coins' => $d->coins,
                        'game_amount' => $d->game_amount,
                        'status' => $d->status,
                        'at' => $d->seen_at->toIso8601String(),
                    ])->all()
                : [],
        ]);
    }

    /** Real-money purchases are switched off: coins come from in-game payments. */
    public function store(): RedirectResponse
    {
        Inertia::flash('toast', ['type' => 'info', 'message' => 'Coins are topped up in game — pick an amount and pay the bot.']);

        return redirect('/deposit');
    }
}
