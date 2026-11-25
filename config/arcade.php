<?php

/*
| ACEGG Arcade — the Stake-style originals suite.
|
| Four families cover every game, all resolved server-side from this config:
|
|   draw   — the server draws one outcome; every bet pays 0.99 / probability,
|            so each market is exactly 99% RTP (or its own listed RTP when a
|            game sets explicit multipliers).
|   ladder — reveal cells/rows step by step and cash out; the multiplier is
|            0.99 / P(still alive), so it is honest by construction.
|   case   — weighted item drop, payouts scaled so the case is 99% RTP.
|   crash  — auto-cashout target; crash point is 0.99/(1-u), so P(reach t)
|            is 0.99/t.
|   flip   — a coin lands on one of 16 equally likely board tiles; the coin
|            tiles of every difficulty sum to 0.99 × 16, so each board is 99%.
|
| Money is always an integer in minor units (100 = 1 coin).
*/

return [

    'bets' => [10_000, 25_000, 50_000, 100_000, 250_000, 500_000],

    'games' => [

        // ---------------------------------------------------------------- draw (match)

        'flip' => [
            'family' => 'draw',
            'mode' => 'match',
            'skin' => 'coin',
            'name' => 'Coin Flip',
            'tagline' => 'Call it in the air',
            'volatility' => 'low',
            'rtp' => '99.0%',
            'max_win_x' => 2,
            'accent' => '#ffd166',
            'background' => ['#3a2c0b', '#10131a'],
            'emoji' => ['🪙'],
            'options' => [
                'heads' => ['label' => 'Heads', 'emoji' => '🪙', 'p' => 0.5],
                'tails' => ['label' => 'Tails', 'emoji' => '💫', 'p' => 0.5],
            ],
        ],

        'rock-paper-scissors' => [
            'family' => 'draw',
            'mode' => 'match',
            'skin' => 'hands',
            'name' => 'Rock Paper Scissors',
            'tagline' => 'Best of one',
            'volatility' => 'medium',
            'rtp' => '99.0%',
            'max_win_x' => 3,
            'accent' => '#9ae6b4',
            'background' => ['#12351f', '#10131a'],
            'emoji' => ['✌️'],
            'options' => [
                'rock' => ['label' => 'Rock', 'emoji' => '🪨', 'p' => 0.3333],
                'paper' => ['label' => 'Paper', 'emoji' => '📄', 'p' => 0.3333],
                'scissors' => ['label' => 'Scissors', 'emoji' => '✂️', 'p' => 0.3334],
            ],
        ],

        // Darts: three concentric rings, one market per ring.
        'darts' => [
            'family' => 'draw',
            'mode' => 'match',
            'skin' => 'target',
            'name' => 'Darts',
            'tagline' => 'Call the ring the dart lands in',
            'volatility' => 'high',
            'rtp' => '99.0%',
            'max_win_x' => 50,
            'accent' => '#7dd3fc',
            'background' => ['#0f2a3d', '#10131a'],
            'emoji' => ['🎯'],
            'options' => [
                'bull' => ['label' => 'Bullseye', 'emoji' => '🎯', 'p' => 0.02],
                'inner' => ['label' => 'Inner', 'emoji' => '🟠', 'p' => 0.13],
                'outer' => ['label' => 'Outer', 'emoji' => '🔵', 'p' => 0.85],
            ],
        ],

        // Card streak: deal, then call higher or lower and cash out any time.
        // Every step pays 0.99 / P(win), so the streak is 99% by construction.
        'hilo' => [
            'family' => 'hilo',
            'skin' => 'card',
            'name' => 'HiLo',
            'tagline' => 'Call the next card higher or lower and cash out any time',
            'volatility' => 'medium',
            'rtp' => '99.0%',
            'max_win_x' => 13,
            'accent' => '#ff8fab',
            'background' => ['#3b1220', '#10131a'],
            'emoji' => ['🃏'],
        ],

        // Authentic Punto Banco on an eight-deck shoe with the standard
        // third-card rules. Player 1.98×, Banker 1.95×, Tie 8.95×; a tie
        // pushes Player and Banker at 1.00×.
        'baccarat' => [
            'family' => 'baccarat',
            'skin' => 'card',
            'name' => 'Baccarat',
            'tagline' => 'Punto Banco on an eight-deck shoe',
            'volatility' => 'low',
            'rtp' => '97.2%',
            'max_win_x' => 9,
            'accent' => '#c084fc',
            'background' => ['#241145', '#10131a'],
            'emoji' => ['🀄'],
            'markets' => [
                'player' => ['label' => 'Player', 'emoji' => '🟦', 'mult' => 1.98],
                'banker' => ['label' => 'Banker', 'emoji' => '🟥', 'mult' => 1.95],
                'tie' => ['label' => 'Tie', 'emoji' => '🟨', 'mult' => 8.95],
            ],
        ],

        // ---------------------------------------------------------------- draw (prize)

        'wheel' => [
            'family' => 'draw',
            'mode' => 'prize',
            'skin' => 'wheel',
            'name' => 'Wheel',
            'tagline' => 'Spin and take what the wheel gives',
            'volatility' => 'medium',
            'rtp' => '99.0%',
            'max_win_x' => 3,
            'accent' => '#ffd166',
            'background' => ['#3a2c0b', '#10131a'],
            'emoji' => ['🎡'],
            'options' => [
                's1' => ['label' => '0.00x', 'weight' => 1, 'mult' => 0],
                's2' => ['label' => '0.00x', 'weight' => 1, 'mult' => 0],
                's3' => ['label' => '0.20x', 'weight' => 1, 'mult' => 0.2],
                's4' => ['label' => '0.40x', 'weight' => 1, 'mult' => 0.4],
                's5' => ['label' => '0.60x', 'weight' => 1, 'mult' => 0.6],
                's6' => ['label' => '0.80x', 'weight' => 1, 'mult' => 0.8],
                's7' => ['label' => '1.00x', 'weight' => 1, 'mult' => 1],
                's8' => ['label' => '1.60x', 'weight' => 1, 'mult' => 1.6],
                's9' => ['label' => '2.10x', 'weight' => 1, 'mult' => 2.1],
                's10' => ['label' => '3.20x', 'weight' => 1, 'mult' => 3.2],
            ],
        ],

        // ---------------------------------------------------------------- roulette

        'roulette' => [
            'family' => 'roulette',
            'name' => 'Roulette',
            'tagline' => 'Thirty-six pockets, eighteen red, eighteen black',
            'volatility' => 'medium',
            'rtp' => '99.0%',
            'max_win_x' => 37,
            'accent' => '#ff6b6b',
            'background' => ['#1c0f14', '#0b0d11'],
            'emoji' => ['🎡'],
            'pockets' => 37,
            // European wheel: 0..36, real pocket order.
            //   straight up (37 numbers, 0 included)  36.63x — 36.63 / 37 = 99%
            //   dozens / columns (12 pockets)          2.97x — (12 × 2.97 + 1) / 37
            //   even money (18 pockets)                1.98x — (18 × 1.98 + 1) / 37
            // Every outside bet is pushed on zero; a straight-up bet on 1-36 is
            // pushed too, so zero only pays the green bet itself.
            'straight_mult' => 36.63,
            'markets' => [
                'green' => ['label' => '0', 'emoji' => '🟢', 'mult' => 36.63],
                'd1' => ['label' => '1st 12', 'emoji' => '1️⃣', 'mult' => 2.97],
                'd2' => ['label' => '2nd 12', 'emoji' => '2️⃣', 'mult' => 2.97],
                'd3' => ['label' => '3rd 12', 'emoji' => '3️⃣', 'mult' => 2.97],
                'c1' => ['label' => '2:1 · bottom', 'emoji' => '', 'mult' => 2.97],
                'c2' => ['label' => '2:1 · middle', 'emoji' => '', 'mult' => 2.97],
                'c3' => ['label' => '2:1 · top', 'emoji' => '', 'mult' => 2.97],
                'red' => ['label' => 'Red', 'emoji' => '🔴', 'mult' => 1.98],
                'black' => ['label' => 'Black', 'emoji' => '⚫', 'mult' => 1.98],
                'odd' => ['label' => 'Odd', 'emoji' => '1️⃣', 'mult' => 1.98],
                'even' => ['label' => 'Even', 'emoji' => '2️⃣', 'mult' => 1.98],
                'low' => ['label' => '1-18', 'emoji' => '⬇️', 'mult' => 1.98],
                'high' => ['label' => '19-36', 'emoji' => '⬆️', 'mult' => 1.98],
            ],
            'red' => [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
            'order' => [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26],
        ],

        // ---------------------------------------------------------------- dice

        'dice-duel' => [
            'family' => 'dice',
            'name' => 'Dice Duel',
            'tagline' => 'Two dice, one call',
            'volatility' => 'medium',
            'rtp' => '99.0%',
            'max_win_x' => 18,
            'accent' => '#a3e635',
            'background' => ['#20300d', '#10131a'],
            'emoji' => ['🎲'],
            // Payouts are 0.99 / P(market) and land on exact two decimals.
            'markets' => [
                'even' => ['label' => 'Even total', 'emoji' => '✌️', 'mult' => 1.98],
                'odd' => ['label' => 'Odd total', 'emoji' => '✋', 'mult' => 1.98],
                'doubles' => ['label' => 'Doubles', 'emoji' => '🎯', 'mult' => 5.94],
                'seven' => ['label' => 'Exactly 7', 'emoji' => '7️⃣', 'mult' => 5.94],
                'extreme' => ['label' => '2 or 12', 'emoji' => '💥', 'mult' => 17.82],
            ],
        ],

        // ---------------------------------------------------------------- scratch

        'scratch' => [
            'family' => 'scratch',
            'name' => 'Scratch Card',
            'tagline' => 'Scratch three of a kind and take the prize',
            'volatility' => 'medium',
            'rtp' => '99.0%',
            'max_win_x' => 9,
            'accent' => '#7dd3fc',
            'background' => ['#0f2b3d', '#10131a'],
            'emoji' => ['🎟️'],
            // 1.5 × 30% + 3 × 12% + 9 × 2% = 0.45 + 0.36 + 0.18 = 99% RTP.
            'symbols' => [
                ['id' => 'cherry', 'label' => 'Cherry', 'emoji' => '🍒', 'mult' => 1.5, 'weight' => 30],
                ['id' => 'lemon', 'label' => 'Lemon', 'emoji' => '🍋', 'mult' => 3, 'weight' => 12],
                ['id' => 'bell', 'label' => 'Bell', 'emoji' => '🔔', 'mult' => 9, 'weight' => 2],
            ],
            'lose_weight' => 56,
            'filler' => ['⭐', '💎'],
        ],

        // ---------------------------------------------------------------- ladder

        'mines' => [
            'family' => 'ladder',
            'shape' => 'grid',
            'name' => 'Mines',
            'tagline' => 'Sweep the board, cash out before a mine',
            'volatility' => 'high',
            'rtp' => '99.0%',
            'max_win_x' => 2277,
            'accent' => '#ff7a90',
            'background' => ['#3b1220', '#10131a'],
            'emoji' => ['💣'],
            'cells' => 25,
            'hazards' => [1, 3],
            'default_hazards' => 3,
        ],

        'chicken' => [
            'family' => 'ladder',
            'shape' => 'road',
            'skin' => 'road',
            'name' => 'Road Hopper',
            'tagline' => 'Hop across the road and cash out before a car gets you',
            'volatility' => 'medium',
            'rtp' => '99.0%',
            'max_win_x' => 2106,
            'accent' => '#3ad07a',
            'background' => ['#16212e', '#080c12'],
            'emoji' => ['🐔'],
            'rows' => 15,
            'difficulties' => [
                'easy' => ['label' => 'Easy', 'chance' => 0.92],
                'medium' => ['label' => 'Medium', 'chance' => 0.85],
                'hard' => ['label' => 'Hard', 'chance' => 0.75],
                'hardcore' => ['label' => 'Hardcore', 'chance' => 0.60],
            ],
            'default_difficulty' => 'medium',
        ],

        'drill' => [
            'family' => 'ladder',
            'shape' => 'rows',
            'name' => 'Tower',
            'tagline' => 'Climb the tower and cash out before a trap floor',
            'volatility' => 'high',
            'rtp' => '99.0%',
            'max_win_x' => 253,
            'accent' => '#d08a4e',
            'background' => ['#33240f', '#10131a'],
            'emoji' => ['🗼'],
            'rows' => 8,
            'options' => 3,
            // Difficulty is how many tiles each floor shows. Fewer tiles means
            // worse survival odds per floor and a steeper payout ladder; every
            // setting is 0.99 / P(survive every floor), so all are 99% RTP.
            'difficulties' => [
                'easy' => ['label' => 'Easy', 'options' => 4],
                'medium' => ['label' => 'Medium', 'options' => 3],
                'hard' => ['label' => 'Hard', 'options' => 2],
            ],
            'default_difficulty' => 'medium',
        ],

        // ---------------------------------------------------------------- cases

        'cases' => [
            'family' => 'case',
            'name' => 'Cases',
            'tagline' => 'Open a case, take the item',
            'volatility' => 'high',
            'rtp' => '99.2%',
            'max_win_x' => 13,
            'accent' => '#c084fc',
            'background' => ['#241145', '#10131a'],
            'emoji' => ['🧰'],
            'items' => [
                ['label' => 'Common', 'emoji' => '🪙', 'weight' => 50, 'mult' => 0.19],
                ['label' => 'Uncommon', 'emoji' => '💵', 'weight' => 25, 'mult' => 0.56],
                ['label' => 'Rare', 'emoji' => '💍', 'weight' => 15, 'mult' => 1.38],
                ['label' => 'Epic', 'emoji' => '👑', 'weight' => 8, 'mult' => 3.75],
                ['label' => 'Legendary', 'emoji' => '🏆', 'weight' => 2, 'mult' => 12.5],
            ],
        ],

        // ---------------------------------------------------------------- crash

        'crash' => [
            'family' => 'crash',
            'name' => 'Crash',
            'tagline' => 'Set your cashout, watch the multiplier climb',
            'volatility' => 'high',
            'rtp' => '99.0%',
            'max_win_x' => 1000,
            'accent' => '#ff7ac6',
            'background' => ['#3a1030', '#10131a'],
            'emoji' => ['🚀'],
            'max_multiplier' => 1000,
        ],

        // Limbo: pick a target; the multiplier crashes at 0.99 / U, so any
        // target is exactly 99% RTP and the payout is bet × target.
        'limbo' => [
            'family' => 'limbo',
            'name' => 'Limbo',
            'tagline' => 'Set a target and watch it climb',
            'volatility' => 'high',
            'rtp' => '99.0%',
            'max_win_x' => 1000,
            'accent' => '#a78bfa',
            'background' => ['#241a4a', '#10131a'],
            'emoji' => ['📈'],
            'max_multiplier' => 1000,
        ],

        // Slide: the same 0.99 / target maths as Limbo, played on a sweeping
        // board — the cursor slides across the tiles and settles on the round's
        // multiplier. Land at or above your target and it pays bet × target.
        'slide' => [
            'family' => 'limbo',
            'skin' => 'slide',
            'name' => 'Slide',
            'tagline' => 'Send the slider across the board and land above your target',
            'volatility' => 'high',
            'rtp' => '99.0%',
            'max_win_x' => 1000,
            'accent' => '#3ad07a',
            'background' => ['#0f2a24', '#10131a'],
            'emoji' => ['🎚️'],
            'max_multiplier' => 1000,
        ],

        // Connect 4: a real board against the house AI. Win 1.98x, draw pushes.
        // Skill game — the RTP depends on how well you play, so it is not quoted.
        'connect-4' => [
            'family' => 'connect4',
            'name' => 'Connect 4',
            'tagline' => 'Four in a row against the house',
            'volatility' => 'medium',
            'rtp' => 'Skill',
            'max_win_x' => 2,
            'accent' => '#f5b82e',
            'background' => ['#241a3a', '#10131a'],
            'emoji' => ['🔴'],
        ],

        // ---------------------------------------------------------------- blackjack

        // Six-deck blackjack: hit, stand or double, dealer stands on soft 17
        // and a natural pays 3:2 — about 99.5% RTP with basic strategy.
        'blackjack' => [
            'family' => 'blackjack',
            'name' => 'Blackjack',
            'tagline' => 'Beat the dealer without busting',
            'volatility' => 'low',
            'rtp' => '99.5%',
            'max_win_x' => 3,
            'accent' => '#f5b82e',
            'background' => ['#0f2a24', '#10131a'],
            'emoji' => ['🃏'],
            'decks' => 6,
            'blackjack_pays' => 1.5,
        ],

        // Jacks or Better video poker on the classic 9/6 paytable: 99.54% RTP.
        'video-poker' => [
            'family' => 'videopoker',
            'name' => 'Video Poker',
            'tagline' => 'Jacks or Better — hold five, draw once',
            'volatility' => 'medium',
            'rtp' => '99.5%',
            'max_win_x' => 250,
            'accent' => '#7dd3fc',
            'background' => ['#0f2a3d', '#10131a'],
            'emoji' => ['🖥️'],
        ],

        // Coin Pusher: five drop lanes, a fixed spill table (0.99 RTP).
        'coin-pusher' => [
            'family' => 'coinpusher',
            'name' => 'Coin Pusher',
            'tagline' => 'Drop a coin and push the pile over the edge',
            'volatility' => 'high',
            'rtp' => '99.0%',
            'max_win_x' => 10,
            'accent' => '#f5b82e',
            'background' => ['#2b2410', '#0b0d11'],
            'emoji' => ['🪙'],
            'lanes' => 5,
            // 292·0 + 200·0.5 + 200·1 + 150·1.5 + 80·2 + 55·3 + 18·5 + 5·10 = 990 / 1000.
            'payouts' => [
                ['coins' => 0, 'mult' => 0.0, 'weight' => 292],
                ['coins' => 2, 'mult' => 0.5, 'weight' => 200],
                ['coins' => 4, 'mult' => 1.0, 'weight' => 200],
                ['coins' => 6, 'mult' => 1.5, 'weight' => 150],
                ['coins' => 8, 'mult' => 2.0, 'weight' => 80],
                ['coins' => 12, 'mult' => 3.0, 'weight' => 55],
                ['coins' => 20, 'mult' => 5.0, 'weight' => 18],
                ['coins' => 40, 'mult' => 10.0, 'weight' => 5],
            ],
        ],

    ],
];
