<?php

/*
| ACEGG Originals — instant-win games in the style of Stake Originals.
|
| Every game is decided server-side with random_int() and pays from the local
| wallet. Multipliers are tuned to roughly 99% RTP; the printed RTP next to
| each game is what the simulation measured, not a marketing number.
*/

return [

    'bets' => [10_000, 25_000, 50_000, 100_000, 250_000, 500_000],

    'games' => [

        'dice' => [
            'name' => 'Dice',
            'tagline' => 'Pick a range, roll the die',
            'category' => 'originals',
            'mechanic' => 'originals',
            'volatility' => 'medium',
            'rtp' => '99.0%',
            'max_win_x' => 49,
            'accent' => '#7ef7a4',
            'background' => ['#0f3d2a', '#10131a'],
            'cover' => '/images/games/dice.jpg',
            'emoji' => ['🎲'],
        ],

        'plinko' => [
            'name' => 'Plinko',
            'tagline' => 'Drop the ball, chase the edge buckets',
            'category' => 'originals',
            'mechanic' => 'originals',
            'volatility' => 'medium',
            'rtp' => '99.0%',
            'max_win_x' => 75,
            'accent' => '#ff7ac6',
            'background' => ['#3a1030', '#10131a'],
            'cover' => '/images/games/plinko.jpg',
            'emoji' => ['🔻'],
            'rows' => [8, 12, 16],
            'table' => [
                8 => [
                    'low' => [8.08, 2.94, 1.47, 0.73, 0.37, 0.73, 1.47, 2.94, 8.08],
                    'medium' => [16.19, 4.42, 1.47, 0.52, 0.15, 0.52, 1.47, 4.42, 16.19],
                    'high' => [28.50, 5.94, 1.19, 0.24, 0.12, 0.24, 1.19, 5.94, 28.50],
                ],
                12 => [
                    'low' => [10.45, 6.27, 4.18, 2.09, 1.04, 0.63, 0.42, 0.63, 1.04, 2.09, 4.18, 6.27, 10.45],
                    'medium' => [14.77, 7.95, 4.54, 2.27, 1.14, 0.57, 0.23, 0.57, 1.14, 2.27, 4.54, 7.95, 14.77],
                    'high' => [31.44, 15.72, 6.29, 2.62, 1.05, 0.31, 0.10, 0.31, 1.05, 2.62, 6.29, 15.72, 31.44],
                ],
                16 => [
                    'low' => [20.74, 11.67, 7.78, 5.18, 2.59, 1.30, 0.91, 0.65, 0.52, 0.65, 0.91, 1.30, 2.59, 5.18, 7.78, 11.67, 20.74],
                    'medium' => [34.67, 19.07, 10.40, 6.07, 3.47, 1.73, 0.87, 0.43, 0.26, 0.43, 0.87, 1.73, 3.47, 6.07, 10.40, 19.07, 34.67],
                    'high' => [75.03, 37.51, 16.67, 8.34, 4.17, 1.67, 0.67, 0.33, 0.17, 0.33, 0.67, 1.67, 4.17, 8.34, 16.67, 37.51, 75.03],
                ],
            ],
        ],

        'keno' => [
            'name' => 'Keno',
            'tagline' => 'Pick up to 10 numbers, 20 are drawn',
            'category' => 'originals',
            'mechanic' => 'originals',
            'volatility' => 'high',
            'rtp' => '99.0%',
            'max_win_x' => 24,
            'accent' => '#b98cff',
            'background' => ['#241145', '#10131a'],
            'cover' => '/images/games/keno.jpg',
            'emoji' => ['🔢'],
            'pick_max' => 10,
            'max_number' => 40,
            'draw' => 20,
            // Payout by number of picks → hits.
            'paytable' => [
                1 => [0.00, 1.98],
                2 => [0.00, 0.97, 2.03],
                3 => [0.00, 0.58, 1.22, 2.57],
                4 => [0.00, 0.37, 0.78, 1.64, 3.43],
                5 => [0.00, 0.24, 0.51, 1.06, 2.23, 4.68],
                6 => [0.00, 0.16, 0.33, 0.69, 1.46, 3.06, 6.44],
                7 => [0.00, 0.10, 0.22, 0.46, 0.96, 2.02, 4.23, 8.89],
                8 => [0.00, 0.07, 0.14, 0.30, 0.63, 1.33, 2.79, 5.87, 12.33],
                9 => [0.00, 0.05, 0.10, 0.20, 0.42, 0.88, 1.85, 3.89, 8.17, 17.15],
                10 => [0.00, 0.03, 0.06, 0.13, 0.28, 0.59, 1.23, 2.59, 5.43, 11.40, 23.95],
            ],
        ],

    ],
];
