<?php

namespace App\Services\Games\Arcade;

use InvalidArgumentException;

/**
 * Roulette on a European wheel (0-36). A round carries a whole table of chips,
 * not a single market:
 *
 *   straight up  · 37 numbers at 36.63x          → 36.63 / 37 = 99.0%
 *   dozens/columns · 12 pockets at 2.97x          → (12 × 2.97 + 1) / 37
 *   even money   · 18 pockets at 1.98x            → (18 × 1.98 + 1) / 37
 *
 * Zero pushes every bet except the green one, which is what the "+1" above is:
 * the stake comes back instead of losing.
 */
final class RouletteGame
{
    /** Bets that are pushed (not lost) when zero comes up. */
    private const OUTSIDE = [
        'red', 'black', 'odd', 'even', 'low', 'high',
        'd1', 'd2', 'd3', 'c1', 'c2', 'c3',
    ];

    /** @param  array<string, mixed>  $config */
    public function __construct(private readonly array $config) {}

    /**
     * Markets plus the 36 straight-up numbers, keyed by cell id.
     *
     * @param  array<string, mixed>  $config
     * @return array<string, array<string, mixed>>
     */
    public static function markets(array $config): array
    {
        $markets = $config['markets'] ?? [];
        $straight = (float) ($config['straight_mult'] ?? 36.63);

        for ($n = 1; $n <= 36; $n++) {
            $markets['n'.$n] = [
                'label' => (string) $n,
                'emoji' => '',
                'mult' => $straight,
            ];
        }

        return $markets;
    }

    /** Does this cell cover the pocket? */
    public function wins(string $key, int $number): bool
    {
        $zeros = array_map('intval', (array) ($this->config['zeros'] ?? [0]));

        if ($key === 'green') {
            return $number === ($zeros[0] ?? 0);
        }

        // American wheels carry a second green pocket, 00.
        if ($key === 'double') {
            return isset($zeros[1]) && $number === $zeros[1];
        }

        if (str_starts_with($key, 'n')) {
            return (int) substr($key, 1) === $number;
        }

        if (in_array($number, $zeros, true)) {
            return false;
        }

        $red = in_array($number, array_map('intval', (array) ($this->config['red'] ?? [])), true);

        return match ($key) {
            'red' => $red,
            'black' => ! $red,
            'odd' => $number % 2 === 1,
            'even' => $number % 2 === 0,
            'low' => $number <= 18,
            'high' => $number > 18,
            'd1' => $number <= 12,
            'd2' => $number > 12 && $number <= 24,
            'd3' => $number > 24,
            'c1' => $number % 3 === 1,
            'c2' => $number % 3 === 2,
            'c3' => $number % 3 === 0,
            default => false,
        };
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array{multiplier: float, total_win: int, detail: array<string, mixed>}
     */
    public function play(array $input, int $bet): array
    {
        $markets = self::markets($this->config);
        $bets = $input['bets'] ?? null;

        if (! is_array($bets) || $bets === []) {
            throw new InvalidArgumentException('Place at least one chip.');
        }

        $staked = 0;

        foreach ($bets as $key => $stake) {
            if (! isset($markets[(string) $key])) {
                throw new InvalidArgumentException('That bet is not on the table.');
            }

            $stake = (int) $stake;

            if ($stake < 1) {
                throw new InvalidArgumentException('Chips must be at least one coin.');
            }

            $bets[$key] = $stake;
            $staked += $stake;
        }

        if ($staked !== $bet) {
            throw new InvalidArgumentException('The chips do not add up to the bet.');
        }

        $pockets = max(2, (int) ($this->config['pockets'] ?? 37));
        // Pocket 0 is the green zero; an American wheel adds 00 as the last one.
        $zeros = array_map('intval', (array) ($this->config['zeros'] ?? [0]));
        $number = random_int(0, $pockets - 1);
        $isZero = in_array($number, $zeros, true);
        $red = array_map('intval', (array) ($this->config['red'] ?? []));
        $colour = $isZero ? 'green' : (in_array($number, $red, true) ? 'red' : 'black');

        $totalWin = 0;
        $wonKeys = [];
        $pushKeys = [];

        foreach ($bets as $key => $stake) {
            // Zero is the house pocket: outside chips are pushed, straight-up
            // numbers lose (that is what keeps the 36.63x at 99%).
            if ($isZero && $key !== 'green' && $key !== 'double') {
                if (in_array($key, self::OUTSIDE, true)) {
                    $totalWin += $stake;
                    $pushKeys[] = (string) $key;
                }

                continue;
            }

            if ($this->wins((string) $key, $number)) {
                $multiplier = (float) ($markets[(string) $key]['mult'] ?? 0);
                $totalWin += intdiv($stake * (int) round($multiplier * 100), 100);
                $wonKeys[] = (string) $key;
            }
        }

        return [
            'multiplier' => $bet > 0 ? round($totalWin / $bet, 2) : 0.0,
            'total_win' => $totalWin,
            'detail' => [
                'number' => $number,
                'colour' => $colour,
                'bets' => $bets,
                'won_bets' => $wonKeys,
                'push_bets' => $pushKeys,
                'won' => $wonKeys !== [],
                'push' => $pushKeys !== [] && $wonKeys === [],
            ],
        ];
    }
}
