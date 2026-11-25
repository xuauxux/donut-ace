import { cn } from '@/lib/utils';

const FACES: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
};

type Props = {
    face: number;
    state: 'idle' | 'rolling' | 'win' | 'lose';
};

/** The tumble die from the Donut Flip reference: a rounded cube with pips. */
export function DiceCube({ face, state }: Props) {
    const pips = FACES[Math.min(6, Math.max(1, face))] ?? FACES[5];

    return (
        <div
            className={cn(
                'dice-cube',
                state === 'rolling' && 'dice-tumble',
                state === 'win' && 'dice-win',
                state === 'lose' && 'dice-lose',
            )}
            aria-hidden
        >
            {Array.from({ length: 9 }, (_, index) => (
                <span
                    key={index}
                    className={cn(
                        'm-auto size-[18px] rounded-full transition-colors duration-150',
                        pips.includes(index)
                            ? 'bg-[radial-gradient(circle_at_35%_30%,#4a4f57,#0f1114)] shadow-[inset_0_-2px_3px_rgba(0,0,0,0.55)]'
                            : 'bg-transparent',
                    )}
                />
            ))}
        </div>
    );
}
