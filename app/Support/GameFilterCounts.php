<?php

namespace App\Support;

use App\Services\Games\Arcade\ArcadeCatalog;
use App\Services\Games\GameLibrary;
use App\Services\Games\Originals;
use App\Services\SpinKit\SpinKitClient;
use Illuminate\Support\Facades\Cache;

/**
 * How many games each sidebar category would show.
 *
 * The sidebar only renders categories that have games behind them, so a
 * link can never land on an empty lobby page.
 */
class GameFilterCounts
{
    public function __construct(
        private readonly SpinKitClient $spinKit,
        private readonly GameLibrary $library,
        private readonly Originals $originals,
        private readonly ArcadeCatalog $arcade,
    ) {}

    /** @return array<string, int> */
    public function all(): array
    {
        return Cache::remember('lobby:filter-counts', 120, function (): array {
            $cards = GamePresenter::cards(
                $this->spinKit->games() ?: [
                    ...$this->originals->cards(),
                    ...$this->arcade->cards(),
                    ...$this->library->catalog(),
                ],
            );

            $total = count($cards);
            $mechanics = [];

            foreach ($cards as $card) {
                $mechanic = $card['mechanic'] ?? null;

                if (is_string($mechanic) && $mechanic !== '') {
                    $mechanics[$mechanic] = ($mechanics[$mechanic] ?? 0) + 1;
                }
            }

            $count = fn (string ...$keys): int => array_sum(
                array_map(fn (string $key): int => $mechanics[$key] ?? 0, $keys),
            );

            return [
                'all' => $total,
                'hot' => min(18, $total),
                'new' => min(18, $total),
                'top' => min(24, $total),
                'originals' => $count('originals'),
                'arcade' => $count('arcade'),
                'bonus-buy' => count(array_filter($cards, fn (array $card): bool => (bool) ($card['bonus_buy'] ?? false))),
                'megaways' => $count('megaways'),
                'clusters' => $count('clusters'),
                'tumble' => $count('tumble'),
                'hold-win' => $count('holdwin'),
                'giants' => $count('giants'),
                'lines' => $count('lines', 'matchlines'),
                'ways' => $count('ways'),
            ];
        });
    }
}
