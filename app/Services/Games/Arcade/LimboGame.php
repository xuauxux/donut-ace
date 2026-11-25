<?php

namespace App\Services\Games\Arcade;

use InvalidArgumentException;

/**
 * Limbo: the player sets a target multiplier and is paid bet × target when the
 * round's crash point reaches it. The crash point is 0.99 / U for a uniform U,
 * so P(crash ≥ x) = 0.99 / x — every target is exactly 99% RTP.
 */
final class LimboGame
{
    /** @param  array<string, mixed>  $config */
    public function __construct(private readonly array $config) {}

    /**
     * @param  array<string, mixed>  $input
     * @return array{multiplier: float, total_win: int, detail: array<string, mixed>}
     */
    public function play(array $input, int $bet): array
    {
        $max = (float) ($this->config['max_multiplier'] ?? 1000);
        $target = round((float) $input['target'], 2);

        if ($target < 1.01) {
            throw new InvalidArgumentException('The target must be at least 1.01x.');
        }

        if ($target > $max) {
            throw new InvalidArgumentException('That target is above the table limit.');
        }

        /* U in (0,1]; flooring to two decimals can only pull the crash down,
         * never push the return above the 99% the target is priced at. */
        $u = random_int(1, 1_000_000) / 1_000_000;
        $crash = min($max, floor(0.99 / $u * 100) / 100);
        $won = $crash >= $target;

        return [
            'multiplier' => $won ? $target : 0.0,
            'total_win' => $won ? intdiv($bet * (int) round($target * 100), 100) : 0,
            'detail' => [
                'target' => $target,
                'crash' => $crash,
                'won' => $won,
            ],
        ];
    }
}
