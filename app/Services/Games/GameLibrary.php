<?php

namespace App\Services\Games;

/**
 * Built-in game catalog, shaped like a SpinKit game summary so the lobby
 * cards, filters and rails treat both sources identically.
 */
final class GameLibrary
{
    /** @return array<int, array<string, mixed>> */
    public function catalog(): array
    {
        return array_values(array_map($this->card(...), array_keys($this->definitions())));
    }

    /** @return array<string, mixed>|null */
    public function find(string $id): ?array
    {
        return isset($this->definitions()[$id]) ? $this->card($id) : null;
    }

    /** Other built-in games for the "more like this" rail. */
    public function related(string $id, int $limit = 6): array
    {
        $others = array_values(array_filter(
            $this->catalog(),
            fn (array $game) => $game['game_id'] !== $id,
        ));

        return array_slice($others, 0, $limit);
    }

    /**
     * Symbol list for the client renderer: the browser animates the reels, the
     * server decides what they show.
     *
     * @return array<int, array{code: string, name: string, emoji: string}>
     */
    public function symbols(string $id): array
    {
        $symbols = $this->definitions()[$id]['symbols'] ?? [];
        $list = [];

        foreach ($symbols as $code => $symbol) {
            $list[] = [
                'code' => (string) $code,
                'name' => (string) $symbol['name'],
                'emoji' => (string) $symbol['emoji'],
            ];
        }

        return $list;
    }

    /** @return array<string, array<string, mixed>> */
    private function definitions(): array
    {
        return config('games.games', []);
    }

    /** @return array<string, mixed> */
    private function card(string $id): array
    {
        $game = $this->definitions()[$id];

        return [
            'game_id' => $id,
            'name' => $game['name'],
            'category' => $game['category'] ?? null,
            'collection' => $game['collection'] ?? null,
            'mechanic' => $game['mechanic'] ?? null,
            'volatility' => $game['volatility'] ?? null,
            'rtp' => $game['rtp'] ?? null,
            'max_win_x' => $this->maxWin($game),
            'thumbnail_url' => null,
            'cover_image' => $game['cover'] ?? null,
            'thumbnail_icons' => [],
            'emoji' => $game['emoji'] ?? [],
            'theme' => [
                'accent' => $game['accent'] ?? null,
                'background' => $game['background'] ?? null,
            ],
            'features' => ['feature_buy' => false, 'free_spins' => false],
        ];
    }

    /**
     * Best possible round: the top symbol on all lines plus five scatters.
     *
     * @param  array<string, mixed>  $game
     */
    private function maxWin(array $game): int
    {
        $lines = count(config('games.paylines', []));
        $best = 0;

        foreach ($game['paytable'] as $code => $pays) {
            if ($code !== 'scatter') {
                $best = max($best, (int) ($pays[5] ?? 0));
            }
        }

        return intdiv($best * $lines + (int) ($game['paytable']['scatter'][5] ?? 0), 100);
    }
}
