<?php

return [
    /*
    | Social casino settings. All amounts are integers in minor units
    | (1 coin = 100 units), the same as the SpinKit API.
    */
    'currency_label' => env('CASINO_CURRENCY_LABEL', 'Coins'),

    // Card-brand / compliance marks shown in the footer (files in
    // public/images/payments/<name>.png). Empty by default: coins are a virtual
    // currency, no card scheme applies, and no certification is held, so no
    // marks may be displayed. Only list marks you are actually entitled to use.
    'payment_logos' => array_values(array_filter(explode(',', env('PAYMENT_LOGOS', '')))),

    // Coins credited once to every new account. Zero by default: a new account
    // starts empty and only gets coins by playing, depositing or the daily bonus.
    'welcome_bonus' => (int) env('CASINO_WELCOME_BONUS', 0),

    // Daily free top-up when the balance drops below this amount.
    'daily_bonus' => (int) env('CASINO_DAILY_BONUS', 100_000),

    // Prefix for SpinKit external player ids: "{prefix}{user_id}".
    'player_prefix' => env('CASINO_PLAYER_PREFIX', 'acegg-'),

    // How long the SpinKit games list is cached (seconds).
    'games_cache_ttl' => (int) env('CASINO_GAMES_CACHE_TTL', 300),

    /*
    | VIP Club. XP = coins wagered in SpinKit games (1 XP per 1 coin).
    | reward / mission amounts are in minor units.
    */
    'vip' => [
        'levels' => [
            ['name' => 'Bronze', 'xp' => 0, 'reward' => 0, 'color' => '#d08a4e'],
            ['name' => 'Silver', 'xp' => 5_000, 'reward' => 100_000, 'color' => '#c3cad6'],
            ['name' => 'Gold', 'xp' => 25_000, 'reward' => 500_000, 'color' => '#ffc83d'],
            ['name' => 'Platinum', 'xp' => 100_000, 'reward' => 2_000_000, 'color' => '#7fe3ff'],
            ['name' => 'Diamond', 'xp' => 500_000, 'reward' => 10_000_000, 'color' => '#c084fc'],
        ],
        'missions' => [
            // Wager this many coins today (minor units) → reward.
            'daily_wager' => ['target' => 1_000_000, 'reward' => 100_000],
            // Play on this many different days in the current week → reward.
            'weekly_activity' => ['target' => 3, 'reward' => 250_000],
        ],
    ],

    /*
    | Hourly lottery: pick 5 numbers out of 1..36. Amounts in minor units.
    */
    'lottery' => [
        'ticket_price' => (int) env('LOTTERY_TICKET_PRICE', 100_000), // 1,000 coins
        'max_tickets_per_round' => (int) env('LOTTERY_MAX_TICKETS', 10),
        'pick' => 5,
        'max_number' => 36,
        'seed_pool' => (int) env('LOTTERY_SEED_POOL', 1_000_000), // house seed per round (10,000 coins)
        'pool_share' => 0.9, // share of ticket sales added to the prize pool
        // Share of the pool paid to each tier (split between winners in the tier).
        'tiers' => [5 => 0.5, 4 => 0.25, 3 => 0.15],
        // Fixed prize for 2 matches (refund-like), paid from the house.
        'fixed' => [2 => 20_000], // 200 coins
    ],

    /*
    | In-game deposits. Players /pay the bot in Minecraft; the bridge relays the
    | "<name> paid you $1.5m" receipt and the payer's IGN is credited here.
    | game_amount is in whole in-game dollars, coins are minor units (100/coin).
    */
    'withdraw' => [
        'enabled' => filter_var(env('MC_WITHDRAW_ENABLED', true), FILTER_VALIDATE_BOOL),
        // In-game whole dollars. Payouts are capped by the bot's actual float
        // (credited deposits minus everything already requested or paid).
        'min_game' => (int) env('MC_WITHDRAW_MIN_GAME', 10_000),
        'max_game' => (int) env('MC_WITHDRAW_MAX_GAME', 5_000_000_000),
        'daily_game' => (int) env('MC_WITHDRAW_DAILY_GAME', 20_000_000_000),
        // DonutSMP charges this on top of every /pay ("+$200 tax" on $10K).
        // The house covers it, but it still reduces the bot's real float.
        'tax_bps' => (int) env('MC_WITHDRAW_TAX_BPS', 200),
        // One open request per player: the bot pays in order and never retries.
        'max_pending' => (int) env('MC_WITHDRAW_MAX_PENDING', 1),
        // A request the bot never claimed is refunded after this long.
        'pending_ttl_minutes' => (int) env('MC_WITHDRAW_TTL_MINUTES', 30),
    ],

    'deposit' => [
        'enabled' => filter_var(env('MC_DEPOSIT_ENABLED', true), FILTER_VALIDATE_BOOL),
        // Leave empty to learn it from the bot's own login name.
        'bot_ign' => env('MC_DEPOSIT_BOT_IGN', ''),
        // Site coins granted per 1,000,000 in-game dollars (1,000,000 = $1 in
        // game buys 1 coin).
        'coins_per_million' => (int) env('MC_DEPOSIT_COINS_PER_MILLION', 1_000_000),
        'min_game' => (int) env('MC_DEPOSIT_MIN_GAME', 10_000),
        'max_game' => (int) env('MC_DEPOSIT_MAX_GAME', 100_000_000_000),
        // Deposit tiers, priced in in-game money (whole dollars in the game).
        'tiers' => [
            ['id' => 'starter', 'name' => 'Starter', 'game' => 10_000_000],
            ['id' => 'basic', 'name' => 'Basic', 'game' => 100_000_000],
            ['id' => 'popular', 'name' => 'Popular', 'game' => 500_000_000],
            ['id' => 'high-roller', 'name' => 'High Roller', 'game' => 1_000_000_000],
            ['id' => 'whale', 'name' => 'Whale', 'game' => 2_000_000_000],
            ['id' => 'addict', 'name' => 'Addict', 'game' => 5_000_000_000],
        ],
    ],
];
