<?php

namespace App\Services\Games\Arcade;

/**
 * HiLo card streak: deal a card, call the next one higher or lower, and cash
 * out whenever you like. Every step pays 0.99 / P(win) so the streak is 99%
 * RTP by construction; an exact rank pushes (no gain, no loss).
 *
 * A card is ['suit' => spades|hearts|diamonds|clubs, 'rank' => A..K, 'value' => 1..13].
 */
final class HiLoGame
{
    private const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];

    private const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

    /**
     * A full, shuffled single deck — used by the card-duel tables.
     *
     * @return array<int, array{suit: string, rank: string, value: int}>
     */
    public static function deck(): array
    {
        $deck = [];

        foreach (self::SUITS as $suit) {
            foreach (self::RANKS as $index => $rank) {
                $deck[] = ['suit' => $suit, 'rank' => $rank, 'value' => $index + 1];
            }
        }

        for ($i = count($deck) - 1; $i > 0; $i--) {
            $j = random_int(0, $i);
            [$deck[$i], $deck[$j]] = [$deck[$j], $deck[$i]];
        }

        return $deck;
    }

    /** @return array{suit: string, rank: string, value: int} */
    public static function card(): array
    {
        $index = random_int(0, 12);
        $suit = self::SUITS[random_int(0, 3)];

        return ['suit' => $suit, 'rank' => self::RANKS[$index], 'value' => $index + 1];
    }

    /**
     * Draw the next card from a fresh deck with the current exact card removed,
     * so a push is always a real card of equal rank rather than the same card.
     *
     * @param  array<string, mixed>  $current
     * @return array{suit: string, rank: string, value: int}
     */
    public static function next(array $current): array
    {
        do {
            $card = self::card();
        } while ($card['suit'] === $current['suit'] && $card['value'] === (int) $current['value']);

        return $card;
    }

    /**
     * Call odds for a card: remaining 51 cards, 3 of equal rank, (v−1)×4 lower
     * and (13−v)×4 higher. Ace plays "higher or same", King "lower or same".
     *
     * @return array{higher_mult: float, lower_mult: float, higher_chance: int, lower_chance: int}
     */
    public static function odds(int $value): array
    {
        $lower = ($value - 1) * 4;
        $higher = (13 - $value) * 4;
        $equal = 3;

        $higherMult = match (true) {
            $value === 1 => (0.99 * 51) / ($higher + $equal),
            $value < 13 => (0.99 * (51 - $equal)) / $higher,
            default => (0.99 * 51) / $equal,
        };

        $lowerMult = match (true) {
            $value === 13 => (0.99 * 51) / ($lower + $equal),
            $value > 1 => (0.99 * (51 - $equal)) / $lower,
            default => (0.99 * 51) / $equal,
        };

        $higherChance = match (true) {
            $value === 1 => (int) round((($higher + $equal) / 51) * 100),
            $value < 13 => (int) round(($higher / (51 - $equal)) * 100),
            default => (int) round(($equal / 51) * 100),
        };

        $lowerChance = match (true) {
            $value === 13 => (int) round((($lower + $equal) / 51) * 100),
            $value > 1 => (int) round(($lower / (51 - $equal)) * 100),
            default => (int) round(($equal / 51) * 100),
        };

        return [
            'higher_mult' => round($higherMult, 2),
            'lower_mult' => round($lowerMult, 2),
            'higher_chance' => $higherChance,
            'lower_chance' => $lowerChance,
        ];
    }

    /**
     * Settle one guess.
     *
     * @param  array<string, mixed>  $current
     * @param  array<string, mixed>  $next
     * @return array{status: string, step_multiplier: float}
     */
    public static function resolve(array $current, array $next, string $guess): array
    {
        $previous = (int) $current['value'];
        $drawn = (int) $next['value'];
        $odds = self::odds($previous);

        if ($guess === 'higher') {
            $multiplier = $odds['higher_mult'];

            if ($previous === 1) {
                return $drawn >= $previous
                    ? ['status' => 'win', 'step_multiplier' => $multiplier]
                    : ['status' => 'loss', 'step_multiplier' => 0.0];
            }

            if ($previous === 13) {
                return $drawn === $previous
                    ? ['status' => 'win', 'step_multiplier' => $multiplier]
                    : ['status' => 'loss', 'step_multiplier' => 0.0];
            }

            return match (true) {
                $drawn > $previous => ['status' => 'win', 'step_multiplier' => $multiplier],
                $drawn === $previous => ['status' => 'push', 'step_multiplier' => 1.0],
                default => ['status' => 'loss', 'step_multiplier' => 0.0],
            };
        }

        $multiplier = $odds['lower_mult'];

        if ($previous === 13) {
            return $drawn <= $previous
                ? ['status' => 'win', 'step_multiplier' => $multiplier]
                : ['status' => 'loss', 'step_multiplier' => 0.0];
        }

        if ($previous === 1) {
            return $drawn === $previous
                ? ['status' => 'win', 'step_multiplier' => $multiplier]
                : ['status' => 'loss', 'step_multiplier' => 0.0];
        }

        return match (true) {
            $drawn < $previous => ['status' => 'win', 'step_multiplier' => $multiplier],
            $drawn === $previous => ['status' => 'push', 'step_multiplier' => 1.0],
            default => ['status' => 'loss', 'step_multiplier' => 0.0],
        };
    }
}
