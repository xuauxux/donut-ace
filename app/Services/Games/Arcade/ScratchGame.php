<?php

namespace App\Services\Games\Arcade;

use InvalidArgumentException;

/**
 * Scratch Card: nine cells, three of a kind pays. The prize is drawn first from
 * weighted symbol tiers (1.5x · 30%, 3x · 12%, 9x · 2%, nothing · 56% →
 * 0.45 + 0.36 + 0.18 = 99% RTP) and the grid is then built to match it: a
 * winning card holds exactly three of the drawn symbol, a losing card never
 * holds three of any symbol.
 */
final class ScratchGame
{
    /** @param  array<string, mixed>  $config */
    public function __construct(private readonly array $config) {}

    /**
     * @param  array<string, mixed>  $input
     * @return array{multiplier: float, total_win: int, detail: array<string, mixed>}
     */
    public function play(array $input, int $bet): array
    {
        $symbols = [];

        foreach ((array) ($this->config['symbols'] ?? []) as $symbol) {
            $symbols[] = [
                'id' => (string) ($symbol['id'] ?? ''),
                'emoji' => (string) ($symbol['emoji'] ?? ''),
                'label' => (string) ($symbol['label'] ?? ''),
                'mult' => (float) ($symbol['mult'] ?? 0),
                'weight' => (int) ($symbol['weight'] ?? 0),
            ];
        }

        if ($symbols === []) {
            throw new InvalidArgumentException('This card has no symbols.');
        }

        $filler = array_values(array_map('strval', (array) ($this->config['filler'] ?? [])));
        $tiers = $symbols;
        $tiers[] = [
            'id' => 'blank',
            'emoji' => '',
            'label' => '',
            'mult' => 0.0,
            'weight' => (int) ($this->config['lose_weight'] ?? 0),
        ];

        $winner = $this->draw($tiers);
        $won = $winner['mult'] > 0;

        if ($won) {
            $grid = $this->winningGrid($winner['emoji'], $symbols, $filler);
        } else {
            $grid = $this->losingGrid($symbols, $filler);
        }

        $multiplier = (float) $winner['mult'];

        return [
            'multiplier' => $multiplier,
            'total_win' => intdiv($bet * (int) round($multiplier * 100), 100),
            'detail' => [
                'grid' => $grid,
                'symbol' => $won ? $winner['emoji'] : null,
                'label' => $won ? $winner['label'] : null,
                'multiplier' => $multiplier,
                'won' => $won,
            ],
        ];
    }

    /**
     * @param  array<int, array{id: string, emoji: string, label: string, mult: float, weight: int}>  $tiers
     * @return array{id: string, emoji: string, label: string, mult: float, weight: int}
     */
    private function draw(array $tiers): array
    {
        $total = array_sum(array_column($tiers, 'weight'));

        if ($total <= 0) {
            throw new InvalidArgumentException('This card has no prize tiers.');
        }

        $roll = random_int(1, $total);
        $cursor = 0;

        foreach ($tiers as $tier) {
            $cursor += $tier['weight'];

            if ($roll <= $cursor) {
                return $tier;
            }
        }

        return $tiers[array_key_last($tiers)];
    }

    /**
     * Three of the winning symbol plus six cells that never make a second trio.
     *
     * @param  array<int, array{emoji: string}>  $symbols
     * @param  array<int, string>  $filler
     * @return array<int, string>
     */
    private function winningGrid(string $emoji, array $symbols, array $filler): array
    {
        $others = array_values(array_unique(array_filter(
            array_merge(
                array_map(static fn (array $s) => $s['emoji'], $symbols),
                $filler,
            ),
            static fn (string $glyph) => $glyph !== '' && $glyph !== $emoji,
        )));

        $cells = [$emoji, $emoji, $emoji];
        $counts = [];
        $index = 0;

        // Six more cells, each other glyph at most twice so only the prize
        // symbol reaches three.
        while (count($cells) < 9) {
            $glyph = $others[$index % max(1, count($others))] ?? '';
            $index++;

            if (($counts[$glyph] ?? 0) >= 2) {
                continue;
            }

            $counts[$glyph] = ($counts[$glyph] ?? 0) + 1;
            $cells[] = $glyph;
        }

        shuffle($cells);

        return $cells;
    }

    /**
     * A card with no three of a kind (counts 2,2,2,2,1 over five glyphs).
     *
     * @param  array<int, array{emoji: string}>  $symbols
     * @param  array<int, string>  $filler
     * @return array<int, string>
     */
    private function losingGrid(array $symbols, array $filler): array
    {
        $glyphs = array_values(array_filter(
            array_map(static fn (array $s) => $s['emoji'], $symbols),
            static fn (string $glyph) => $glyph !== '',
        ));
        $glyphs = array_values(array_unique(array_merge($glyphs, $filler)));

        // Five glyphs at 2,2,2,2,1: nine cells, nobody reaches three.
        $pad = ['⭐', '💎', '🍀', '🔔', '🎲'];
        while (count($glyphs) < 5) {
            $next = array_shift($pad) ?? '⭐';
            if (! in_array($next, $glyphs, true)) {
                $glyphs[] = $next;
            }
        }
        $glyphs = array_slice($glyphs, 0, 5);

        $cells = [];
        foreach ([[0, 2], [1, 2], [2, 2], [3, 2], [4, 1]] as [$slot, $count]) {
            for ($i = 0; $i < $count; $i++) {
                $cells[] = $glyphs[$slot];
            }
        }

        shuffle($cells);

        return $cells;
    }
}
