<?php

namespace App\Services\Games\Arcade;

/**
 * Connect 4 on a 6x7 board against the house.
 *
 * The board is a flat array of 42 cells, row 0 at the top: 0 empty, 1 player,
 * 2 house. The player always drops first. The house plays a shallow
 * alpha-beta search with an occasional random move so it is strong but not
 * perfect — the round is a skill game, not a fixed-RTP draw.
 */
final class ConnectFourGame
{
    public const ROWS = 6;

    public const COLS = 7;

    public const EMPTY = 0;

    public const PLAYER = 1;

    public const HOUSE = 2;

    /** @return array<int, int> */
    public static function empty(): array
    {
        return array_fill(0, self::ROWS * self::COLS, self::EMPTY);
    }

    /**
     * Drop a disc into a column.
     *
     * @param  array<int, int>  $board
     * @return array{board: array<int, int>, row: int}|null null when the column is full
     */
    public static function drop(array $board, int $col, int $player): ?array
    {
        if ($col < 0 || $col >= self::COLS) {
            return null;
        }

        for ($row = self::ROWS - 1; $row >= 0; $row--) {
            $index = $row * self::COLS + $col;

            if ($board[$index] === self::EMPTY) {
                $board[$index] = $player;

                return ['board' => $board, 'row' => $row];
            }
        }

        return null;
    }

    /** @param  array<int, int>  $board */
    public static function winner(array $board): int
    {
        foreach ([[0, 1], [1, 0], [1, 1], [1, -1]] as [$dr, $dc]) {
            for ($row = 0; $row < self::ROWS; $row++) {
                for ($col = 0; $col < self::COLS; $col++) {
                    $value = $board[$row * self::COLS + $col];

                    if ($value === self::EMPTY) {
                        continue;
                    }

                    $run = true;

                    for ($step = 1; $step < 4; $step++) {
                        $r = $row + $dr * $step;
                        $c = $col + $dc * $step;

                        if ($r < 0 || $r >= self::ROWS || $c < 0 || $c >= self::COLS
                            || $board[$r * self::COLS + $c] !== $value) {
                            $run = false;

                            break;
                        }
                    }

                    if ($run) {
                        return $value;
                    }
                }
            }
        }

        return self::EMPTY;
    }

    /** @param  array<int, int>  $board */
    public static function full(array $board): bool
    {
        return ! in_array(self::EMPTY, $board, true);
    }

    /**
     * The house's reply: take an immediate win, block one, otherwise search a
     * few plies. One move in six is picked at random to keep it human.
     *
     * @param  array<int, int>  $board
     */
    public static function houseMove(array $board): ?int
    {
        $legal = self::legalColumns($board);

        if ($legal === []) {
            return null;
        }

        /* A house that never slips is no fun to play; roughly a fifth of the
         * time it takes a plausible but indifferent move instead. */
        if (random_int(1, 100) <= 22) {
            return $legal[array_rand($legal)];
        }

        foreach ($legal as $col) {
            $trial = self::drop($board, $col, self::HOUSE);

            if ($trial !== null && self::winner($trial['board']) === self::HOUSE) {
                return $col;
            }
        }

        foreach ($legal as $col) {
            $trial = self::drop($board, $col, self::PLAYER);

            if ($trial !== null && self::winner($trial['board']) === self::PLAYER) {
                return $col;
            }
        }

        $best = $legal[0];
        $bestScore = -INF;

        foreach ($legal as $col) {
            $trial = self::drop($board, $col, self::HOUSE);

            if ($trial === null) {
                continue;
            }

            $score = self::search($trial['board'], 2, -INF, INF, self::PLAYER);

            if ($score > $bestScore) {
                $bestScore = $score;
                $best = $col;
            }
        }

        return $best;
    }

    /** @param  array<int, int>  $board */
    private static function search(array $board, int $depth, float $alpha, float $beta, int $turn): float
    {
        $winner = self::winner($board);

        if ($winner === self::HOUSE) {
            return 100000 + $depth;
        }

        if ($winner === self::PLAYER) {
            return -100000 - $depth;
        }

        if ($depth === 0 || self::full($board)) {
            return self::score($board);
        }

        $legal = self::legalColumns($board);

        if ($turn === self::HOUSE) {
            $value = -INF;

            foreach ($legal as $col) {
                $next = self::drop($board, $col, self::HOUSE);

                if ($next === null) {
                    continue;
                }

                $value = max($value, self::search($next['board'], $depth - 1, $alpha, $beta, self::PLAYER));
                $alpha = max($alpha, $value);

                if ($alpha >= $beta) {
                    break;
                }
            }

            return $value;
        }

        $value = INF;

        foreach ($legal as $col) {
            $next = self::drop($board, $col, self::PLAYER);

            if ($next === null) {
                continue;
            }

            $value = min($value, self::search($next['board'], $depth - 1, $alpha, $beta, self::HOUSE));
            $beta = min($beta, $value);

            if ($alpha >= $beta) {
                break;
            }
        }

        return $value;
    }

    /**
     * Position score: every window of four that only one side can still take.
     *
     * @param  array<int, int>  $board
     */
    public static function score(array $board): float
    {
        $score = 0.0;
        $windows = self::windows();

        foreach ($windows as $window) {
            $house = 0;
            $player = 0;

            foreach ($window as $index) {
                if ($board[$index] === self::HOUSE) {
                    $house++;
                } elseif ($board[$index] === self::PLAYER) {
                    $player++;
                }
            }

            if ($house > 0 && $player > 0) {
                continue;
            }

            if ($house === 3) {
                $score += 24;
            } elseif ($house === 2) {
                $score += 6;
            } elseif ($house === 1) {
                $score += 1;
            }

            if ($player === 3) {
                $score -= 26;
            } elseif ($player === 2) {
                $score -= 7;
            } elseif ($player === 1) {
                $score -= 1;
            }
        }

        // Prefer the middle columns: more ways to build four.
        foreach ([3, 2, 4, 1, 5, 0, 6] as $weight => $col) {
            for ($row = 0; $row < self::ROWS; $row++) {
                $value = $board[$row * self::COLS + $col];

                if ($value === self::HOUSE) {
                    $score += 3;
                } elseif ($value === self::PLAYER) {
                    $score -= 3;
                }
            }
        }

        return $score;
    }

    /**
     * @param  array<int, int>  $board
     * @return array<int, int>
     */
    private static function legalColumns(array $board): array
    {
        $legal = [];

        for ($col = 0; $col < self::COLS; $col++) {
            if ($board[$col] === self::EMPTY) {
                $legal[] = $col;
            }
        }

        return $legal;
    }

    /** @return array<int, array<int, int>> */
    private static function windows(): array
    {
        $windows = [];

        for ($row = 0; $row < self::ROWS; $row++) {
            for ($col = 0; $col < self::COLS; $col++) {
                foreach ([[0, 1], [1, 0], [1, 1], [1, -1]] as [$dr, $dc]) {
                    $endRow = $row + $dr * 3;
                    $endCol = $col + $dc * 3;

                    if ($endRow < 0 || $endRow >= self::ROWS || $endCol < 0 || $endCol >= self::COLS) {
                        continue;
                    }

                    $cells = [];

                    for ($step = 0; $step < 4; $step++) {
                        $cells[] = ($row + $dr * $step) * self::COLS + ($col + $dc * $step);
                    }

                    $windows[] = $cells;
                }
            }
        }

        return $windows;
    }
}
