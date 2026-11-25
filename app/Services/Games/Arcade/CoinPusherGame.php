<?php

namespace App\Services\Games\Arcade;

/**
 * Coin Pusher: a coin goes down one of five lanes and the shelf pushes what it
 * can off the edge. The drop table is fixed and the weights are solved so the
 * whole table returns 99% of the stake:
 *
 *   0.00x 292 · 0.50x 200 · 1.00x 200 · 1.50x 150
 *   2.00x  80 · 3.00x  55 · 5.00x  18 · 10.00x   5
 *
 * = 990 per 1000 units staked. `coins` is how many coin discs the board spills
 * for the animation; the money always comes from `mult`.
 */
final class CoinPusherGame
{
    /** @param  array<string, mixed>  $config */
    public function __construct(private readonly array $config) {}

    /**
     * @param  array<string, mixed>  $input
     * @return array{multiplier: float, total_win: int, detail: array<string, mixed>}
     */
    public function play(array $input, int $bet): array
    {
        $payouts = $this->config['payouts'] ?? [];

        if ($payouts === []) {
            $payouts = [
                ['coins' => 0, 'mult' => 0.0, 'weight' => 292],
                ['coins' => 2, 'mult' => 0.5, 'weight' => 200],
                ['coins' => 4, 'mult' => 1.0, 'weight' => 200],
                ['coins' => 6, 'mult' => 1.5, 'weight' => 150],
                ['coins' => 8, 'mult' => 2.0, 'weight' => 80],
                ['coins' => 12, 'mult' => 3.0, 'weight' => 55],
                ['coins' => 20, 'mult' => 5.0, 'weight' => 18],
                ['coins' => 40, 'mult' => 10.0, 'weight' => 5],
            ];
        }

        $total = 0;

        foreach ($payouts as $payout) {
            $total += max(0, (int) ($payout['weight'] ?? 0));
        }

        $roll = random_int(1, max(1, $total));
        $cursor = 0;
        $chosen = $payouts[0];

        foreach ($payouts as $payout) {
            $cursor += max(0, (int) ($payout['weight'] ?? 0));

            if ($roll <= $cursor) {
                $chosen = $payout;

                break;
            }
        }

        $multiplier = (float) ($chosen['mult'] ?? 0);
        $coins = (int) ($chosen['coins'] ?? 0);
        $lane = min(4, max(0, (int) ($input['lane'] ?? random_int(0, 4))));

        return [
            'multiplier' => $multiplier,
            'total_win' => intdiv($bet * (int) round($multiplier * 100), 100),
            'detail' => [
                'lane' => $lane,
                'coins' => $coins,
                'mult' => $multiplier,
                'won' => $multiplier > 0,
            ],
        ];
    }
}
