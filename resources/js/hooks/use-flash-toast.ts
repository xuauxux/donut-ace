import { router } from '@inertiajs/react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import type { FlashToast } from '@/types/ui';

/** Inertia can emit the same flash twice (redirect + page swap); show it once. */
let lastToast: { message: string; at: number } | null = null;

export function useFlashToast(): void {
    useEffect(() => {
        return router.on('flash', (event) => {
            const flash = (event as CustomEvent).detail?.flash;
            const data = flash?.toast as FlashToast | undefined;

            if (!data) {
                return;
            }

            if (lastToast && lastToast.message === data.message && Date.now() - lastToast.at < 1500) {
                return;
            }
            lastToast = { message: data.message, at: Date.now() };

            toast[data.type](data.message);
        });
    }, []);
}
