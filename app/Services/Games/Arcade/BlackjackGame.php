<?php

namespace App\Services\Games\Arcade;

/**
 * Blackjack on a six-deck shoe. Hit, stand or double; the dealer stands on all
 * seventeens (including soft 17). A natural pays 3:2.
 *
 * Basic strategy lands around 99.5% RTP; the config states that number.
 */
final class BlackjackGame
{
    private const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];

    private const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

    /**
     * A shuffled shoe. Six decks keep the count shallow and the rules honest.
     *
     * @return array<int, array{suit: string, rank: string, value: int}>
     */
    public static function shoe(int $decks = 6): array
    {
        $deck = [];

        for ($d = 0; $d < $decks; $d++) {
            foreach (self::SUITS as $suit) {
                foreach (self::RANKS as $index => $rank) {
                    $deck[] = ['suit' => $suit, 'rank' => $rank, 'value' => $index + 1];
                }
            }
        }

        for ($i = count($deck) - 1; $i > 0; $i--) {
            $j = random_int(0, $i);
            [$deck[$i], $deck[$j]] = [$deck[$j], $deck[$i]];
        }

        return $deck;
    }

    /**
     * @param  array<int, array<string, mixed>>  $deck
     * @return array{suit: string, rank: string, value: int}
     */
    public static function draw(array &$deck): array
    {
        $card = array_shift($deck);

        return $card ?? ['suit' => 'spades', 'rank' => 'A', 'value' => 1];
    }

    /**
     * @param  array<int, array<string, mixed>>  $cards
     * @return array{total: int, soft: bool, bust: bool}
     */
    public static function value(array $cards): array
    {
        $total = 0;
        $aces = 0;

        foreach ($cards as $card) {
            $value = (int) ($card['value'] ?? 0);

            if ($value === 1) {
                $aces++;
                $total += 11;
            } else {
                $total += min(10, $value);
            }
        }

        while ($total > 21 && $aces > 0) {
            $total -= 10;
            $aces--;
        }

        return ['total' => $total, 'soft' => $aces > 0, 'bust' => $total > 21];
    }

    /** @param  array<int, array<string, mixed>>  $cards */
    public static function isBlackjack(array $cards): bool
    {
        return count($cards) === 2 && self::value($cards)['total'] === 21;
    }

    /**
     * The dealer takes cards until 17 (or better). Returns the final hand.
     *
     * @param  array<int, array<string, mixed>>  $dealer
     * @param  array<int, array<string, mixed>>  $deck
     * @return array<int, array<string, mixed>>
     */
    public static function dealerTurn(array $dealer, array &$deck, bool $hitSoft17 = false): array
    {
        while (true) {
            $value = self::value($dealer);

            if ($value['total'] > 21) {
                break;
            }

            if ($value['total'] > 17) {
                break;
            }

            if ($value['total'] === 17 && (! $value['soft'] || ! $hitSoft17)) {
                break;
            }

            $dealer[] = self::draw($deck);
        }

        return $dealer;
    }

    /**
     * @param  array<int, array<string, mixed>>  $player
     * @param  array<int, array<string, mixed>>  $dealer
     * @return array{multiplier: float, outcome: string}
     */
    public static function settle(array $player, array $dealer, float $blackjackPays = 1.5): array
    {
        $playerTotal = self::value($player)['total'];
        $dealerTotal = self::value($dealer)['total'];
        $playerBlackjack = self::isBlackjack($player);
        $dealerBlackjack = self::isBlackjack($dealer);

        if ($playerTotal > 21) {
            return ['multiplier' => 0.0, 'outcome' => 'bust'];
        }

        if ($playerBlackjack && $dealerBlackjack) {
            return ['multiplier' => 1.0, 'outcome' => 'push'];
        }

        if ($playerBlackjack) {
            return ['multiplier' => 1 + $blackjackPays, 'outcome' => 'blackjack'];
        }

        if ($dealerBlackjack) {
            return ['multiplier' => 0.0, 'outcome' => 'dealer-blackjack'];
        }

        if ($dealerTotal > 21) {
            return ['multiplier' => 2.0, 'outcome' => 'dealer-bust'];
        }

        return match (true) {
            $playerTotal > $dealerTotal => ['multiplier' => 2.0, 'outcome' => 'win'],
            $playerTotal === $dealerTotal => ['multiplier' => 1.0, 'outcome' => 'push'],
            default => ['multiplier' => 0.0, 'outcome' => 'loss'],
        };
    }
}
