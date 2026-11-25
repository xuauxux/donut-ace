<?php

namespace App\Services\Games\Originals;

use InvalidArgumentException;

/**
 * Plinko: the ball takes a fair left/right step at every row, so the bucket it
 * lands in is binomially distributed and each risk table is tuned to ~99% RTP.
 */
final class PlinkoGame implements OriginalGame
{
    /** Most balls a single drop may release. */
    public const MAX_BALLS = 10;

    /** @param  array<string, mixed>  $config  One config('originals.games.plinko'). */
    public function __construct(private readonly array $config) {}

    public function play(array $input, int $bet): array
    {
        $rows = (int) $input['rows'];
        $risk = (string) $input['risk'];

        $multipliers = $this->config['table'][$rows][$risk] ?? throw new InvalidArgumentException('Unknown plinko table.');

        $path = [];
        $bucket = 0;

        for ($row = 0; $row < $rows; $row++) {
            $step = random_int(0, 1);
            $path[] = $step;
            $bucket += $step;
        }

        $multiplier = (float) $multipliers[$bucket];

        return [
            'multiplier' => $multiplier,
            'total_win' => intdiv($bet * (int) round($multiplier * 100), 100),
            'detail' => [
                'rows' => $rows,
                'risk' => $risk,
                'path' => $path,
                'bucket' => $bucket,
                'table' => $multipliers,
            ],
        ];
    }

    /**
     * Several balls in one settled round. Each ball is an independent fair walk
     * at the same per-ball stake, so N balls is exactly N rounds for the price
     * of N — the RTP of the table is unchanged.
     *
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public function playMany(array $input, int $bet, int $count): array
    {
        $rows = (int) $input['rows'];
        $risk = (string) $input['risk'];

        $multipliers = $this->config['table'][$rows][$risk] ?? throw new InvalidArgumentException('Unknown plinko table.');

        $count = max(1, min(self::MAX_BALLS, $count));
        $balls = [];
        $total = 0;

        for ($i = 0; $i < $count; $i++) {
            $path = [];
            $bucket = 0;

            for ($row = 0; $row < $rows; $row++) {
                $step = random_int(0, 1);
                $path[] = $step;
                $bucket += $step;
            }

            $multiplier = (float) $multipliers[$bucket];
            $win = intdiv($bet * (int) round($multiplier * 100), 100);
            $total += $win;

            $balls[] = [
                'path' => $path,
                'bucket' => $bucket,
                'multiplier' => $multiplier,
                'total_win' => $win,
            ];
        }

        $stake = $bet * $count;

        return [
            'multiplier' => $stake > 0 ? round($total / $stake, 4) : 0.0,
            'total_win' => $total,
            'detail' => [
                'rows' => $rows,
                'risk' => $risk,
                'table' => $multipliers,
                'balls' => $balls,
            ],
        ];
    }
}
