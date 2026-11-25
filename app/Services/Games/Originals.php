<?php

namespace App\Services\Games;

use App\Services\Games\Originals\DiceGame;
use App\Services\Games\Originals\KenoGame;
use App\Services\Games\Originals\OriginalGame;
use App\Services\Games\Originals\PlinkoGame;
use App\Support\CoverArt;
use Illuminate\Validation\Rule;
use InvalidArgumentException;

/**
 * Catalog for the instant-win originals. Cards are shaped like a SpinKit game
 * so the lobby treats them exactly like the slots.
 */
final class Originals
{
    public function has(string $id): bool
    {
        return isset($this->definitions()[$id]);
    }

    /** @return array<string, mixed>|null */
    public function definition(string $id): ?array
    {
        return $this->definitions()[$id] ?? null;
    }

    /** @return array<int, array<string, mixed>> */
    public function cards(): array
    {
        return array_values(array_map($this->card(...), array_keys($this->definitions())));
    }

    /** @return array<string, mixed>|null */
    public function find(string $id): ?array
    {
        return $this->has($id) ? $this->card($id) : null;
    }

    /** @return array<int, array<string, mixed>> */
    public function related(string $id, int $limit = 6): array
    {
        $others = array_values(array_filter(
            $this->cards(),
            fn (array $card) => $card['game_id'] !== $id,
        ));

        return array_slice($others, 0, $limit);
    }

    public function make(string $id): OriginalGame
    {
        $definition = $this->definition($id) ?? throw new InvalidArgumentException("Unknown game [{$id}].");

        return match ($id) {
            'dice' => new DiceGame(),
            'plinko' => new PlinkoGame($definition),
            'keno' => new KenoGame($definition),
        };
    }

    /** Everything the UI needs to play the game (bucket values, paytables). */
    public function clientConfig(string $id): array
    {
        $definition = $this->definition($id) ?? [];

        return match ($id) {
            'dice' => ['min_target' => 2, 'max_target' => 98],
            'plinko' => [
                'rows' => $definition['rows'] ?? [],
                'table' => $definition['table'] ?? [],
                'max_balls' => PlinkoGame::MAX_BALLS,
            ],
            'keno' => [
                'pick_max' => $definition['pick_max'] ?? 10,
                'max_number' => $definition['max_number'] ?? 40,
                'draw' => $definition['draw'] ?? 20,
                'paytable' => $definition['paytable'] ?? [],
            ],
            default => [],
        };
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(string $id): array
    {
        $definition = $this->definition($id) ?? [];

        return match ($id) {
            'dice' => [
                'target' => ['required', 'numeric', 'min:2', 'max:98'],
                'direction' => ['required', 'in:under,over'],
            ],
            'plinko' => [
                'rows' => ['required', 'integer', Rule::in($definition['rows'] ?? [])],
                'risk' => ['required', 'in:low,medium,high'],
                'count' => ['sometimes', 'integer', 'min:1', 'max:'.PlinkoGame::MAX_BALLS],
            ],
            'keno' => [
                'picks' => ['required', 'array', 'min:1', 'max:'.($definition['pick_max'] ?? 10)],
                'picks.*' => ['integer', 'distinct', 'min:1', 'max:'.($definition['max_number'] ?? 40)],
            ],
            default => [],
        };
    }

    /** @return array<string, array<string, mixed>> */
    private function definitions(): array
    {
        return config('originals.games', []);
    }

    /** @return array<string, mixed> */
    private function card(string $id): array
    {
        $game = $this->definitions()[$id];

        return [
            'game_id' => $id,
            'name' => $game['name'],
            'category' => $game['category'] ?? 'originals',
            'collection' => 'Donut Ace Originals',
            'mechanic' => $game['mechanic'] ?? 'originals',
            'volatility' => $game['volatility'] ?? null,
            'rtp' => $game['rtp'] ?? null,
            'max_win_x' => (int) ($game['max_win_x'] ?? 0),
            'thumbnail_url' => null,
            'cover_image' => CoverArt::prefer($game['cover'] ?? null),
            'thumbnail_icons' => [],
            'emoji' => $game['emoji'] ?? [],
            'theme' => [
                'accent' => $game['accent'] ?? null,
                'background' => $game['background'] ?? null,
            ],
            'features' => ['feature_buy' => false, 'free_spins' => false],
        ];
    }
}
