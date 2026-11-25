<?php

namespace App\Services\Games\Originals;

/**
 * Roll a number between 0 and 100 and bet on whether it lands under or over a
 * target. Payout = 99 / win chance, so the house edge is a flat 1%.
 */
final class DiceGame implements OriginalGame
{
    public function play(array $input, int $bet): array
    {
        $direction = ($input['direction'] ?? 'under') === 'over' ? 'over' : 'under';
        $targetBp = (int) round((float) $input['target'] * 100); // basis points

        $winChanceBp = $direction === 'under' ? $targetBp : 10_000 - $targetBp;
        $roll = random_int(0, 9_999) / 100; // 0.00 – 99.99
        $target = $targetBp / 100;

        $won = $direction === 'under' ? $roll < $target : $roll > $target;
        $multiplier = $winChanceBp > 0 ? 9_900 / $winChanceBp : 0.0;
        $win = $won ? intdiv($bet * 9_900, $winChanceBp) : 0;

        return [
            'multiplier' => round($multiplier, 2),
            'total_win' => $win,
            'detail' => [
                'roll' => $roll,
                'target' => $target,
                'direction' => $direction,
                'win_chance' => round($winChanceBp / 100, 2),
            ],
        ];
    }
}
