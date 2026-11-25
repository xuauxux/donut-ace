<?php

namespace App\Services\Games\Arcade;

/**
 * 5-reel, 3-row slot machine with 20 fixed paylines.
 *
 * Ported from the reference arcade: symbols are drawn by weight, a wild
 * substitutes for any paying symbol, and scatters pay anywhere on the grid.
 * A line pays raw/200 × bet, so the paytable is stated in "per 200 bet" units
 * exactly like the source tables.
 */
final class SlotGame
{
    /** 20 classic 5×3 paylines; each value is the row (0..2) for columns 0..4. */
    public const PAYLINES = [
        [1, 1, 1, 1, 1],
        [0, 0, 0, 0, 0],
        [2, 2, 2, 2, 2],
        [0, 1, 2, 1, 0],
        [2, 1, 0, 1, 2],
        [0, 0, 1, 2, 2],
        [2, 2, 1, 0, 0],
        [1, 0, 0, 0, 1],
        [1, 2, 2, 2, 1],
        [0, 1, 1, 1, 0],
        [2, 1, 1, 1, 2],
        [1, 0, 1, 2, 1],
        [1, 2, 1, 0, 1],
        [0, 1, 0, 1, 0],
        [2, 1, 2, 1, 2],
        [1, 1, 0, 1, 1],
        [1, 1, 2, 1, 1],
        [0, 2, 0, 2, 0],
        [2, 0, 2, 0, 2],
        [0, 2, 1, 2, 0],
    ];

    /** @param  array<string, mixed>  $config */
    public function __construct(private readonly array $config) {}

    /**
     * @param  array<string, mixed>  $input
     * @return array{multiplier: float, total_win: int, detail: array<string, mixed>}
     */
    public function play(array $input, int $bet): array
    {
        $grid = $this->spin();

        $lines = [];
        foreach (self::PAYLINES as $index => $rows) {
            $symbols = [];
            foreach ($rows as $col => $row) {
                $symbols[] = $grid[$col][$row];
            }

            $match = $this->bestMatch($symbols);

            if ($match === null) {
                continue;
            }

            [$symbolId, $count, $multiplier] = $match;
            $coords = [];
            for ($col = 0; $col < $count; $col++) {
                $coords[] = [$col, $rows[$col]];
            }

            $lines[] = [
                'line' => $index,
                'symbol' => $symbolId,
                'count' => $count,
                'coords' => $coords,
                'multiplier' => $multiplier,
                'payout' => $this->pay($bet, $multiplier),
            ];
        }

        $scatter = $this->scatter($grid, $bet);
        $totalWin = array_sum(array_column($lines, 'payout')) + ($scatter['payout'] ?? 0);
        $totalMultiplier = $bet > 0 ? round($totalWin / $bet, 2) : 0.0;

        return [
            'multiplier' => $totalMultiplier,
            'total_win' => (int) $totalWin,
            'detail' => [
                'slug' => $this->config['id'] ?? null,
                'bet' => $bet,
                'grid' => $grid,
                'lines' => $lines,
                'scatter' => $scatter,
                'total_multiplier' => $totalMultiplier,
            ],
        ];
    }

    /**
     * Leading run of one symbol with wild substitution; a pure run of wilds
     * also pays. Returns [symbol, count, multiplier] for the best of the two.
     *
     * @param  array<int, string>  $symbols
     * @return array{0: string, 1: int, 2: float}|null
     */
    private function bestMatch(array $symbols): ?array
    {
        $paytable = $this->config['paytable'] ?? [];
        $target = null;

        foreach ($symbols as $symbol) {
            if ($symbol === 'scatter') {
                break;
            }
            if ($symbol !== 'wild') {
                $target = $symbol;
                break;
            }
        }

        $best = null;

        if ($target !== null) {
            $count = 0;
            foreach ($symbols as $symbol) {
                if ($symbol === $target || $symbol === 'wild') {
                    $count++;
                } else {
                    break;
                }
            }

            if ($count >= 3) {
                $count = min(5, $count);
                $raw = (float) ($paytable[$target][$count] ?? 0);
                if ($raw > 0) {
                    $best = [$target, $count, round(($raw * $this->scale()) / 200, 2)];
                }
            }
        }

        $wilds = 0;
        foreach ($symbols as $symbol) {
            if ($symbol === 'wild') {
                $wilds++;
            } else {
                break;
            }
        }

        if ($wilds >= 3) {
            $wilds = min(5, $wilds);
            $wildMult = round((((float) ($paytable['wild'][$wilds] ?? 0)) * $this->scale()) / 200, 2);

            if ($wildMult > 0 && ($best === null || $wildMult > $best[2])) {
                $best = ['wild', $wilds, $wildMult];
            }
        }

        return $best;
    }

    /**
     * @param  array<int, array<int, string>>  $grid
     * @return array<string, mixed>|null
     */
    private function scatter(array $grid, int $bet): ?array
    {
        $coords = [];
        foreach ($grid as $col => $rows) {
            foreach ($rows as $row => $symbol) {
                if ($symbol === 'scatter') {
                    $coords[] = [$col, $row];
                }
            }
        }

        $count = count($coords);

        if ($count < 3) {
            return null;
        }

        $count = min(5, $count);
        $multiplier = round((((float) ($this->config['paytable']['scatter'][$count] ?? 0)) * $this->scale()) / 200, 2);

        return [
            'count' => $count,
            'coords' => $coords,
            'multiplier' => $multiplier,
            'payout' => $this->pay($bet, $multiplier),
        ];
    }

    /** @return array<int, array<int, string>> 5 columns × 3 rows of symbol ids. */
    private function spin(): array
    {
        $grid = [];

        for ($col = 0; $col < 5; $col++) {
            for ($row = 0; $row < 3; $row++) {
                $grid[$col][$row] = $this->draw();
            }
        }

        return $grid;
    }

    private function draw(): string
    {
        $symbols = $this->config['symbols'] ?? [];
        $total = 0;
        foreach ($symbols as $symbol) {
            $total += (int) $symbol['weight'];
        }

        $roll = random_int(1, max(1, $total));
        $cursor = 0;

        foreach ($symbols as $id => $symbol) {
            $cursor += (int) $symbol['weight'];
            if ($roll <= $cursor) {
                return (string) $id;
            }
        }

        return (string) array_key_first($symbols);
    }

    /** RTP tuning: the raw tables are the source machine's; this scales them. */
    private function scale(): float
    {
        return (float) ($this->config['rtp_scale'] ?? 1.0);
    }

    private function pay(int $bet, float $multiplier): int
    {
        return intdiv($bet * (int) round($multiplier * 100), 100);
    }

    /**
     * Everything the reels need to render: symbol faces, the paytable and the
     * payline geometry.
     *
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    public static function clientConfig(array $config): array
    {
        $symbols = [];
        foreach ($config['symbols'] ?? [] as $id => $symbol) {
            $symbols[] = [
                'id' => (string) $id,
                'name' => (string) ($symbol['name'] ?? $id),
                'emoji' => (string) ($symbol['emoji'] ?? ''),
                'wild' => (bool) ($symbol['wild'] ?? false),
                'scatter' => (bool) ($symbol['scatter'] ?? false),
                'tier' => (string) ($symbol['tier'] ?? 'low'),
            ];
        }

        return [
            'symbols' => $symbols,
            'scaler' => (float) ($config['rtp_scale'] ?? 1.0),
            'paytable' => $config['paytable'] ?? [],
            'paylines' => self::PAYLINES,
            'accent' => $config['accent'] ?? null,
            'background' => $config['background'] ?? null,
        ];
    }
}
