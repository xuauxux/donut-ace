<?php

namespace App\Services\Games\Arcade;

/**
 * Math for the cash-out style games (mines, chicken, tower, pump…).
 *
 * The multiplier after k safe steps is 0.99 / P(still alive), so cashing out is
 * never a worse deal than the true odds. Boards are generated here and kept
 * server-side in the round state — the browser never learns where the hazards are.
 */
final class LadderGame
{
    /** Set when a round/tower difficulty uses a different board width. */
    private ?int $rowOptionsOverride = null;

    /** @param  array<string, mixed>  $config */
    public function __construct(private readonly array $config) {}

    /**
     * Same game with a different number of tiles per floor. Tower difficulties
     * pick this, and an open round keeps the width it was dealt with.
     */
    public function withRowOptions(?int $options): self
    {
        $clone = clone $this;
        $clone->rowOptionsOverride = $options !== null && $options > 0 ? $options : null;

        return $clone;
    }

    public function shape(): string
    {
        return (string) ($this->config['shape'] ?? 'grid');
    }

    /** Cells in a grid board, rows in a tower, lanes on the road. */
    public function boardSize(): int
    {
        return (int) (in_array($this->config['shape'] ?? 'grid', ['rows', 'road'], true)
            ? $this->config['rows']
            : $this->config['cells']);
    }

    public function rowOptions(): int
    {
        return $this->rowOptionsOverride ?? (int) ($this->config['options'] ?? 2);
    }

    /**
     * Hazard layout: cell indexes for a grid, one bad index per row for a tower.
     *
     * @return array<int, int>|array<int, array<int, int>>
     */
    public function hazards(int $hazardCount = 0): array
    {
        if ($this->shape() === 'road') {
            return [];
        }

        if ($this->shape() === 'rows') {
            $hazards = [];
            for ($row = 0; $row < $this->boardSize(); $row++) {
                $hazards[] = random_int(0, $this->rowOptions() - 1);
            }

            return $hazards;
        }

        $cells = range(0, $this->boardSize() - 1);
        shuffle($cells);

        return array_slice($cells, 0, max(1, min($hazardCount, $this->boardSize() - 1)));
    }

    /** 0.99 / P(all answered steps were safe). */
    public function multiplier(int $step, int $hazardCount = 0, ?float $chance = null): float
    {
        if ($step <= 0) {
            return 1.0;
        }

        if ($this->shape() === 'road') {
            $p = $chance !== null && $chance > 0 ? $chance : $this->defaultChance();

            return $p > 0 ? round(0.99 / ($p ** $step), 2) : 0.0;
        }

        if ($this->shape() === 'rows') {
            $survive = (($this->rowOptions() - 1) / $this->rowOptions()) ** $step;
        } else {
            $survive = $this->combinationSurvival($step, $hazardCount);
        }

        return $survive > 0 ? round(0.99 / $survive, 2) : 0.0;
    }

    /** C(cells - hazards, k) / C(cells, k) */
    private function combinationSurvival(int $step, int $hazardCount): float
    {
        $total = $this->boardSize();
        $safe = $total - $hazardCount;
        $survive = 1.0;

        for ($i = 0; $i < $step; $i++) {
            if ($safe - $i <= 0) {
                return 0.0;
            }
            $survive *= ($safe - $i) / ($total - $i);
        }

        return $survive;
    }

    /** Safe chance of the configured default difficulty, for road rounds. */
    public function defaultChance(): float
    {
        $key = (string) ($this->config['default_difficulty'] ?? 'medium');
        $chance = (float) ($this->config['difficulties'][$key]['chance'] ?? 0.85);

        return $chance > 0 && $chance < 1 ? $chance : 0.85;
    }

    /** Safe chance for a difficulty key, clamped to a playable range. */
    public function chanceFor(string $difficulty): float
    {
        $chance = (float) ($this->config['difficulties'][$difficulty]['chance'] ?? 0);

        return $chance > 0 && $chance < 1 ? $chance : $this->defaultChance();
    }

    /** Maximum number of safe steps available. */
    public function maxSteps(int $hazardCount = 0): int
    {
        if ($this->shape() === 'road') {
            return $this->boardSize();
        }

        return $this->shape() === 'rows'
            ? $this->boardSize()
            : $this->boardSize() - max(1, $hazardCount);
    }

    /** Is the given pick fatal on this board? */
    public function isHazard(int $pick, array $state): bool
    {
        $hazards = $state['hazards'] ?? [];

        if ($this->shape() === 'road') {
            return false;
        }

        if ($this->shape() === 'rows') {
            $row = (int) $state['step'];

            return (int) ($hazards[$row] ?? -1) === $pick;
        }

        return in_array($pick, $hazards, true);
    }
}
