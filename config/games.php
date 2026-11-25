<?php

/*
| Built-in ACEGG slots. These run entirely on our own server: the engine draws
| the reels and decides the win, the browser only animates it. That means the
| lobby still has games when the SpinKit RGS is not configured, and it is the
| only game source used while developing.
|
| Money rules
|  - Every amount is an integer in minor units (100 = 1 coin), like SpinKit.
|  - Paytable values are percentages of the TOTAL bet for 3/4/5 of a kind,
|    so 250 means 2.5x the total bet. Wins are paid on the 10 lines below.
*/

return [

    // Bet levels offered in the game UI (minor units).
    'bets' => [10_000, 25_000, 50_000, 100_000, 250_000, 500_000],

    // Row index per reel (0 = top row). 10 fixed lines, left to right.
    'paylines' => [
        [1, 1, 1, 1, 1],
        [0, 0, 0, 0, 0],
        [2, 2, 2, 2, 2],
        [0, 1, 2, 1, 0],
        [2, 1, 0, 1, 2],
        [1, 0, 0, 0, 1],
        [1, 2, 2, 2, 1],
        [0, 0, 1, 0, 0],
        [2, 2, 1, 2, 2],
        [1, 1, 0, 1, 1],
    ],

    'games' => [

    ],
];
