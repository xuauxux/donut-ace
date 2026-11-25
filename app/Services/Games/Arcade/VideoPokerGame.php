<?php

namespace App\Services\Games\Arcade;

/**
 * Jacks or Better video poker, 9/6 paytable: five cards are dealt from one
 * 52-card deck, the player holds what they like, the rest is redrawn.
 *
 * Royal flush 250x … jacks or better 1x is the classic 9/6 table at 99.54% RTP.
 */
final class VideoPokerGame
{
    /** @var array<string, array{label: string, mult: int}> */
    public const PAYTABLE = [
        'royal-flush' => ['label' => 'Royal flush', 'mult' => 250],
        'straight-flush' => ['label' => 'Straight flush', 'mult' => 50],
        'four-of-a-kind' => ['label' => 'Four of a kind', 'mult' => 25],
        'full-house' => ['label' => 'Full house', 'mult' => 9],
        'flush' => ['label' => 'Flush', 'mult' => 6],
        'straight' => ['label' => 'Straight', 'mult' => 4],
        'three-of-a-kind' => ['label' => 'Three of a kind', 'mult' => 3],
        'two-pair' => ['label' => 'Two pair', 'mult' => 2],
        'jacks-or-better' => ['label' => 'Jacks or better', 'mult' => 1],
        'nothing' => ['label' => 'No pair', 'mult' => 0],
    ];

    /** @return array<int, array<string, mixed>> */
    public static function paytable(): array
    {
        $rows = [];

        foreach (self::PAYTABLE as $id => $row) {
            $rows[] = ['id' => $id, 'label' => $row['label'], 'mult' => $row['mult']];
        }

        return $rows;
    }

    /** @return array<int, array{suit: string, rank: string, value: int}> */
    public static function deck(): array
    {
        $suits = ['spades', 'hearts', 'diamonds', 'clubs'];
        $ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        $deck = [];

        foreach ($suits as $suit) {
            foreach ($ranks as $index => $rank) {
                $deck[] = ['suit' => $suit, 'rank' => $rank, 'value' => $index + 1];
            }
        }

        for ($i = count($deck) - 1; $i > 0; $i--) {
            $j = random_int(0, $i);
            [$deck[$i], $deck[$j]] = [$deck[$j], $deck[$i]];
        }

        return $deck;
    }

    /**
     * @param  array<int, array<string, mixed>>  $hand
     */
    public static function evaluate(array $hand): string
    {
        $values = array_map(static fn (array $card) => (int) $card['value'], $hand);
        sort($values);

        $suits = array_unique(array_map(static fn (array $card) => (string) $card['suit'], $hand));
        $flush = count($suits) === 1;

        $unique = count(array_unique($values)) === 5;
        $straight = $unique && (
            $values[4] - $values[0] === 4
            || $values === [1, 10, 11, 12, 13]
        );

        $counts = array_count_values($values);
        $groups = array_values($counts);
        sort($groups);

        if ($flush && $straight && $values === [1, 10, 11, 12, 13]) {
            return 'royal-flush';
        }

        if ($flush && $straight) {
            return 'straight-flush';
        }

        if ($groups === [1, 4]) {
            return 'four-of-a-kind';
        }

        if ($groups === [2, 3]) {
            return 'full-house';
        }

        if ($flush) {
            return 'flush';
        }

        if ($straight) {
            return 'straight';
        }

        if ($groups === [1, 1, 3]) {
            return 'three-of-a-kind';
        }

        if ($groups === [1, 2, 2]) {
            return 'two-pair';
        }

        foreach ($counts as $value => $count) {
            $high = $value === 1 ? 14 : $value;

            if ($count === 2 && $high >= 11) {
                return 'jacks-or-better';
            }
        }

        return 'nothing';
    }

    public static function multiplier(string $outcome): int
    {
        return (int) (self::PAYTABLE[$outcome]['mult'] ?? 0);
    }
}
