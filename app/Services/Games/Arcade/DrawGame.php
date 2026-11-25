<?php

namespace App\Services\Games\Arcade;

use InvalidArgumentException;

/**
 * One draw. Two modes:
 *
 *  match — the player bets on an option and wins if that option is drawn;
 *          the multiplier is 0.99 / probability, so every market is 99% RTP.
 *  prize — the draw itself pays, using each option's own multiplier (the
 *          option weights are tuned so the game lands on its listed RTP).
 */
final class DrawGame
{
    /** @param  array<string, mixed>  $config */
    public function __construct(private readonly array $config) {}

    /**
     * @param  array<string, mixed>  $input
     * @return array{multiplier: float, total_win: int, detail: array<string, mixed>}
     */
    public function play(array $input, int $bet): array
    {
        $options = $this->config['options'] ?? [];
        $drawn = $this->draw($options);

        if (($this->config['mode'] ?? 'match') === 'prize') {
            $multiplier = (float) ($options[$drawn]['mult'] ?? 0);

            return [
                'multiplier' => $multiplier,
                'total_win' => $this->pay($bet, $multiplier),
                'detail' => [
                    'drawn' => $drawn,
                    'drawn_label' => (string) ($options[$drawn]['label'] ?? $drawn),
                    'won' => $multiplier > 0,
                ],
            ];
        }

        $pick = (string) ($input['pick'] ?? '');

        if (! isset($options[$pick])) {
            throw new InvalidArgumentException('That bet is not on the board.');
        }

        $multiplier = round(0.99 / (float) $options[$pick]['p'], 2);
        $won = $drawn === $pick;

        return [
            'multiplier' => $multiplier,
            'total_win' => $won ? $this->pay($bet, $multiplier) : 0,
            'detail' => [
                'drawn' => $drawn,
                'drawn_label' => (string) ($options[$drawn]['label'] ?? $drawn),
                'pick' => $pick,
                'won' => $won,
            ],
        ];
    }

    /**
     * Weighted draw using the CSPRNG. `p` is used for match games, `weight`
     * for prize games.
     *
     * @param  array<string, array<string, mixed>>  $options
     */
    private function draw(array $options): string
    {
        $weights = [];
        $total = 0.0;

        foreach ($options as $key => $option) {
            $weight = (float) ($option['p'] ?? $option['weight'] ?? 1);
            $weights[$key] = $weight;
            $total += $weight;
        }

        // Integer weights keep the draw exact.
        $scale = 1_000_000;
        $roll = random_int(1, max(1, (int) round($total * $scale)));
        $cursor = 0;

        foreach ($weights as $key => $weight) {
            $cursor += (int) round($weight * $scale);

            if ($roll <= $cursor) {
                return (string) $key;
            }
        }

        return (string) array_key_last($weights);
    }

    private function pay(int $bet, float $multiplier): int
    {
        return intdiv($bet * (int) round($multiplier * 100), 100);
    }
}
