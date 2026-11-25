<?php

namespace App\Services\Games\Originals;

/**
 * Keno: the player picks numbers, 20 of 40 are drawn, and the payout depends on
 * how many picks matched. Tables are per pick count and tuned to ~99% RTP.
 */
final class KenoGame implements OriginalGame
{
    /** @param  array<string, mixed>  $config  One config('originals.games.keno'). */
    public function __construct(private readonly array $config) {}

    public function play(array $input, int $bet): array
    {
        $picks = array_values(array_unique(array_map('intval', (array) $input['picks'])));
        sort($picks);

        $draw = $this->draw($this->config['max_number'], $this->config['draw']);
        $hits = count(array_intersect($picks, $draw));

        $multiplier = (float) ($this->config['paytable'][count($picks)][$hits] ?? 0);

        return [
            'multiplier' => $multiplier,
            'total_win' => intdiv($bet * (int) round($multiplier * 100), 100),
            'detail' => [
                'picks' => $picks,
                'draw' => $draw,
                'hits' => $hits,
            ],
        ];
    }

    /**
     * Draw without replacement using CSPRNG (Fisher–Yates).
     *
     * @return array<int, int>
     */
    private function draw(int $maxNumber, int $count): array
    {
        $pool = range(1, $maxNumber);

        for ($i = count($pool) - 1; $i > 0; $i--) {
            $j = random_int(0, $i);
            [$pool[$i], $pool[$j]] = [$pool[$j], $pool[$i]];
        }

        $draw = array_slice($pool, 0, $count);
        sort($draw);

        return $draw;
    }
}
