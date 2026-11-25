<?php

namespace App\Services\Games\Arcade;

use App\Support\CoverArt;
use InvalidArgumentException;

/**
 * Catalog for the arcade suite. Cards use the same shape as a SpinKit game so
 * the lobby, filters and rails treat every game identically.
 */
final class ArcadeCatalog
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
    public function related(string $id, int $limit = 8): array
    {
        $others = array_values(array_filter(
            $this->cards(),
            fn (array $card) => $card['game_id'] !== $id,
        ));

        return array_slice($others, 0, $limit);
    }

    public function engine(string $id): DrawGame|CaseGame|CrashGame|FlipGame|RouletteGame|DiceGame|ScratchGame|SlotGame|BaccaratGame|LimboGame|CoinPusherGame
    {
        $definition = $this->definition($id) ?? throw new InvalidArgumentException("Unknown game [{$id}].");

        return match ($definition['family']) {
            'draw' => new DrawGame($definition),
            'case' => new CaseGame($definition),
            'crash' => new CrashGame($definition),
            'flip' => new FlipGame($definition),
            'roulette' => new RouletteGame($definition),
            'dice' => new DiceGame($definition),
            'scratch' => new ScratchGame($definition),
            'slot' => new SlotGame($definition + ['id' => $id]),
            'baccarat' => new BaccaratGame($definition),
            'limbo' => new LimboGame($definition),
            'coinpusher' => new CoinPusherGame($definition),
            default => throw new InvalidArgumentException("Game [{$id}] is not a one-shot game."),
        };
    }

    public function ladder(string $id): LadderGame
    {
        $definition = $this->definition($id) ?? throw new InvalidArgumentException("Unknown game [{$id}].");

        if (($definition['family'] ?? null) !== 'ladder') {
            throw new InvalidArgumentException("Game [{$id}] is not a ladder game.");
        }

        return new LadderGame($definition);
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(string $id): array
    {
        $definition = $this->definition($id) ?? [];
        $family = $definition['family'] ?? null;

        return match ($family) {
            'draw' => ($definition['mode'] ?? 'match') === 'match'
                ? ['pick' => ['required', 'string', 'in:'.implode(',', array_keys($definition['options']))]]
                : [],
            'crash' => ['multiplier' => ['required', 'numeric', 'min:1.01', 'max:1000']],
            'limbo' => ['target' => ['required', 'numeric', 'min:1.01', 'max:'.($definition['max_multiplier'] ?? 1000)]],
            'flip' => ['difficulty' => ['required', 'string', 'in:'.implode(',', array_keys($definition['difficulties'] ?? []))]],
            // Roulette carries a whole table of chips in one round.
            'roulette' => [
                'bets' => ['required', 'array', 'min:1'],
                'bets.*' => ['required', 'integer', 'min:1'],
            ],
            'dice', 'baccarat' => ['pick' => ['required', 'string', 'in:'.implode(',', array_keys($definition['markets'] ?? []))]],
            'coinpusher' => ['lane' => ['nullable', 'integer', 'between:0,4']],
            'slot' => [],
            'hilo' => [],
            'scratch' => [],
            'ladder' => match ($definition['shape'] ?? 'grid') {
                'grid' => ['hazards' => ['required', 'integer', 'in:'.implode(',', $definition['hazards'] ?? [])]],
                'road', 'rows' => ['difficulty' => ['nullable', 'string', 'in:'.implode(',', array_keys($definition['difficulties'] ?? []))]],
                default => [],
            },
            default => [],
        };
    }

    /** Everything the UI needs to draw the game. */
    public function clientConfig(string $id): array
    {
        $definition = $this->definition($id) ?? [];

        $options = [];

        foreach ((is_array($rawOptions = $definition['options'] ?? []) ? $rawOptions : []) as $key => $option) {
            $options[] = [
                'id' => (string) $key,
                'label' => (string) ($option['label'] ?? $key),
                'emoji' => (string) ($option['emoji'] ?? ''),
                'mult' => isset($option['p'])
                    ? round(0.99 / (float) $option['p'], 2)
                    : (float) ($option['mult'] ?? 0),
            ];
        }

        // Roulette / dice tables describe their bets as markets; reuse the same
        // option shape the boards already render.
        if (($definition['markets'] ?? []) !== []) {
            // Roulette also sells the 36 straight-up numbers.
            $markets = ($definition['family'] ?? null) === 'roulette'
                ? RouletteGame::markets($definition)
                : $definition['markets'];

            $options = [];
            foreach ($markets as $key => $market) {
                $options[] = [
                    'id' => (string) $key,
                    'label' => (string) ($market['label'] ?? $key),
                    'emoji' => (string) ($market['emoji'] ?? ''),
                    'mult' => (float) ($market['mult'] ?? 0),
                ];
            }
        }

        $symbols = [];
        foreach ($definition['symbols'] ?? [] as $symbol) {
            $symbols[] = [
                'id' => (string) ($symbol['id'] ?? ''),
                'label' => (string) ($symbol['label'] ?? ''),
                'emoji' => (string) ($symbol['emoji'] ?? ''),
                'mult' => (float) ($symbol['mult'] ?? 0),
            ];
        }

        $items = [];
        foreach ($definition['items'] ?? [] as $item) {
            $items[] = [
                'label' => (string) $item['label'],
                'emoji' => (string) ($item['emoji'] ?? ''),
                'mult' => (float) $item['mult'],
            ];
        }

        $difficulties = [];
        foreach (($definition['difficulties'] ?? []) as $key => $difficulty) {
            $chance = isset($difficulty['chance']) ? (float) $difficulty['chance'] : null;

            $difficulties[] = [
                'id' => (string) $key,
                'label' => (string) ($difficulty['label'] ?? $key),
                'tiles' => array_values(array_map(
                    static fn ($tile) => (float) $tile,
                    (array) ($difficulty['tiles'] ?? []),
                )),
                // Road rounds use a per-lane safe chance instead of tiles.
                'chance' => $chance,
                'step_multiplier' => $chance !== null && $chance > 0 ? round(0.99 / $chance, 2) : null,
                'max_steps' => (int) ($difficulty['steps'] ?? $definition['rows'] ?? 0),
                // Tower difficulties change the number of tiles per floor.
                'options' => (int) ($difficulty['options'] ?? $definition['options'] ?? 0),
            ];
        }

        return [
            'family' => $definition['family'] ?? null,
            'mode' => $definition['mode'] ?? null,
            'skin' => $definition['skin'] ?? 'tiles',
            'options' => $options,
            'items' => $items,
            'shape' => $definition['shape'] ?? null,
            'cells' => $definition['cells'] ?? null,
            'hazards' => $definition['hazards'] ?? null,
            'default_hazards' => $definition['default_hazards'] ?? null,
            'rows' => $definition['rows'] ?? null,
            'row_options' => ($definition['shape'] ?? null) === 'rows'
                ? (int) ($definition['options'] ?? 0)
                : null,
            'max_multiplier' => $definition['max_multiplier'] ?? null,
            'difficulties' => $difficulties,
            'default_difficulty' => $definition['default_difficulty'] ?? null,
            'symbols' => $symbols,
            // Slots need the reel faces, the paytable and the payline geometry.
            'slot' => ($definition['family'] ?? null) === 'slot' ? SlotGame::clientConfig($definition) : null,
            'red' => array_map('intval', (array) ($definition['red'] ?? [])),
            'order' => array_map('intval', (array) ($definition['order'] ?? [])),
            'pockets' => $definition['pockets'] ?? null,
            // European wheels default to a single zero; American adds 00.
            'zeros' => array_map('intval', (array) ($definition['zeros'] ?? [0])),
            'lanes' => (int) ($definition['lanes'] ?? 0),
            'paytable' => ($definition['family'] ?? null) === 'videopoker' ? VideoPokerGame::paytable() : null,
        ];
    }

    /** @return array<string, array<string, mixed>> */
    private function definitions(): array
    {
        return config('arcade.games', []);
    }

    /** @return array<string, mixed> */
    private function card(string $id): array
    {
        $game = $this->definitions()[$id];

        return [
            'game_id' => $id,
            'name' => $game['name'],
            'category' => 'arcade',
            'collection' => 'Donut Ace Arcade',
            'mechanic' => 'arcade',
            'volatility' => $game['volatility'] ?? null,
            'rtp' => $game['rtp'] ?? null,
            'max_win_x' => (int) round($game['max_win_x'] ?? 0),
            'thumbnail_url' => null,
            // Cover art is picked up automatically once the file exists.
            'cover_image' => CoverArt::prefer($game['cover'] ?? CoverArt::url($id)),
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
