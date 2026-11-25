import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
    DEFAULT_LOCALE,
    LOCALES,
    hasTranslation,
    isLocale,
    translate,
} from '@/lib/i18n';
import type { Locale, TranslationKey } from '@/lib/i18n';

const STORAGE_KEY = 'acegg.locale';

type Vars = Record<string, string | number>;

type LanguageContextValue = {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    /** Translate a known key. */
    t: (key: TranslationKey, vars?: Vars) => string;
    /** Translate an optional key (game names, filters…), else use the fallback. */
    tOr: (key: string, fallback: string, vars?: Vars) => string;
    /** Localised game name, falling back to the name the server sent. */
    gameName: (game: { id: string; name: string }) => string;
};

const fallbackValue: LanguageContextValue = {
    locale: DEFAULT_LOCALE,
    setLocale: () => undefined,
    t: (key, vars) => translate(DEFAULT_LOCALE, key, vars),
    tOr: (key, fallback, vars) =>
        hasTranslation(key) ? translate(DEFAULT_LOCALE, key, vars) : fallback,
    gameName: (game) =>
        hasTranslation(`gameName.${game.id}`)
            ? translate(DEFAULT_LOCALE, `gameName.${game.id}`)
            : game.name,
};

const LanguageContext = createContext<LanguageContextValue>(fallbackValue);

function readStoredLocale(): Locale {
    if (typeof window === 'undefined') return DEFAULT_LOCALE;

    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);

        return isLocale(stored) ? stored : DEFAULT_LOCALE;
    } catch {
        return DEFAULT_LOCALE;
    }
}

/**
 * Holds the player's language. Every casino screen reads strings through
 * `useI18n()`, so switching a locale re-renders the whole tree.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

    useEffect(() => {
        document.documentElement.lang = locale;
    }, [locale]);

    const setLocale = useCallback((next: Locale) => {
        setLocaleState(next);

        try {
            window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // Private mode / blocked storage: the choice still applies this session.
        }
    }, []);

    const value = useMemo<LanguageContextValue>(
        () => ({
            locale,
            setLocale,
            t: (key, vars) => translate(locale, key, vars),
            tOr: (key, fallback, vars) =>
                hasTranslation(key) ? translate(locale, key, vars) : fallback,
            gameName: (game) =>
                hasTranslation(`gameName.${game.id}`)
                    ? translate(locale, `gameName.${game.id}`)
                    : game.name,
        }),
        [locale, setLocale],
    );

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useI18n(): LanguageContextValue {
    return useContext(LanguageContext);
}

export { LOCALES };
