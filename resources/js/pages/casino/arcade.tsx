import { Head } from '@inertiajs/react';
import { BaccaratTable } from '@/components/casino/arcade/baccarat-table';
import { BlackjackTable } from '@/components/casino/arcade/blackjack-table';
import { CaseGame } from '@/components/casino/arcade/case-game';
import { CoinPusher } from '@/components/casino/arcade/coin-pusher';
import { ConnectFourTable } from '@/components/casino/arcade/connect-four-table';
import { CrashGame } from '@/components/casino/arcade/crash-game';
import { DiceDuel } from '@/components/casino/arcade/dice-duel';
import { DrawGame } from '@/components/casino/arcade/draw-game';
import { FlipGame } from '@/components/casino/arcade/flip-game';
import { HiLoTable } from '@/components/casino/arcade/hilo-table';
import { LadderGame } from '@/components/casino/arcade/ladder-game';
import { LimboGame } from '@/components/casino/arcade/limbo-game';
import { SlideGame } from '@/components/casino/arcade/slide-game';
import { RouletteGame } from '@/components/casino/arcade/roulette-game';
import { ScratchCard } from '@/components/casino/arcade/scratch-card';
import { SlotMachine } from '@/components/casino/arcade/slot-machine';
import { VideoPokerTable } from '@/components/casino/arcade/video-poker-table';
import type { ArcadeConfig, Game } from '@/types';

type Props = {
    game: Game;
    bets: number[];
    balance: number;
    config: ArcadeConfig;
    related: Game[];
};

/** Arcade games: draws, coin boards, case openings, crash and ladders. */
export default function Arcade(props: Props) {
    return (
        <>
            <Head title={props.game.name} />
            {props.config.family === 'draw' && <DrawGame {...props} />}
            {props.config.family === 'case' && <CaseGame {...props} />}
            {props.config.family === 'crash' && <CrashGame {...props} />}
            {props.config.family === 'ladder' && <LadderGame {...props} />}
            {props.config.family === 'flip' && <FlipGame {...props} />}
            {props.config.family === 'roulette' && <RouletteGame {...props} />}
            {props.config.family === 'dice' && <DiceDuel {...props} />}
            {props.config.family === 'scratch' && <ScratchCard {...props} />}
            {props.config.family === 'slot' && <SlotMachine {...props} />}
            {props.config.family === 'hilo' && <HiLoTable {...props} />}
            {props.config.family === 'baccarat' && <BaccaratTable {...props} />}
            {props.config.family === 'blackjack' && <BlackjackTable {...props} />}
            {props.config.family === 'videopoker' && <VideoPokerTable {...props} />}
            {props.config.family === 'coinpusher' && <CoinPusher {...props} />}
            {props.config.family === 'connect4' && <ConnectFourTable {...props} />}
            {props.config.family === 'limbo' &&
                (props.config.skin === 'slide' ? (
                    <SlideGame {...props} />
                ) : (
                    <LimboGame {...props} />
                ))}
        </>
    );
}
