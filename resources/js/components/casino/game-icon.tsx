import type { ReactElement } from 'react';
import { BOMB_PATH } from '@/components/casino/game-icons';
import { cn } from '@/lib/utils';

/**
 * The site's own game icon set.
 *
 * Game data still carries an emoji as its symbol code (it is what the server
 * sends and what the configs are written with), but every board, card and reel
 * draws that code through here instead of printing the OS emoji font. Glyphs we
 * haven't drawn yet fall back to the emoji so nothing ever renders blank.
 */

const GOLD = '#f5b82e';
const GOLD_DARK = '#a9770d';
const LIME = '#c9f73a';
const CYAN = '#67e8f9';
const CYAN_DARK = '#0e7490';
const INK = '#0b0e13';
const STEEL = '#94a3b8';
const WHITE = '#f1f5f9';

const ORBS: Record<string, { color: string; square?: boolean }> = {
    '🔴': { color: '#ef4444' },
    '🟠': { color: '#f97316' },
    '🟡': { color: '#eab308' },
    '🟢': { color: '#22c55e' },
    '🔵': { color: '#3b82f6' },
    '🟣': { color: '#a855f7' },
    '⚫': { color: '#1f2937' },
    '⚪': { color: '#e2e8f0' },
    '🟥': { color: '#dc2626', square: true },
    '🟦': { color: '#2563eb', square: true },
    '🟨': { color: '#facc15', square: true },
    '🟩': { color: '#16a34a', square: true },
    '⬛': { color: '#111827', square: true },
    '⬜': { color: '#f8fafc', square: true },
};

const KEYCAPS: Record<string, string> = {
    '1⃣': '1',
    '2⃣': '2',
    '3⃣': '3',
    '4⃣': '4',
    '7⃣': '7',
};

function orb(color: string, square?: boolean): ReactElement {
    if (square) {
        return (
            <>
                <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="3.4" fill={color} />
                <rect
                    x="3.4"
                    y="3.4"
                    width="17.2"
                    height="17.2"
                    rx="3.4"
                    fill="none"
                    stroke="#000"
                    strokeOpacity=".25"
                    strokeWidth="1.2"
                />
                <ellipse cx="9" cy="8.4" rx="3.4" ry="2.2" fill="#fff" opacity=".28" />
            </>
        );
    }

    return (
        <>
            <circle cx="12" cy="12" r="8.8" fill={color} />
            <circle cx="12" cy="12" r="8.8" fill="none" stroke="#000" strokeOpacity=".28" strokeWidth="1.2" />
            <ellipse cx="8.8" cy="8.2" rx="3.2" ry="2.2" fill="#fff" opacity=".32" />
        </>
    );
}

function renderGlyph(key: string): ReactElement | null {
    if (ORBS[key]) {
        return orb(ORBS[key].color, ORBS[key].square);
    }

    if (KEYCAPS[key]) {
        return (
            <>
                <rect x="3" y="2.4" width="18" height="19.2" rx="4" fill={WHITE} />
                <rect x="3" y="2.4" width="18" height="19.2" rx="4" fill="none" stroke="#000" strokeOpacity=".2" />
                <text
                    x="12"
                    y="17"
                    textAnchor="middle"
                    fontSize="12.5"
                    fontWeight="800"
                    fontFamily="inherit"
                    fill={INK}
                >
                    {KEYCAPS[key]}
                </text>
            </>
        );
    }

    switch (key) {
        case '🪙':
            return (
                <>
                    <circle cx="12" cy="12" r="9" fill={GOLD} />
                    <circle cx="12" cy="12" r="9" fill="none" stroke={GOLD_DARK} strokeWidth="1.5" />
                    <circle cx="12" cy="12" r="6.2" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="1" />
                    <path d="M12 7.6l1.3 2.7 2.9.4-2.1 2 .5 2.9-2.6-1.5-2.6 1.5.5-2.9-2.1-2 2.9-.4z" fill={GOLD_DARK} />
                    <ellipse cx="8.6" cy="7.8" rx="2.6" ry="1.6" fill="#fff" opacity=".5" />
                </>
            );

        case '💫':
            return (
                <>
                    <circle cx="10.6" cy="13.4" r="7.4" fill={GOLD} />
                    <circle cx="10.6" cy="13.4" r="7.4" fill="none" stroke={GOLD_DARK} strokeWidth="1.3" />
                    <ellipse cx="8" cy="10.8" rx="2.4" ry="1.5" fill="#fff" opacity=".45" />
                    <path d="M17.4 2.6l.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9z" fill={LIME} />
                    <path d="M20.4 9.6l.5 1.1 1.1.5-1.1.5-.5 1.1-.5-1.1-1.1-.5 1.1-.5z" fill={LIME} opacity=".7" />
                </>
            );

        case '🎯':
            return (
                <>
                    <circle cx="11.4" cy="13.4" r="8" fill={WHITE} />
                    <circle cx="11.4" cy="13.4" r="8" fill="none" stroke="#b91c1c" strokeWidth="1.4" />
                    <circle cx="11.4" cy="13.4" r="5.4" fill="#ef4444" />
                    <circle cx="11.4" cy="13.4" r="2.6" fill={INK} />
                    <path d="M12.8 12L20 4.8" stroke={STEEL} strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M18 3.6l2.6 2.6-2.8 1-1-1z" fill={LIME} />
                </>
            );

        case '🪨':
            return (
                <>
                    <path d="M4.4 14.8l2.6-6.6 5-2 6 3.2 1.8 5.4-3.4 4H7.6z" fill="#7b8794" />
                    <path d="M7 8.2l5-2 4.4 2.4-3.2 2.4-6.2-.6z" fill="#a3b1bd" />
                    <path d="M4.4 14.8l6-.4 3.4 2.6-2.2 3.2H7.6z" fill="#5f6b76" />
                </>
            );

        case '📄':
            return (
                <>
                    <path d="M6 2.8h7.6L18.6 8v13.2H6z" fill={WHITE} />
                    <path d="M13.6 2.8L18.6 8h-5z" fill="#cbd5e1" />
                    <path d="M8.4 11h7.4M8.4 13.8h7.4M8.4 16.6h4.6" stroke="#64748b" strokeWidth="1.2" strokeLinecap="round" />
                </>
            );

        case '✂':
            return (
                <>
                    <path d="M7 4.2l9.6 12" stroke={STEEL} strokeWidth="1.9" strokeLinecap="round" />
                    <path d="M17 4.2L9.4 14.4" stroke="#cbd5e1" strokeWidth="1.9" strokeLinecap="round" />
                    <circle cx="6.4" cy="18.4" r="2.4" fill="none" stroke={LIME} strokeWidth="1.8" />
                    <circle cx="17.6" cy="18.4" r="2.4" fill="none" stroke={LIME} strokeWidth="1.8" />
                </>
            );

        case '✌':
            return (
                <>
                    <path d="M8.4 20.4c-2 0-3-1.4-2.6-3.4l.9-4.4c.2-1 1.6-1 1.8 0l.4 2 .5-7.6c0-1.1 1.7-1.1 1.8 0l.4 6.4.5-6.8c0-1.1 1.7-1.1 1.8 0l.4 7 .6-5.4c.1-1.1 1.7-1 1.8.1l.4 7.2c.2 3.1-1.6 4.9-4.6 4.9z" fill="#fcd9b6" />
                    <path d="M8.4 20.4c-2 0-3-1.4-2.6-3.4l.2-1.2 7.6 4.6z" fill="#e8b48c" opacity=".7" />
                </>
            );

        case '✋':
            return (
                <>
                    <path d="M7.6 20.6c-1.9 0-3-1.3-2.7-3.2l.8-5.2c.2-1 1.5-1 1.7 0l.3 1.6V5.2c0-1.1 1.6-1.1 1.7 0v5.6-7c0-1.1 1.6-1.1 1.7 0v7-6c0-1.1 1.6-1.1 1.7 0v6.4-4.4c0-1.1 1.6-1.1 1.7 0v7.6c0 2.9-1.7 4.2-4.6 4.2z" fill="#fcd9b6" />
                </>
            );

        case '🎲':
            return (
                <>
                    <rect x="3" y="3" width="18" height="18" rx="4.6" fill={WHITE} />
                    <rect x="3" y="3" width="18" height="18" rx="4.6" fill="none" stroke="#cbd5e1" />
                    <circle cx="8.4" cy="8.4" r="1.5" fill={INK} />
                    <circle cx="15.6" cy="8.4" r="1.5" fill={INK} />
                    <circle cx="12" cy="12" r="1.5" fill="#ef4444" />
                    <circle cx="8.4" cy="15.6" r="1.5" fill={INK} />
                    <circle cx="15.6" cy="15.6" r="1.5" fill={INK} />
                </>
            );

        case '🎁':
            return (
                <>
                    <rect x="3.4" y="9.4" width="17.2" height="11.2" rx="2.2" fill="#ef4444" />
                    <rect x="2.6" y="6.6" width="18.8" height="4" rx="1.6" fill="#f87171" />
                    <rect x="10.4" y="6.6" width="3.2" height="14" fill={GOLD} />
                    <path d="M12 6.6c-1.6-3.4-6-2.4-4.4.6.9 1.6 3.2.2 4.4-.6zm0 0c1.6-3.4 6-2.4 4.4.6-.9 1.6-3.2.2-4.4-.6z" fill={GOLD} />
                </>
            );

        case '💎':
            return (
                <>
                    <path d="M12 21.2L4.6 8.8l3.2-5.4h8.4l3.2 5.4z" fill={CYAN} />
                    <path d="M4.6 8.8h14.8L12 21.2z" fill="#22d3ee" />
                    <path d="M7.8 3.4L12 8.8 9.6 3.4z" fill="#a5f3fc" />
                    <path d="M16.2 3.4L12 8.8h2.4z" fill="#a5f3fc" />
                    <path d="M12 8.8L9.6 21.2M12 8.8l2.4 12.4" stroke="#0891b2" strokeWidth=".7" strokeOpacity=".8" />
                    <path d="M15 3.4l-3 5.4" stroke="#fff" strokeOpacity=".5" strokeWidth="1" />
                </>
            );

        case '🧰':
            return (
                <>
                    <rect x="2.8" y="8" width="18.4" height="12.4" rx="2.4" fill="#c2410c" />
                    <rect x="2.8" y="8" width="18.4" height="4" rx="2" fill="#ea580c" />
                    <path d="M9 8V6.2A1.6 1.6 0 0 1 10.6 4.6h2.8A1.6 1.6 0 0 1 15 6.2V8" fill="none" stroke="#7c2d12" strokeWidth="1.6" />
                    <rect x="10.4" y="10.2" width="3.2" height="4.4" rx="1" fill={GOLD} />
                </>
            );

        case '💵':
            return (
                <>
                    <rect x="2.4" y="6" width="19.2" height="12" rx="2.2" fill="#16a34a" />
                    <rect x="2.4" y="6" width="19.2" height="12" rx="2.2" fill="none" stroke="#065f46" strokeWidth="1.2" />
                    <circle cx="12" cy="12" r="3.4" fill="#86efac" />
                    <path d="M12 9.6v4.8M10.8 11h2.4" stroke="#065f46" strokeWidth="1" strokeLinecap="round" />
                    <circle cx="5.8" cy="12" r="1" fill="#86efac" />
                    <circle cx="18.2" cy="12" r="1" fill="#86efac" />
                </>
            );

        case '💍':
            return (
                <>
                    <circle cx="12" cy="15.6" r="5.6" fill="none" stroke={GOLD} strokeWidth="2.6" />
                    <circle cx="12" cy="15.6" r="5.6" fill="none" stroke={GOLD_DARK} strokeWidth=".8" />
                    <path d="M12 3.2l3.2 3.6-3.2 3.2-3.2-3.2z" fill={CYAN} />
                    <path d="M12 3.2l-3.2 3.6h6.4z" fill="#a5f3fc" />
                </>
            );

        case '👑':
            return (
                <>
                    <path d="M3 8.4l3.6 3.2L12 4.6l5.4 7 3.6-3.2-1.6 10.4H4.6z" fill={GOLD} />
                    <path d="M4.6 18.8h14.8v2.2H4.6z" fill={GOLD_DARK} />
                    <circle cx="12" cy="13.8" r="1.4" fill="#ef4444" />
                    <circle cx="7.4" cy="15" r="1" fill={CYAN} />
                    <circle cx="16.6" cy="15" r="1" fill={CYAN} />
                </>
            );

        case '🏆':
            return (
                <>
                    <path d="M7 3.6h10v5.2a5 5 0 0 1-10 0z" fill={GOLD} />
                    <path d="M7 4.8H4.4v1.8a3 3 0 0 0 3 3M17 4.8h2.6v1.8a3 3 0 0 1-3 3" fill="none" stroke={GOLD_DARK} strokeWidth="1.5" />
                    <path d="M10 13.4h4l.6 4.2h-5.2z" fill={GOLD_DARK} />
                    <rect x="7.4" y="17.6" width="9.2" height="2.6" rx="1.2" fill={GOLD} />
                    <path d="M9 5.6h3.2v4.2H9z" fill="#fff" opacity=".35" />
                </>
            );

        case '💣':
            return (
                <g transform="translate(1 1) scale(0.043)">
                    <path d={BOMB_PATH} fill={STEEL} />
                </g>
            );

        case '🚀':
            return (
                <>
                    <path d="M12 2.4c3 2.6 4.4 6 4.4 9.6L12 16.8l-4.4-4.8c0-3.6 1.4-7 4.4-9.6z" fill={WHITE} />
                    <path d="M12 2.4c3 2.6 4.4 6 4.4 9.6L12 16.8z" fill="#cbd5e1" />
                    <circle cx="12" cy="9" r="1.8" fill={CYAN_DARK} />
                    <path d="M7.6 12L4.6 17l3.4-1zM16.4 12l3 5-3.4-1z" fill="#ef4444" />
                    <path d="M10.2 17.4h3.6L12 22.4z" fill={GOLD} />
                </>
            );

        case '🗼':
            return (
                <>
                    <path d="M12 2.4l2.2 4.2h-4.4z" fill="#ef4444" />
                    <path d="M9.8 6.6h4.4l1.6 14.8H8.2z" fill="#cbd5e1" />
                    <path d="M10.2 10.4h3.6M9.8 14h4.4M9.2 17.6h5.6" stroke="#475569" strokeWidth="1.3" />
                    <path d="M8.2 21.4h7.6v1.6H8.2z" fill="#94a3b8" />
                </>
            );

        case '📈':
            return (
                <>
                    <rect x="2.6" y="3.4" width="18.8" height="17.2" rx="3" fill="#0f2f24" />
                    <path d="M5.6 17.6l4-5 3 2.6 5.4-7" stroke={LIME} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    <path d="M15.4 6.8h4.4v4.4" stroke={LIME} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </>
            );

        case '🎚':
            return (
                <>
                    <rect x="2.6" y="8.4" width="18.8" height="7.2" rx="3.6" fill="#1f2937" />
                    <rect x="2.6" y="8.4" width="18.8" height="7.2" rx="3.6" fill="none" stroke="#374151" />
                    <rect x="5" y="6.4" width="2.6" height="11.2" rx="1.3" fill={LIME} />
                    <rect x="10.8" y="6.4" width="2.6" height="11.2" rx="1.3" fill={GOLD} />
                    <rect x="16.4" y="6.4" width="2.6" height="11.2" rx="1.3" fill="#38bdf8" />
                </>
            );

        case '🔮':
            return (
                <>
                    <circle cx="12" cy="10.6" r="6.6" fill="#a855f7" />
                    <ellipse cx="9.6" cy="7.6" rx="2.4" ry="1.5" fill="#fff" opacity=".45" />
                    <path d="M8.6 17.4h6.8l1.4 3.4H7.2z" fill={GOLD_DARK} />
                    <path d="M18.6 3.2l.7 1.5 1.5.7-1.5.7-.7 1.5-.7-1.5-1.5-.7 1.5-.7z" fill={LIME} />
                </>
            );

        case '🏇':
            return (
                <>
                    <path d="M4 18.6h16" stroke="#e2e8f0" strokeWidth="1.4" strokeLinecap="round" strokeOpacity=".5" />
                    <path d="M13.6 5.2l2.6-.4 1.8 2-2.2 1z" fill={GOLD} />
                    <path d="M12.8 7.6l3.6 1.2 1.6 3.2-1.2 1.2-1.6-2-2.4.8-1.2 3.4 2.4.6-1.6 2.6-2.8-1.2.6-3.6-.8-1.4-1.6 3.6-2.4-.6 2.4-5.4 3-1.4 1.6-3.2 2 .4z" fill="#cbd5e1" />
                </>
            );

        case '🐔':
            return (
                <>
                    <path d="M13.4 4.2c-1.4-1.6-.2-3.2 1.2-2.4 1 .6.6 1.8 0 2.6z" fill="#ef4444" />
                    <circle cx="10.6" cy="7" r="4.2" fill={WHITE} />
                    <path d="M6.4 9.4l2 .6-1.2 1.6z" fill={GOLD} />
                    <path d="M14.6 7.4c3 0 4.4 2.2 4.4 4.6 0 3.4-2.6 5.6-6.2 5.6-3.4 0-6-1.8-6-4.6 0-2.2 1.4-3.6 3-4.6z" fill={WHITE} />
                    <path d="M12 17.6l-1 2.2 2.6-1z" fill={GOLD} />
                    <circle cx="11.8" cy="6.4" r=".9" fill={INK} />
                </>
            );

        case '🀄':
            return (
                <>
                    <rect x="3.4" y="2.8" width="17.2" height="18.4" rx="2.6" fill={WHITE} />
                    <rect x="3.4" y="2.8" width="17.2" height="18.4" rx="2.6" fill="none" stroke="#cbd5e1" />
                    <rect x="6.4" y="6" width="11.2" height="12" rx="1.6" fill="none" stroke="#dc2626" strokeWidth="1.4" />
                    <path d="M12 8v8M9 10.6h6M9.6 14.2h4.8" stroke="#dc2626" strokeWidth="1.6" strokeLinecap="round" />
                </>
            );

        case '🃏':
            return (
                <>
                    <rect x="5.4" y="2.6" width="13.2" height="18.8" rx="2.4" fill={WHITE} transform="rotate(-6 12 12)" />
                    <rect x="5.4" y="2.6" width="13.2" height="18.8" rx="2.4" fill="none" stroke="#cbd5e1" transform="rotate(-6 12 12)" />
                    <path d="M12 7.4l1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.3-2.3 1.3.5-2.5-1.8-1.7 2.5-.3z" fill="#7c3aed" transform="rotate(-6 12 12)" />
                    <circle cx="12" cy="16.6" r="1.1" fill="#7c3aed" transform="rotate(-6 12 12)" />
                </>
            );

        case '🎴':
            return (
                <>
                    <rect x="5" y="2.6" width="14" height="18.8" rx="2.4" fill="#0f172a" />
                    <rect x="5" y="2.6" width="14" height="18.8" rx="2.4" fill="none" stroke="#334155" />
                    <path d="M12 6.4l1.4 3 3.2.3-2.4 2.2.7 3.2-2.9-1.7-2.9 1.7.7-3.2-2.4-2.2 3.2-.3z" fill="#ef4444" />
                </>
            );

        case '🎟':
            return (
                <>
                    <path d="M3 7.6h18v3a1.8 1.8 0 0 0 0 3.6v3H3v-3a1.8 1.8 0 0 0 0-3.6z" fill={GOLD} />
                    <path d="M15.4 7.6v8.8" stroke={GOLD_DARK} strokeWidth="1.2" strokeDasharray="1.6 1.6" />
                    <path d="M7.4 11.2l.8 1.6 1.8.2-1.3 1.2.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.2 1.8-.2z" fill="#b45309" />
                </>
            );

        case '🔔':
            return (
                <>
                    <path d="M12 3.2a5.6 5.6 0 0 1 5.6 5.6v4l1.8 3H4.6l1.8-3V8.8A5.6 5.6 0 0 1 12 3.2z" fill={GOLD} />
                    <path d="M12 3.2a5.6 5.6 0 0 1 5.6 5.6v4l1.8 3h-7.4z" fill={GOLD_DARK} opacity=".55" />
                    <circle cx="12" cy="19.4" r="1.8" fill={GOLD_DARK} />
                </>
            );

        case '🍒':
            return (
                <>
                    <path d="M12 8.4c1.4-2.8 4-4.6 6.6-4.6" stroke="#16a34a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                    <path d="M12 8.4C9.8 6.2 8 4.4 6.6 3.2" stroke="#16a34a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                    <circle cx="8.2" cy="15.6" r="4.4" fill="#dc2626" />
                    <circle cx="15.8" cy="16.4" r="4.2" fill="#ef4444" />
                    <circle cx="6.8" cy="13.8" r="1.3" fill="#fff" opacity=".4" />
                    <circle cx="14.6" cy="14.8" r="1.2" fill="#fff" opacity=".4" />
                </>
            );

        case '🍋':
            return (
                <>
                    <ellipse cx="12" cy="13.4" rx="8.4" ry="6.4" fill={GOLD} transform="rotate(-18 12 13.4)" />
                    <ellipse cx="12" cy="13.4" rx="8.4" ry="6.4" fill="none" stroke={GOLD_DARK} strokeWidth="1.1" transform="rotate(-18 12 13.4)" />
                    <ellipse cx="9" cy="10.6" rx="2.6" ry="1.4" fill="#fff" opacity=".38" transform="rotate(-18 9 10.6)" />
                    <path d="M17.4 7.4c1.4-.8 2.6.4 2.4 1.8-.2 1.2-1.6 1.8-2.8 1.2z" fill="#16a34a" />
                </>
            );

        case '☀':
            return (
                <>
                    <circle cx="12" cy="12" r="5.6" fill={GOLD} />
                    <path
                        d="M12 1.6v2.6M12 19.8v2.6M1.6 12h2.6M19.8 12h2.6M4.6 4.6l1.9 1.9M17.5 17.5l1.9 1.9M19.4 4.6l-1.9 1.9M6.5 17.5l-1.9 1.9"
                        stroke={GOLD}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                    />
                </>
            );

        case '🌙':
            return (
                <>
                    <path d="M15.6 3.2a9 9 0 1 0 5.2 15.4A9.4 9.4 0 0 1 15.6 3.2z" fill="#e2e8f0" />
                    <circle cx="17.4" cy="16.4" r="1.2" fill="#cbd5e1" />
                    <circle cx="13.2" cy="19.2" r=".8" fill="#cbd5e1" />
                    <path d="M19.4 5.4l.6 1.3 1.3.6-1.3.6-.6 1.3-.6-1.3-1.3-.6 1.3-.6z" fill={LIME} />
                </>
            );

        case '⭐':
            return (
                <path d="M12 2.6l2.9 6 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5L2.6 9.5l6.5-.9z" fill={GOLD} stroke={GOLD_DARK} strokeWidth=".9" />
            );

        case '⬆':
            return (
                <>
                    <circle cx="12" cy="12" r="9" fill="#0f2f24" />
                    <circle cx="12" cy="12" r="9" fill="none" stroke={LIME} strokeWidth="1.4" />
                    <path d="M12 7l4 4.6h-2.6v4.8h-2.8v-4.8H8z" fill={LIME} />
                </>
            );

        case '⬇':
            return (
                <>
                    <circle cx="12" cy="12" r="9" fill="#2a1020" />
                    <circle cx="12" cy="12" r="9" fill="none" stroke="#f472b6" strokeWidth="1.4" />
                    <path d="M12 17l-4-4.6h2.6V7.6h2.8v4.8H16z" fill="#f472b6" />
                </>
            );

        case '🔻':
            return (
                <>
                    <circle cx="12" cy="12" r="9" fill="#2a1020" />
                    <circle cx="12" cy="12" r="9" fill="none" stroke="#f87171" strokeWidth="1.2" />
                    <path d="M12 16.4L6.8 9.2h10.4z" fill="#f87171" />
                </>
            );

        case '🔢':
            return (
                <>
                    <rect x="3" y="3" width="8" height="8" rx="2" fill="#334155" />
                    <rect x="13" y="3" width="8" height="8" rx="2" fill="#334155" />
                    <rect x="3" y="13" width="8" height="8" rx="2" fill="#334155" />
                    <rect x="13" y="13" width="8" height="8" rx="2" fill="#334155" />
                    <text x="7" y="9" textAnchor="middle" fontSize="6.4" fontWeight="800" fontFamily="inherit" fill={LIME}>1</text>
                    <text x="17" y="9" textAnchor="middle" fontSize="6.4" fontWeight="800" fontFamily="inherit" fill={LIME}>2</text>
                    <text x="7" y="19" textAnchor="middle" fontSize="6.4" fontWeight="800" fontFamily="inherit" fill={LIME}>3</text>
                    <text x="17" y="19" textAnchor="middle" fontSize="6.4" fontWeight="800" fontFamily="inherit" fill={LIME}>4</text>
                </>
            );

        case '💥':
            return (
                <path d="M12 1.8l2.2 4.4 4.4-1.6-1 4.6 4.6 1.4-3.6 3.2 2.6 4-4.6.4-.4 4.6-3.4-3-3.4 3-.4-4.6-4.6-.4 2.6-4L3.4 10.6l4.6-1.4-1-4.6 4.4 1.6z" fill="#fb923c" stroke="#c2410c" strokeWidth=".8" />
            );

        case '🎡':
            return (
                <>
                    <circle cx="12" cy="8.4" r="6.2" fill="none" stroke={GOLD} strokeWidth="1.6" />
                    <path d="M12 2.2v12.4M5.8 8.4h12.4M7.6 4l8.8 8.8M16.4 4L7.6 12.8" stroke={GOLD} strokeWidth="1" strokeOpacity=".8" />
                    <circle cx="12" cy="8.4" r="1.6" fill="#ef4444" />
                    <circle cx="12" cy="2.2" r="1.2" fill={CYAN} />
                    <circle cx="18.2" cy="8.4" r="1.2" fill={LIME} />
                    <circle cx="5.8" cy="8.4" r="1.2" fill="#a855f7" />
                    <path d="M12 15v5.6M8.6 21.4h6.8" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" />
                </>
            );

        case '❔':
            return (
                <>
                    <rect x="3" y="3" width="18" height="18" rx="5" fill="#1e293b" />
                    <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="#475569" />
                    <text x="12" y="16.6" textAnchor="middle" fontSize="12" fontWeight="800" fontFamily="inherit" fill={LIME}>
                        ?
                    </text>
                </>
            );

        default:
            return null;
    }
}

type Props = {
    /** The config emoji this icon replaces. */
    glyph?: string | null;
    size?: number;
    className?: string;
};

/** Draw a game glyph as the site's own SVG icon. */
export function GameIcon({ glyph, size = 24, className }: Props) {
    const key = (glyph ?? '').replace(/\uFE0F/g, '');
    const shape = key ? renderGlyph(key) : null;

    if (!shape) {
        return (
            <span
                className={cn('inline-block leading-none', className)}
                style={{ fontSize: Math.round(size * 0.92) }}
            >
                {glyph}
            </span>
        );
    }

    return (
        <svg
            viewBox="0 0 24 24"
            width={size}
            height={size}
            aria-hidden
            className={cn('inline-block shrink-0 align-middle', className)}
        >
            {shape}
        </svg>
    );
}

/** True when the glyph has a drawn icon rather than the emoji fallback. */
export function hasIcon(glyph?: string | null): boolean {
    return renderGlyph((glyph ?? '').replace(/\uFE0F/g, '')) !== null;
}
