export type Game = {
    id: string;
    name: string;
    category: string | null;
    collection: string | null;
    mechanic: string | null;
    volatility: string | null;
    rtp: string | null;
    max_win_x: number | null;
    thumbnail: string | null;
    cover: string | null;
    icons: string[];
    emoji?: string[];
    accent: string | null;
    background: [string, string] | null;
    bonus_buy: boolean;
    free_spins: boolean;
};

export type SlotSymbol = {
    code: string;
    name: string;
    emoji: string;
};

export type SlotWin = {
    /** 1-10 for a payline, 0 for a scatter pay. */
    line: number;
    symbol: string;
    count: number;
    /** Percentage of the total bet (250 = 2.5x). */
    mult: number;
    amount: number;
    /** [column, row] cells to highlight. */
    cells: [number, number][];
};

export type OriginalResult = {
    multiplier: number;
    total_win: number;
    balance: number;
    round_id: string;
    bet: number;
    game: string;
    detail: Record<string, unknown>;
};

export type OriginalConfig = {
    min_target?: number;
    max_target?: number;
    max_multiplier?: number;
    rows?: number[];
    table?: Record<string, Record<string, number[]>>;
    max_balls?: number;
    pick_max?: number;
    max_number?: number;
    draw?: number;
    paytable?: Record<string, number[]>;
};

export type ArcadeOption = {
    id: string;
    label: string;
    emoji: string;
    mult: number;
};

export type ArcadeItem = {
    label: string;
    emoji: string;
    mult: number;
};

/** A scratch-card symbol and the prize three of them pays. */
export type ArcadeSymbol = {
    id: string;
    label: string;
    emoji: string;
    mult: number;
};

/** A Donut Flip board: sixteen equally likely tiles, 0 = skull. */
export type ArcadeBoard = {
    id: string;
    label: string;
    tiles: number[];
    /** Road rounds: chance that one hop is safe and what it pays. */
    chance?: number | null;
    step_multiplier?: number | null;
    max_steps?: number;
    /** Tower difficulties: how many tiles each floor shows. */
    options?: number;
};

/** A slot machine's reel faces, paytable and payline geometry. */
export type SlotConfig = {
    symbols: { id: string; name: string; emoji: string; wild: boolean; scatter: boolean; tier: string }[];
    /** The server's RTP scaling factor for the raw paytable below. */
    scaler: number;
    paytable: Record<string, Record<string, number>>;
    paylines: number[][];
    accent: string | null;
    background: [string, string] | null;
};

/** One playing card, 1..13 with Ace low and King high. */
export type PlayingCardData = {
    suit: 'spades' | 'hearts' | 'diamonds' | 'clubs';
    rank: string;
    value: number;
};

/** Everything the arcade boards need to render a game. */
export type ArcadeConfig = {
    family:
        | 'draw'
        | 'case'
        | 'crash'
        | 'ladder'
        | 'flip'
        | 'roulette'
        | 'dice'
        | 'scratch'
        | 'slot'
        | 'hilo'
        | 'baccarat'
        | 'limbo'
        | 'blackjack'
        | 'videopoker'
        | 'coinpusher'
        | 'connect4';
    slot: SlotConfig | null;
    mode: 'match' | 'prize' | null;
    skin?: string;
    options: ArcadeOption[];
    items: ArcadeItem[];
    shape: 'grid' | 'rows' | 'road' | null;
    cells: number | null;
    hazards: number[] | null;
    default_hazards: number | null;
    rows: number | null;
    row_options: number | null;
    max_multiplier: number | null;
    difficulties: ArcadeBoard[];
    default_difficulty: string | null;
    symbols: ArcadeSymbol[];
    red: number[];
    /** Wheel pocket order, clockwise from the top. */
    order: number[];
    pockets: number | null;
    /** Green pockets: [0] on a European wheel, [0, 37] (00) on an American one. */
    zeros: number[];
    paytable: { id: string; label: string; mult: number }[] | null;
};

/** State of an open (or finished) cash-out round, as the server reports it. */
export type LadderRound = {
    round_id: string;
    game: string;
    status: 'open' | 'won' | 'lost';
    shape: 'grid' | 'rows' | 'road';
    /** Road rounds only. */
    difficulty?: string | null;
    chance?: number | null;
    bet: number;
    payout: number;
    balance: number;
    step: number;
    revealed: number[];
    hazards_count: number;
    max_steps: number;
    multiplier: number;
    next_multiplier: number;
    cells: number | null;
    row_options: number | null;
    hit: number | null;
    hazards: number[] | null;
};

export type BigWin = {
    round_id: string;
    player: string;
    game_id: string;
    game_name: string;
    thumbnail: string | null;
    icon: string | null;
    background: [string, string] | null;
    win: number;
    multiplier: number | null;
};

export type Wallet = {
    balance: number;
    in_game: boolean;
    daily_bonus_available: boolean;
    daily_bonus_amount: number;
    vip_level: VipLevel;
};

export type VipLevel = {
    name: string;
    xp: number;
    reward: number;
    color: string;
};

export type Company = {
    name: string;
    number: string;
    address: string;
    email: string;
    jurisdiction: string | null;
};
