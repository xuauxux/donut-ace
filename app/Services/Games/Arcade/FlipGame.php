<?php

namespace App\Services\Games\Arcade;

use InvalidArgumentException;

/**
 * Donut Flip: a coin lands on one of the sixteen board tiles. Every tile is
 * equally likely, so a board's coin tiles sum to 0.99 × 16 and the board is
 * exactly 99% RTP; a skull tile pays nothing.
 *
 * The landing tile is drawn with the CSPRNG — the browser only animates it.
 */
final class FlipGame
{
    /** @param  array<string, mixed>  $config */
    public function __construct(private readonly array $config) {}

    /**
     * @param  array<string, mixed>  $input
     * @return array{multiplier: float, total_win: int, detail: array<string, mixed>}
     */
    public function play(array $input, int $bet): array
    {
        $difficulties = $this->config['difficulties'] ?? [];

        /** @var array<string, mixed> $boards */
        $boards = is_array($difficulties) ? $difficulties : [];

        $difficulty = (string) (
            $input['difficulty']
            ?? $this->config['default_difficulty']
            ?? array_key_first($boards)
        );

        if (! isset($boards[$difficulty])) {
            throw new InvalidArgumentException('That difficulty is not on the board.');
        }

        $tiles = array_values(array_map(
            static fn ($tile) => (float) $tile,
            (array) ($boards[$difficulty]['tiles'] ?? []),
        ));

        if ($tiles === []) {
            throw new InvalidArgumentException('This board has no tiles.');
        }

        $index = random_int(0, count($tiles) - 1);
        $multiplier = $tiles[$index];

        return [
            'multiplier' => $multiplier,
            'total_win' => intdiv($bet * (int) round($multiplier * 100), 100),
            'detail' => [
                'difficulty' => $difficulty,
                'index' => $index,
                'multiplier' => $multiplier,
                'won' => $multiplier > 0,
            ],
        ];
    }
}
