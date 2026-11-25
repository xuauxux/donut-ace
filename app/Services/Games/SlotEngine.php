<?php

namespace App\Services\Games;

use InvalidArgumentException;

/**
 * 5x3 slot engine for the built-in ACEGG games.
 *
 * The reels are drawn here with CSPRNG, paylines are evaluated here, and the
 * win amount is computed here — the browser only animates the result it gets
 * back, so a compromised client cannot invent wins.
 */
final class SlotEngine
{
    /**
     * @param  array<string, mixed>  $game  One entry of config('games.games').
     * @param  array<int, array<int, int>>  $paylines
     */
    public function __construct(
        private readonly array $game,
        private readonly array $paylines,
    ) {
        if (! isset($game['symbols'], $game['paytable'])) {
            throw new InvalidArgumentException('Game definition is incomplete.');
        }
    }

    public static function for(string $gameId): self
    {
        $game = config('games.games.'.$gameId);

        if (! is_array($game)) {
            throw new InvalidArgumentException("Unknown game [{$gameId}].");
        }

        return new self($game, config('games.paylines'));
    }

    /**
     * Spin once. Returns reels as columns (reels[column][row]) so the UI can
     * render each column independently.
     *
     * @return array{
     *     reels: array<int, array<int, string>>,
     *     wins: array<int, array<string, mixed>>,
     *     scatter: int,
     *     scatter_win: int,
     *     total_win: int
     * }
     */
    public function spin(int $bet): array
    {
        $reels = $this->drawGrid();

        $wins = [];
        $total = 0;

        foreach ($this->paylines as $index => $rows) {
            $line = $this->evaluateLine($reels, $rows, $bet, $index + 1);

            if ($line !== null) {
                $wins[] = $line;
                $total += $line['amount'];
            }
        }

        [$scatter, $scatterWin] = $this->evaluateScatter($reels, $bet);

        if ($scatterWin > 0) {
            $wins[] = [
                'line' => 0,
                'symbol' => 'scatter',
                'count' => $scatter,
                'mult' => $this->paytable('scatter')[$scatter] ?? 0,
                'amount' => $scatterWin,
                'cells' => $this->scatterCells($reels),
            ];
        }

        return [
            'reels' => $reels,
            'wins' => $wins,
            'scatter' => $scatter,
            'scatter_win' => $scatterWin,
            'total_win' => $total + $scatterWin,
        ];
    }

    /** @return array<int, array<int, string>> */
    private function drawGrid(): array
    {
        $grid = [];

        for ($column = 0; $column < 5; $column++) {
            for ($row = 0; $row < 3; $row++) {
                $grid[$column][$row] = $this->drawSymbol();
            }
        }

        return $grid;
    }

    private function drawSymbol(): string
    {
        $symbols = $this->game['symbols'];
        $total = array_sum(array_column($symbols, 'weight'));
        $roll = random_int(1, $total);

        foreach ($symbols as $code => $symbol) {
            $roll -= (int) $symbol['weight'];

            if ($roll <= 0) {
                return (string) $code;
            }
        }

        return (string) array_key_last($symbols);
    }

    /**
     * Best left-to-right run on one line. Wilds stand in for everything except
     * the scatter, and the wild symbol also pays for a line of its own.
     *
     * @param  array<int, array<int, string>>  $reels
     * @param  array<int, int>  $rows
     * @return array<string, mixed>|null
     */
    private function evaluateLine(array $reels, array $rows, int $bet, int $lineNumber): ?array
    {
        $cells = [];

        foreach ($rows as $column => $row) {
            $cells[] = $reels[$column][$row];
        }

        $best = null;

        foreach (array_keys($this->paytable()) as $candidate) {
            if ($candidate === 'scatter') {
                continue;
            }

            $count = 0;
            foreach ($cells as $code) {
                if ($code !== $candidate && ! $this->isWild($code)) {
                    break;
                }
                $count++;
            }

            $mult = $this->paytable($candidate)[$count] ?? 0;

            if ($count >= 3 && $mult > 0 && ($best === null || $mult > $best['mult'])) {
                $best = [
                    'line' => $lineNumber,
                    'symbol' => $candidate,
                    'count' => $count,
                    'mult' => $mult,
                    'amount' => $this->pay($bet, $mult),
                    'cells' => $this->winningCells($rows, $count),
                ];
            }
        }

        return $best;
    }

    /**
     * Scatters pay anywhere on the screen, 3 or more.
     *
     * @param  array<int, array<int, string>>  $reels
     * @return array{0: int, 1: int}
     */
    private function evaluateScatter(array $reels, int $bet): array
    {
        $count = 0;

        foreach ($reels as $column) {
            foreach ($column as $code) {
                if ($code === 'scatter') {
                    $count++;
                }
            }
        }

        $mult = $this->paytable('scatter')[$count] ?? 0;

        return [$count, $count >= 3 ? $this->pay($bet, $mult) : 0];
    }

    /** @param  array<int, array<int, string>>  $reels */
    private function scatterCells(array $reels): array
    {
        $cells = [];

        foreach ($reels as $column => $symbols) {
            foreach ($symbols as $row => $code) {
                if ($code === 'scatter') {
                    $cells[] = [$column, $row];
                }
            }
        }

        return $cells;
    }

    /** @return array<int, array<int, int>> */
    private function winningCells(array $rows, int $count): array
    {
        $cells = [];

        for ($column = 0; $column < $count; $column++) {
            $cells[] = [$column, $rows[$column]];
        }

        return $cells;
    }

    /** Paytable values are percentages of the total bet. */
    private function pay(int $bet, int $multiplier): int
    {
        return intdiv($bet * $multiplier, 100);
    }

    private function isWild(string $code): bool
    {
        return (bool) ($this->game['symbols'][$code]['wild'] ?? false);
    }

    /** @return array<string, array<int, int>> */
    private function paytable(?string $only = null): array
    {
        if ($only !== null) {
            return $this->game['paytable'][$only] ?? [];
        }

        return $this->game['paytable'];
    }
}
