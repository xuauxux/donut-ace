<?php

namespace App\Services\Games\Arcade;

/**
 * Cases and packs: a weighted item drop. Multipliers are scaled so the listed
 * RTP holds (relative weights tuned to ~99%).
 */
final class CaseGame
{
    /** @param  array<string, mixed>  $config */
    public function __construct(private readonly array $config) {}

    /**
     * @param  array<string, mixed>  $input
     * @return array{multiplier: float, total_win: int, detail: array<string, mixed>}
     */
    public function play(array $input, int $bet): array
    {
        $items = $this->config['items'] ?? [];
        $total = array_sum(array_map(fn (array $item) => (int) $item['weight'], $items));

        $roll = random_int(1, max(1, $total));
        $item = end($items);

        foreach ($items as $candidate) {
            $roll -= (int) $candidate['weight'];

            if ($roll <= 0) {
                $item = $candidate;
                break;
            }
        }

        $multiplier = (float) $item['mult'];

        return [
            'multiplier' => $multiplier,
            'total_win' => intdiv($bet * (int) round($multiplier * 100), 100),
            'detail' => [
                'item' => [
                    'label' => (string) $item['label'],
                    'emoji' => (string) ($item['emoji'] ?? ''),
                    'mult' => $multiplier,
                ],
            ],
        ];
    }
}
