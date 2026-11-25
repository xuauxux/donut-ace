import { Head } from '@inertiajs/react';
import { Dice } from '@/components/casino/originals/dice';
import { Keno } from '@/components/casino/originals/keno';
import { Plinko } from '@/components/casino/originals/plinko';
import type { Game, OriginalConfig } from '@/types';

type Props = {
    game: Game;
    bets: number[];
    balance: number;
    config: OriginalConfig;
    related: Game[];
};

/** Instant-win originals. Each game owns its own board and animation. */
export default function Original(props: Props) {
    return (
        <>
            <Head title={props.game.name} />
            {props.game.id === 'dice' && <Dice {...props} />}
            {props.game.id === 'plinko' && <Plinko {...props} />}
            {props.game.id === 'keno' && <Keno {...props} />}
        </>
    );
}
