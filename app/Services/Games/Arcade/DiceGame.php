<?php

namespace App\Services\Games\Arcade;

use InvalidArgumentException;

/**
 * Dice Duel: two fair dice. Markets are chosen so the payout is exact at two
 * decimals — even/odd (18/36 → 1.98x), doubles or exactly 7 (6/36 → 5.94x) and
 * 2 or 12 (2/36 → 17.82x) — every one of them 99% RTP.
 */
final class DiceGame
{
    /** @param  array<string, mixed>  $config */
    public function __construct(private readonly array $config) {}

    /**
     * @param  array<string, mixed>  $input
     * @return array{multiplier: float, total_win: int, detail: array<string, mixed>}
     */
    public function play(array $input, int $bet): array
    {
        $markets = $this->config['markets'] ?? [];
        $pick = (string) ($input['pick'] ?? '');

        if (! isset($markets[$pick])) {
            throw new InvalidArgumentException('That bet is not on the table.');
        }

        $first = random_int(1, 6);
        $second = random_int(1, 6);
        $total = $first + $second;

        $won = match ($pick) {
            'even' => $total % 2 === 0,
            'odd' => $total % 2 === 1,
            'doubles' => $first === $second,
            'seven' => $total === 7,
            'extreme' => $total === 2 || $total === 12,
            default => false,
        };

        $multiplier = (float) ($markets[$pick]['mult'] ?? 0);

        return [
            'multiplier' => $multiplier,
            'total_win' => $won
                ? intdiv($bet * (int) round($multiplier * 100), 100)
                : 0,
            'detail' => [
                'dice' => [$first, $second],
                'total' => $total,
                'pick' => $pick,
                'multiplier' => $multiplier,
                'won' => $won,
            ],
        ];
    }
}
