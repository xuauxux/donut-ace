<?php

namespace App\Services\Games\Arcade;

/**
 * Crash with an auto-cashout target. The crash point is 0.99 / (1 - u), so the
 * chance of reaching any target t is exactly 0.99 / t — a flat 1% house edge.
 */
final class CrashGame
{
    /** @param  array<string, mixed>  $config */
    public function __construct(private readonly array $config) {}

    /**
     * @param  array<string, mixed>  $input
     * @return array{multiplier: float, total_win: int, detail: array<string, mixed>}
     */
    public function play(array $input, int $bet): array
    {
        $target = (float) $input['multiplier'];

        $u = random_int(1, 999_999) / 1_000_000;
        $crash = floor(99 / (1 - $u)) / 100;
        $won = $crash >= $target;

        return [
            'multiplier' => $target,
            'total_win' => $won ? (int) round($bet * $target) : 0,
            'detail' => [
                'crash' => $crash,
                'target' => $target,
                'won' => $won,
            ],
        ];
    }
}
