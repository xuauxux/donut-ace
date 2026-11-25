<?php

namespace App\Services\Games\Arcade;

use InvalidArgumentException;

/**
 * Punto Banco baccarat on an eight-deck shoe, dealt with the standard
 * third-card rules.
 *
 * Player 1.98×, Banker 1.95×, Tie 8.95×. A tie pushes Player and Banker bets
 * (returned at 1.00×), which is where the house edge sits — total RTP 99.0%.
 */
final class BaccaratGame
{
    /** @param  array<string, mixed>  $config */
    public function __construct(private readonly array $config) {}

    /**
     * @param  array<string, mixed>  $input
     * @return array{multiplier: float, total_win: int, detail: array<string, mixed>}
     */
    public function play(array $input, int $bet): array
    {
        $pick = (string) ($input['pick'] ?? '');
        $markets = $this->config['markets'] ?? [];

        if (! isset($markets[$pick])) {
            throw new InvalidArgumentException('Pick player, banker or tie.');
        }

        $shoe = $this->shoe();
        $player = [$shoe[0], $shoe[2]];
        $banker = [$shoe[1], $shoe[3]];
        $cursor = 4;

        $playerTotal = $this->total($player);
        $bankerTotal = $this->total($banker);
        $natural = $playerTotal >= 8 || $bankerTotal >= 8;

        if (! $natural) {
            $playerThird = null;

            if ($playerTotal <= 5) {
                $card = $shoe[$cursor++];
                $player[] = $card;
                $playerThird = $this->points($card);
                $playerTotal = $this->total($player);
            }

            if ($playerThird === null) {
                if ($bankerTotal <= 5) {
                    $banker[] = $shoe[$cursor++];
                }
            } elseif ($this->bankerDraws($bankerTotal, $playerThird)) {
                $banker[] = $shoe[$cursor++];
            }

            $bankerTotal = $this->total($banker);
        }

        $winner = $playerTotal > $bankerTotal ? 'player' : ($bankerTotal > $playerTotal ? 'banker' : 'tie');

        if ($winner === 'tie') {
            $multiplier = $pick === 'tie' ? 8.95 : 1.0;
        } elseif ($winner === $pick) {
            $multiplier = $pick === 'player' ? 1.98 : 1.95;
        } else {
            $multiplier = 0.0;
        }

        return [
            'multiplier' => $multiplier,
            'total_win' => $this->pay($bet, $multiplier),
            'detail' => [
                'pick' => $pick,
                'winner' => $winner,
                'player' => $player,
                'banker' => $banker,
                'player_total' => $playerTotal,
                'banker_total' => $bankerTotal,
                'natural' => $natural,
                'won' => $multiplier > 1.0,
                'push' => $multiplier === 1.0,
            ],
        ];
    }

    /** Standard banker third-card table. */
    private function bankerDraws(int $bankerTotal, int $playerThird): bool
    {
        return match (true) {
            $bankerTotal <= 2 => true,
            $bankerTotal === 3 => $playerThird !== 8,
            $bankerTotal === 4 => $playerThird >= 2 && $playerThird <= 7,
            $bankerTotal === 5 => $playerThird >= 4 && $playerThird <= 7,
            $bankerTotal === 6 => $playerThird === 6 || $playerThird === 7,
            default => false,
        };
    }

    /** @param  array<int, array<string, mixed>>  $cards */
    private function total(array $cards): int
    {
        $sum = 0;
        foreach ($cards as $card) {
            $sum += $this->points($card);
        }

        return $sum % 10;
    }

    /** @param  array<string, mixed>  $card */
    private function points(array $card): int
    {
        $value = (int) $card['value'];

        return $value >= 10 ? 0 : $value;
    }

    /**
     * Eight decks, shuffled with the CSPRNG.
     *
     * @return array<int, array{suit: string, rank: string, value: int}>
     */
    private function shoe(): array
    {
        $suits = ['spades', 'hearts', 'diamonds', 'clubs'];
        $ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        $deck = [];

        for ($d = 0; $d < 8; $d++) {
            foreach ($suits as $suit) {
                foreach ($ranks as $index => $rank) {
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

    private function pay(int $bet, float $multiplier): int
    {
        return intdiv($bet * (int) round($multiplier * 100), 100);
    }
}
