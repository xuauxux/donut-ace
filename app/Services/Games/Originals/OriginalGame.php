<?php

namespace App\Services\Games\Originals;

/**
 * One play of an originals game. Implementations draw their own randomness and
 * decide the payout; the wallet settlement happens around them.
 */
interface OriginalGame
{
    /**
     * @param  array<string, mixed>  $input  Already validated player input.
     * @param  int  $bet  Wager in minor units.
     * @return array{multiplier: float, total_win: int, detail: array<string, mixed>}
     */
    public function play(array $input, int $bet): array;
}
