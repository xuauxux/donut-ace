<?php

namespace App\Http\Controllers\Casino;

use App\Http\Controllers\Controller;
use App\Models\ArcadeRound;
use App\Models\User;
use App\Models\WalletTransaction;
use App\Services\Games\Arcade\ArcadeCatalog;
use App\Services\Games\Arcade\BlackjackGame;
use App\Services\Games\Arcade\ConnectFourGame;
use App\Services\Games\Arcade\HiLoGame;
use App\Services\Games\Arcade\LadderGame;
use App\Services\Games\Arcade\VideoPokerGame;
use App\Services\Wallet\WalletService;
use App\Services\Wallet\WagerService;
use App\Support\GamePresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use InvalidArgumentException;

class ArcadeController extends Controller
{
    public function __construct(
        private readonly ArcadeCatalog $catalog,
        private readonly WagerService $wager,
        private readonly WalletService $wallet,
    ) {}

    public function show(Request $request, string $game): Response
    {
        abort_unless($this->catalog->has($game), 404);

        return Inertia::render('casino/arcade', [
            'game' => GamePresenter::card($this->catalog->find($game)),
            'bets' => config('arcade.bets'),
            'balance' => (int) $request->user()->balance,
            'config' => $this->catalog->clientConfig($game),
            'related' => GamePresenter::cards($this->catalog->related($game)),
        ]);
    }

    /** One-shot games: draw, case and crash. */
    public function play(Request $request, string $game): JsonResponse
    {
        $definition = $this->catalog->definition($game);
        abort_if($definition === null || ($definition['family'] ?? null) === 'ladder', 404);

        // A roulette round is the sum of every chip on the table, so its floor
        // is the smallest stake rather than the preset bet ladder.
        $betRule = ($definition['family'] ?? null) === 'roulette'
            ? ['required', 'integer', 'min:'.(int) min(config('arcade.bets'))]
            : self::betRules(config('arcade.bets'));

        $data = $request->validate([
            'bet' => $betRule,
            ...$this->catalog->rules($game),
        ]);

        $bet = (int) $data['bet'];
        $user = $request->user();

        if ($user->balance < $bet) {
            return response()->json(['message' => 'Not enough coins — top up to keep playing.'], 422);
        }

        $lock = Cache::lock('arcade:'.$user->id, 10);

        if (! $lock->get()) {
            return response()->json(['message' => 'A round is already in progress.'], 429);
        }

        try {
            $engine = $this->catalog->engine($game);
            $outcome = $this->wager->play($user, $game, $bet, fn () => $engine->play($data, $bet));
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } finally {
            $lock->release();
        }

        return response()->json([...$outcome, 'game' => $game, 'bet' => $bet]);
    }

    /** Open a ladder round: the bet is taken now, cash-out pays later. */
    public function start(Request $request, string $game): JsonResponse
    {
        $definition = $this->catalog->definition($game);
        abort_if($definition === null || ($definition['family'] ?? null) !== 'ladder', 404);

        $data = $request->validate([
            'bet' => self::betRules(config('arcade.bets')),
            ...$this->catalog->rules($game),
        ]);

        $bet = (int) $data['bet'];
        $user = $request->user();

        if ($user->balance < $bet) {
            return response()->json(['message' => 'Not enough coins — top up to keep playing.'], 422);
        }

        $ladder = $this->catalog->ladder($game);
        $hazardsCount = $ladder->shape() === 'grid' ? (int) ($data['hazards'] ?? $definition['default_hazards'] ?? 1) : 0;
        $road = $ladder->shape() === 'road';
        $tower = $ladder->shape() === 'rows';
        $difficulty = ($road || $tower)
            ? (string) ($data['difficulty'] ?? $definition['default_difficulty'] ?? 'medium')
            : null;
        $chance = $road ? $ladder->chanceFor((string) $difficulty) : null;

        // A tower difficulty decides how many tiles each floor shows; the round
        // stores that width so reveal/cash-out keep using the same board.
        $ladder = $ladder->withRowOptions($tower ? (int) ($definition['difficulties'][$difficulty]['options'] ?? 0) : null);

        // One open round per player: a double click must never be charged twice.
        $lock = Cache::lock('arcade:'.$user->id, 10);

        if (! $lock->get()) {
            return response()->json(['message' => 'A round is already in progress.'], 429);
        }

        try {
            $round = DB::transaction(function () use ($user, $game, $bet, $ladder, $hazardsCount, $difficulty, $chance) {
            $round = ArcadeRound::create([
                'id' => (string) Str::ulid(),
                'user_id' => $user->id,
                'game' => $game,
                'status' => ArcadeRound::OPEN,
                'bet' => $bet,
                'state' => [
                    'shape' => $ladder->shape(),
                    'hazards' => $ladder->hazards($hazardsCount),
                    'hazards_count' => $hazardsCount,
                    'revealed' => [],
                    'step' => 0,
                    'cells' => $ladder->shape() === 'grid' ? $ladder->boardSize() : null,
                    'row_options' => $ladder->shape() === 'rows' ? $ladder->rowOptions() : null,
                    'difficulty' => $difficulty,
                    'chance' => $chance,
                ],
            ]);

            $this->wallet->debit($user, $bet, WalletTransaction::GAME_IN, 'bet-'.$round->id, $game);

            return $round;
        });
        } finally {
            $lock->release();
        }

        return response()->json($this->present($round->fresh(), $ladder));
    }

    /** Reveal one cell / row of an open round. */
    public function reveal(Request $request, string $game): JsonResponse
    {
        $data = $request->validate([
            'round_id' => ['required', 'string'],
            'pick' => ['required', 'integer', 'min:0'],
        ]);

        $round = $this->openRound($request->user(), $game, (string) $data['round_id']);
        $state = $round->state;
        $ladder = $this->catalog->ladder($game)
            ->withRowOptions(isset($state['row_options']) ? (int) $state['row_options'] : null);
        $pick = (int) $data['pick'];
        $chance = isset($state['chance']) ? (float) $state['chance'] : null;

        if ($state['shape'] === 'road') {
            // Road Hopper has one lane per hop, so the server rolls the traffic.
            $safe = random_int(0, 999999) / 1000000 < ($chance ?? $ladder->defaultChance());

            if (! $safe) {
                $state['hit'] = (int) $state['step'] + 1;
                $round->forceFill([
                    'status' => ArcadeRound::LOST,
                    'payout' => 0,
                    'state' => $state,
                ])->save();

                return response()->json($this->present($round->fresh(), $ladder));
            }

            $pick = (int) $state['step'];
        } else {
            $limit = $state['shape'] === 'rows' ? (int) $state['row_options'] : (int) $state['cells'];

            if ($pick >= $limit) {
                return response()->json(['message' => 'That pick is off the board.'], 422);
            }
            if ($state['shape'] === 'grid' && in_array($pick, $state['revealed'], true)) {
                return response()->json(['message' => 'That cell is already open.'], 422);
            }

            if ($ladder->isHazard($pick, $state)) {
                $state['hit'] = $pick;
                $round->forceFill([
                    'status' => ArcadeRound::LOST,
                    'payout' => 0,
                    'state' => $state,
                ])->save();

                return response()->json($this->present($round->fresh(), $ladder));
            }
        }

        $state['revealed'][] = $pick;
        $state['step'] = (int) $state['step'] + 1;

        $multiplier = $ladder->multiplier((int) $state['step'], (int) $state['hazards_count'], $chance);

        // Board cleared: pay it out automatically.
        if ((int) $state['step'] >= $ladder->maxSteps((int) $state['hazards_count'])) {
            $payout = intdiv((int) $round->bet * (int) round($multiplier * 100), 100);

            DB::transaction(function () use ($round, $state, $payout) {
                $this->wallet->credit($round->user, $payout, WalletTransaction::GAME_OUT, 'win-'.$round->id, $round->game);
                $round->forceFill(['status' => ArcadeRound::WON, 'payout' => $payout, 'state' => $state])->save();
            });

            return response()->json($this->present($round->fresh(), $ladder));
        }

        $round->forceFill(['state' => $state])->save();

        return response()->json($this->present($round->fresh(), $ladder));
    }

    /** Take the current multiplier. */
    public function cashout(Request $request, string $game): JsonResponse
    {
        $data = $request->validate(['round_id' => ['required', 'string']]);

        $round = $this->openRound($request->user(), $game, (string) $data['round_id']);
        $state = $round->state;
        $ladder = $this->catalog->ladder($game)
            ->withRowOptions(isset($state['row_options']) ? (int) $state['row_options'] : null);
        $step = (int) $state['step'];

        if ($step < 1) {
            return response()->json(['message' => 'Reveal at least one cell first.'], 422);
        }

        $chance = isset($state['chance']) ? (float) $state['chance'] : null;
        $multiplier = $ladder->multiplier($step, (int) $state['hazards_count'], $chance);
        $payout = intdiv((int) $round->bet * (int) round($multiplier * 100), 100);

        DB::transaction(function () use ($round, $payout) {
            $this->wallet->credit($round->user, $payout, WalletTransaction::GAME_OUT, 'win-'.$round->id, $round->game);
            $round->forceFill(['status' => ArcadeRound::WON, 'payout' => $payout])->save();
        });

        return response()->json($this->present($round->fresh(), $ladder));
    }

    /** Deal the first card of a HiLo streak and take the bet. */
    public function hiloStart(Request $request): JsonResponse
    {
        $data = $request->validate(['bet' => self::betRules(config('arcade.bets'))]);
        $bet = (int) $data['bet'];
        $user = $request->user();

        if ($user->balance < $bet) {
            return response()->json(['message' => 'Not enough coins — top up to keep playing.'], 422);
        }

        $lock = Cache::lock('arcade:'.$user->id, 10);

        if (! $lock->get()) {
            return response()->json(['message' => 'A round is already in progress.'], 429);
        }

        try {
            $card = HiLoGame::card();

            $round = DB::transaction(function () use ($user, $bet, $card) {
                $round = ArcadeRound::create([
                    'id' => (string) Str::ulid(),
                    'user_id' => $user->id,
                    'game' => 'hilo',
                    'status' => ArcadeRound::OPEN,
                    'bet' => $bet,
                    'state' => [
                        'card' => $card,
                        'history' => [$card],
                        'streak' => 0,
                        'multiplier' => 1.0,
                    ],
                ]);

                $this->wallet->debit($user, $bet, WalletTransaction::GAME_IN, 'bet-'.$round->id, 'hilo');

                return $round;
            });
        } finally {
            $lock->release();
        }

        return response()->json($this->presentHiLo($round->fresh()));
    }

    /** Call the next card higher or lower. */
    public function hiloGuess(Request $request): JsonResponse
    {
        $data = $request->validate([
            'round_id' => ['required', 'string'],
            'guess' => ['required', 'string', 'in:higher,lower'],
        ]);

        $round = $this->openRound($request->user(), 'hilo', (string) $data['round_id']);
        $state = $round->state;
        $next = HiLoGame::next($state['card']);
        $result = HiLoGame::resolve($state['card'], $next, (string) $data['guess']);

        $state['card'] = $next;
        $state['history'][] = $next;

        if ($result['status'] === 'win') {
            $state['streak'] = (int) $state['streak'] + 1;
            $state['multiplier'] = round((float) $state['multiplier'] * (float) $result['step_multiplier'], 2);
        }

        if ($result['status'] === 'loss') {
            $round->forceFill(['status' => ArcadeRound::LOST, 'payout' => 0, 'state' => $state])->save();
        } else {
            $round->forceFill(['state' => $state])->save();
        }

        return response()->json($this->presentHiLo($round->fresh(), (string) $result['status'], $next));
    }

    /** Take the streak multiplier. */
    public function hiloCashout(Request $request): JsonResponse
    {
        $data = $request->validate(['round_id' => ['required', 'string']]);

        $round = $this->openRound($request->user(), 'hilo', (string) $data['round_id']);
        $state = $round->state;

        if ((int) $state['streak'] < 1) {
            return response()->json(['message' => 'Play at least one card before cashing out.'], 422);
        }

        $payout = intdiv((int) $round->bet * (int) round((float) $state['multiplier'] * 100), 100);

        DB::transaction(function () use ($round, $payout) {
            $this->wallet->credit($round->user, $payout, WalletTransaction::GAME_OUT, 'win-'.$round->id, 'hilo');
            $round->forceFill(['status' => ArcadeRound::WON, 'payout' => $payout])->save();
        });

        return response()->json($this->presentHiLo($round->fresh(), 'cashed'));
    }

    /** @return array<string, mixed> */
    private function presentHiLo(ArcadeRound $round, ?string $lastStatus = null, ?array $nextCard = null): array
    {
        $state = $round->state;
        $multiplier = (float) $state['multiplier'];

        return [
            'round_id' => $round->id,
            'game' => 'hilo',
            'status' => $round->status,
            'open' => $round->status === ArcadeRound::OPEN,
            'bet' => (int) $round->bet,
            'payout' => (int) $round->payout,
            'balance' => (int) User::whereKey($round->user_id)->value('balance'),
            'card' => $state['card'],
            'next_card' => $nextCard,
            'history' => $state['history'],
            'streak' => (int) $state['streak'],
            'multiplier' => $multiplier,
            'potential_win' => intdiv((int) $round->bet * (int) round($multiplier * 100), 100),
            'odds' => HiLoGame::odds((int) $state['card']['value']),
            'last_status' => $lastStatus,
        ];
    }

    // ---------------------------------------------------------------- connect 4

    /** Start a Connect 4 game: the player drops first on an empty board. */
    public function connectFourStart(Request $request): JsonResponse
    {
        $data = $request->validate(['bet' => self::betRules(config('arcade.bets'))]);
        $bet = (int) $data['bet'];
        $user = $request->user();

        if ($user->balance < $bet) {
            return response()->json(['message' => 'Not enough coins — top up to keep playing.'], 422);
        }

        $lock = Cache::lock('arcade:'.$user->id, 10);

        if (! $lock->get()) {
            return response()->json(['message' => 'A round is already in progress.'], 429);
        }

        try {
            $round = DB::transaction(function () use ($user, $bet) {
                $round = ArcadeRound::create([
                    'id' => (string) Str::ulid(),
                    'user_id' => $user->id,
                    'game' => 'connect-4',
                    'status' => ArcadeRound::OPEN,
                    'bet' => $bet,
                    'state' => [
                        'board' => ConnectFourGame::empty(),
                        'stake' => $bet,
                        'outcome' => null,
                        'last_player' => null,
                        'last_house' => null,
                    ],
                ]);

                $this->wallet->debit($user, $bet, WalletTransaction::GAME_IN, 'bet-'.$round->id, 'connect-4');

                return $round;
            });
        } finally {
            $lock->release();
        }

        return response()->json($this->presentConnectFour($round->fresh()));
    }

    /** Drop a disc; the house answers immediately until the board settles. */
    public function connectFourDrop(Request $request): JsonResponse
    {
        $data = $request->validate([
            'round_id' => ['required', 'string'],
            'column' => ['required', 'integer', 'between:0,6'],
        ]);

        $round = $this->openRound($request->user(), 'connect-4', (string) $data['round_id']);
        $state = $round->state;
        $board = $state['board'];
        $column = (int) $data['column'];

        $move = ConnectFourGame::drop($board, $column, ConnectFourGame::PLAYER);

        if ($move === null) {
            return response()->json(['message' => 'That column is full.'], 422);
        }

        $board = $move['board'];
        $state['last_player'] = ['row' => $move['row'], 'col' => $column];

        if (ConnectFourGame::winner($board) === ConnectFourGame::PLAYER) {
            return response()->json($this->finishConnectFour($round, $state, $board, 'win'));
        }

        if (ConnectFourGame::full($board)) {
            return response()->json($this->finishConnectFour($round, $state, $board, 'draw'));
        }

        $replyColumn = ConnectFourGame::houseMove($board);
        $reply = $replyColumn === null ? null : ConnectFourGame::drop($board, $replyColumn, ConnectFourGame::HOUSE);

        if ($reply !== null) {
            $board = $reply['board'];
            $state['last_house'] = ['row' => $reply['row'], 'col' => $replyColumn];
        }

        if (ConnectFourGame::winner($board) === ConnectFourGame::HOUSE) {
            return response()->json($this->finishConnectFour($round, $state, $board, 'loss'));
        }

        if (ConnectFourGame::full($board)) {
            return response()->json($this->finishConnectFour($round, $state, $board, 'draw'));
        }

        $state['board'] = $board;
        $round->forceFill(['state' => $state])->save();

        return response()->json($this->presentConnectFour($round->fresh()));
    }

    /**
     * Settle a finished board: a win pays 1.98x, a draw returns the stake.
     *
     * @param  array<string, mixed>  $state
     * @param  array<int, int>  $board
     * @return array<string, mixed>
     */
    private function finishConnectFour(ArcadeRound $round, array $state, array $board, string $outcome): array
    {
        $stake = (int) ($state['stake'] ?? $round->bet);
        $payout = match ($outcome) {
            'win' => intdiv($stake * 198, 100),
            'draw' => $stake,
            default => 0,
        };

        DB::transaction(function () use ($round, $state, $board, $outcome, $payout) {
            if ($payout > 0) {
                $this->wallet->credit($round->user, $payout, WalletTransaction::GAME_OUT, 'win-'.$round->id, $round->game);
            }

            $round->forceFill([
                'status' => $outcome === 'loss' ? ArcadeRound::LOST : ArcadeRound::WON,
                'payout' => $payout,
                'state' => array_merge($state, [
                    'board' => $board,
                    'outcome' => $outcome,
                ]),
            ])->save();
        });

        return $this->presentConnectFour($round->fresh());
    }

    /** @return array<string, mixed> */
    private function presentConnectFour(ArcadeRound $round): array
    {
        $state = $round->state;

        return [
            'round_id' => $round->id,
            'game' => 'connect-4',
            'status' => $round->status,
            'open' => $round->status === ArcadeRound::OPEN,
            'bet' => (int) $round->bet,
            'stake' => (int) ($state['stake'] ?? $round->bet),
            'payout' => (int) $round->payout,
            'balance' => (int) User::whereKey($round->user_id)->value('balance'),
            'board' => $state['board'],
            'rows' => ConnectFourGame::ROWS,
            'columns' => ConnectFourGame::COLS,
            'outcome' => $state['outcome'] ?? null,
            'last_player' => $state['last_player'] ?? null,
            'last_house' => $state['last_house'] ?? null,
        ];
    }

    // ---------------------------------------------------------------- blackjack

    /** Deal a blackjack hand: two cards each, one dealer card face down. */
    public function blackjackDeal(Request $request): JsonResponse
    {
        $data = $request->validate(['bet' => self::betRules(config('arcade.bets'))]);
        $bet = (int) $data['bet'];
        $user = $request->user();

        if ($user->balance < $bet) {
            return response()->json(['message' => 'Not enough coins — top up to keep playing.'], 422);
        }

        $lock = Cache::lock('arcade:'.$user->id, 10);

        if (! $lock->get()) {
            return response()->json(['message' => 'A round is already in progress.'], 429);
        }

        try {
            $definition = $this->catalog->definition('blackjack') ?? [];
            $deck = BlackjackGame::shoe((int) ($definition['decks'] ?? 6));
            $player = [BlackjackGame::draw($deck), BlackjackGame::draw($deck)];
            $dealer = [BlackjackGame::draw($deck), BlackjackGame::draw($deck)];

            $round = DB::transaction(function () use ($user, $bet, $deck, $player, $dealer) {
                $round = ArcadeRound::create([
                    'id' => (string) Str::ulid(),
                    'user_id' => $user->id,
                    'game' => 'blackjack',
                    'status' => ArcadeRound::OPEN,
                    'bet' => $bet,
                    'state' => [
                        'deck' => $deck,
                        'player' => $player,
                        'dealer' => $dealer,
                        'stake' => $bet,
                        'doubled' => false,
                        'outcome' => null,
                    ],
                ]);

                $this->wallet->debit($user, $bet, WalletTransaction::GAME_IN, 'bet-'.$round->id, 'blackjack');

                return $round;
            });

            $state = $round->state;

            // A natural on either side ends the hand immediately.
            if (BlackjackGame::isBlackjack($state['player']) || BlackjackGame::isBlackjack($state['dealer'])) {
                $round = $this->settleBlackjack($round->fresh(), $state);
            }
        } finally {
            $lock->release();
        }

        return response()->json($this->presentBlackjack($round->fresh()));
    }

    /** Take one more card. */
    public function blackjackHit(Request $request): JsonResponse
    {
        $data = $request->validate(['round_id' => ['required', 'string']]);

        $round = $this->openRound($request->user(), 'blackjack', (string) $data['round_id']);
        $state = $round->state;

        $state['player'][] = BlackjackGame::draw($state['deck']);
        $value = BlackjackGame::value($state['player']);

        if ($value['total'] >= 21) {
            // 21 stands by itself; a bust settles without the dealer drawing.
            if (! $value['bust']) {
                $state['dealer'] = BlackjackGame::dealerTurn($state['dealer'], $state['deck']);
            }

            $round = $this->settleBlackjack($round, $state);
        } else {
            $round->forceFill(['state' => $state])->save();
        }

        return response()->json($this->presentBlackjack($round->fresh()));
    }

    /** Stand: the dealer plays out and the hand settles. */
    public function blackjackStand(Request $request): JsonResponse
    {
        $data = $request->validate(['round_id' => ['required', 'string']]);

        $round = $this->openRound($request->user(), 'blackjack', (string) $data['round_id']);
        $state = $round->state;
        $state['dealer'] = BlackjackGame::dealerTurn($state['dealer'], $state['deck']);

        return response()->json($this->presentBlackjack($this->settleBlackjack($round, $state)));
    }

    /** Double: match the stake, take exactly one card, then stand. */
    public function blackjackDouble(Request $request): JsonResponse
    {
        $data = $request->validate(['round_id' => ['required', 'string']]);
        $user = $request->user();

        $round = $this->openRound($user, 'blackjack', (string) $data['round_id']);
        $state = $round->state;

        if (count($state['player']) !== 2) {
            return response()->json(['message' => 'Double is only open on the first two cards.'], 422);
        }

        $extra = (int) $round->bet;

        if ($user->balance < $extra) {
            return response()->json(['message' => 'Not enough coins to double.'], 422);
        }

        DB::transaction(function () use ($user, $round, $extra) {
            $this->wallet->debit($user, $extra, WalletTransaction::GAME_IN, 'double-'.$round->id, 'blackjack');
            $round->forceFill(['bet' => (int) $round->bet + $extra])->save();
        });

        $round = $round->fresh();
        $state['stake'] = (int) $round->bet;
        $state['doubled'] = true;
        $state['player'][] = BlackjackGame::draw($state['deck']);

        if (! BlackjackGame::value($state['player'])['bust']) {
            $state['dealer'] = BlackjackGame::dealerTurn($state['dealer'], $state['deck']);
        }

        return response()->json($this->presentBlackjack($this->settleBlackjack($round, $state)));
    }

    /** @param  array<string, mixed>  $state */
    private function settleBlackjack(ArcadeRound $round, array $state): ArcadeRound
    {
        $stake = (int) ($state['stake'] ?? $round->bet);
        $result = BlackjackGame::settle($state['player'], $state['dealer']);
        $payout = intdiv($stake * (int) round($result['multiplier'] * 100), 100);
        $state['outcome'] = $result['outcome'];

        DB::transaction(function () use ($round, $state, $payout) {
            if ($payout > 0) {
                $this->wallet->credit($round->user, $payout, WalletTransaction::GAME_OUT, 'win-'.$round->id, $round->game);
            }

            $round->forceFill([
                'status' => $payout > 0 ? ArcadeRound::WON : ArcadeRound::LOST,
                'payout' => $payout,
                'state' => $state,
            ])->save();
        });

        return $round->fresh();
    }

    /** @return array<string, mixed> */
    private function presentBlackjack(ArcadeRound $round): array
    {
        $state = $round->state;
        $open = $round->status === ArcadeRound::OPEN;
        $player = $state['player'];
        $dealer = $state['dealer'];
        $hideHole = $open && count($dealer) > 1;
        $playerValue = BlackjackGame::value($player);
        $dealerValue = $hideHole ? null : BlackjackGame::value($dealer);
        $balance = (int) User::whereKey($round->user_id)->value('balance');

        return [
            'round_id' => $round->id,
            'game' => 'blackjack',
            'status' => $round->status,
            'open' => $open,
            'bet' => (int) $round->bet,
            'payout' => (int) $round->payout,
            'balance' => $balance,
            'player' => $player,
            'dealer' => $hideHole ? [$dealer[0]] : $dealer,
            'dealer_hidden' => $hideHole,
            'player_total' => $playerValue['total'],
            'player_soft' => $playerValue['soft'],
            'dealer_total' => $dealerValue['total'] ?? null,
            'blackjack' => BlackjackGame::isBlackjack($player),
            'can_hit' => $open && $playerValue['total'] < 21,
            'can_double' => $open && count($player) === 2 && $balance >= (int) $round->bet,
            'outcome' => $state['outcome'] ?? null,
        ];
    }

    // ---------------------------------------------------------------- video poker

    /** Deal five cards and take the bet. */
    public function videoPokerDeal(Request $request): JsonResponse
    {
        $data = $request->validate(['bet' => self::betRules(config('arcade.bets'))]);
        $bet = (int) $data['bet'];
        $user = $request->user();

        if ($user->balance < $bet) {
            return response()->json(['message' => 'Not enough coins — top up to keep playing.'], 422);
        }

        $lock = Cache::lock('arcade:'.$user->id, 10);

        if (! $lock->get()) {
            return response()->json(['message' => 'A round is already in progress.'], 429);
        }

        try {
            $deck = VideoPokerGame::deck();
            $hand = array_splice($deck, 0, 5);

            $round = DB::transaction(function () use ($user, $bet, $deck, $hand) {
                $round = ArcadeRound::create([
                    'id' => (string) Str::ulid(),
                    'user_id' => $user->id,
                    'game' => 'video-poker',
                    'status' => ArcadeRound::OPEN,
                    'bet' => $bet,
                    'state' => [
                        'deck' => $deck,
                        'hand' => $hand,
                        'outcome' => null,
                    ],
                ]);

                $this->wallet->debit($user, $bet, WalletTransaction::GAME_IN, 'bet-'.$round->id, 'video-poker');

                return $round;
            });
        } finally {
            $lock->release();
        }

        return response()->json($this->presentVideoPoker($round->fresh()));
    }

    /** Keep the held cards, redraw the rest and pay the paytable. */
    public function videoPokerDraw(Request $request): JsonResponse
    {
        $data = $request->validate([
            'round_id' => ['required', 'string'],
            'holds' => ['present', 'array', 'max:5'],
            'holds.*' => ['integer', 'between:0,4'],
        ]);

        $round = $this->openRound($request->user(), 'video-poker', (string) $data['round_id']);
        $state = $round->state;
        $holds = array_values(array_unique(array_map('intval', (array) $data['holds'])));
        $deck = $state['deck'];
        $hand = $state['hand'];

        foreach ($hand as $index => $card) {
            if (! in_array($index, $holds, true) && $deck !== []) {
                $hand[$index] = array_shift($deck);
            }
        }

        $outcome = VideoPokerGame::evaluate($hand);
        $multiplier = VideoPokerGame::multiplier($outcome);
        $payout = (int) $round->bet * $multiplier;
        $state['hand'] = $hand;
        $state['deck'] = $deck;
        $state['outcome'] = $outcome;

        DB::transaction(function () use ($round, $state, $payout, $multiplier) {
            if ($payout > 0) {
                $this->wallet->credit($round->user, $payout, WalletTransaction::GAME_OUT, 'win-'.$round->id, $round->game);
            }

            $round->forceFill([
                'status' => $multiplier > 0 ? ArcadeRound::WON : ArcadeRound::LOST,
                'payout' => $payout,
                'state' => $state,
            ])->save();
        });

        return response()->json($this->presentVideoPoker($round->fresh()));
    }

    /** @return array<string, mixed> */
    private function presentVideoPoker(ArcadeRound $round): array
    {
        $state = $round->state;

        return [
            'round_id' => $round->id,
            'game' => 'video-poker',
            'status' => $round->status,
            'open' => $round->status === ArcadeRound::OPEN,
            'bet' => (int) $round->bet,
            'payout' => (int) $round->payout,
            'balance' => (int) User::whereKey($round->user_id)->value('balance'),
            'hand' => $state['hand'],
            'outcome' => $state['outcome'] ?? null,
        ];
    }

    private function openRound(User $user, string $game, string $roundId): ArcadeRound
    {
        abort_unless($this->catalog->has($game), 404);

        $round = ArcadeRound::whereKey($roundId)
            ->where('user_id', $user->id)
            ->where('game', $game)
            ->firstOrFail();

        abort_unless($round->status === ArcadeRound::OPEN, 422, 'That round is already finished.');

        return $round;
    }

    /** @return array<string, mixed> */
    private function present(ArcadeRound $round, LadderGame $ladder): array
    {
        $state = $round->state;
        $step = (int) ($state['step'] ?? 0);
        $hazardsCount = (int) ($state['hazards_count'] ?? 0);
        $chance = isset($state['chance']) ? (float) $state['chance'] : null;
        $open = $round->status === ArcadeRound::OPEN;

        return [
            'round_id' => $round->id,
            'game' => $round->game,
            'status' => $round->status,
            'shape' => $state['shape'] ?? 'grid',
            'bet' => (int) $round->bet,
            'payout' => (int) $round->payout,
            'balance' => (int) User::whereKey($round->user_id)->value('balance'),
            'step' => $step,
            'revealed' => $state['revealed'] ?? [],
            'hazards_count' => $hazardsCount,
            'max_steps' => $ladder->maxSteps($hazardsCount),
            'multiplier' => $step > 0 ? $ladder->multiplier($step, $hazardsCount, $chance) : 1.0,
            'next_multiplier' => $ladder->multiplier($step + 1, $hazardsCount, $chance),
            'difficulty' => $state['difficulty'] ?? null,
            'chance' => $chance,
            'cells' => $state['cells'] ?? null,
            'row_options' => $state['row_options'] ?? null,
            'hit' => $state['hit'] ?? null,
            // The layout is only safe to publish once the round is finished.
            'hazards' => $open ? null : ($state['hazards'] ?? []),
        ];
    }
}
