import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowDown, Loader2, MessageSquare, Radio, Send, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/casino/language-provider';
import { cn } from '@/lib/utils';

type Line = {
    id: number;
    player: string;
    message: string;
    source: 'game' | 'site';
    mine: boolean;
    hue: number;
    at: string;
};

type Bridge = {
    state: 'online' | 'connecting' | 'offline';
    host: string | null;
    version: string | null;
    players: number | null;
    detail: string | null;
};

type Props = {
    messages: Line[];
    bridge: Bridge;
    server: { name: string; host: string; configured: boolean };
};

const MAX_LENGTH = 200;

export default function Chat({ messages: initial, bridge: initialBridge, server }: Props) {
    const { t } = useI18n();
    const { auth } = usePage().props;
    const [lines, setLines] = useState<Line[]>(initial);
    const [bridge, setBridge] = useState<Bridge>(initialBridge);
    const [pinned, setPinned] = useState(true);
    const [unseen, setUnseen] = useState(0);
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const lastId = useRef<number>(initial.at(-1)?.id ?? 0);

    useEffect(() => {
        let stop = false;

        const poll = async () => {
            try {
                const res = await fetch(`/chat/messages?after=${lastId.current}`, {
                    headers: { Accept: 'application/json' },
                });
                if (!res.ok) return;
                const data = (await res.json()) as { messages: Line[]; bridge: Bridge };
                if (stop) return;
                setBridge(data.bridge);
                if (data.messages.length === 0) return;

                lastId.current = data.messages[data.messages.length - 1].id;
                setLines((prev) => [...prev, ...data.messages].slice(-300));
                setUnseen((n) => (pinned ? 0 : n + data.messages.length));
            } catch {
                // A dropped poll is not worth surfacing; the next one retries.
            }
        };

        const timer = setInterval(() => {
            if (document.visibilityState === 'visible') void poll();
        }, 4000);

        return () => {
            stop = true;
            clearInterval(timer);
        };
    }, [pinned]);

    // Stay glued to the newest line unless the reader scrolled up.
    useEffect(() => {
        if (!pinned) return;
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [lines, pinned]);

    const onScroll = () => {
        const el = listRef.current;
        if (!el) return;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        setPinned(atBottom);
        if (atBottom) setUnseen(0);
    };

    const jump = () => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
        setPinned(true);
        setUnseen(0);
    };

    const send = async () => {
        const text = draft.trim();
        if (text === '' || sending) return;

        setSending(true);
        setError(null);

        try {
            const res = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': readCookie('XSRF-TOKEN') ?? '',
                },
                body: JSON.stringify({ message: text }),
            });

            if (res.status === 429) {
                setError(t('chat.slowDown'));
                return;
            }

            if (!res.ok) {
                setError(t('chat.failed'));
                return;
            }

            const data = (await res.json()) as { message: Line };
            setDraft('');
            setError(null);
            setLines((prev) => (prev.some((l) => l.id === data.message.id) ? prev : [...prev, data.message]));
            lastId.current = Math.max(lastId.current, data.message.id);
            setPinned(true);
            inputRef.current?.focus();
        } catch {
            setError(t('chat.failed'));
        } finally {
            setSending(false);
        }
    };

    const online = bridge.state === 'online';
    const remaining = MAX_LENGTH - draft.length;

    return (
        <>
            <Head title={t('chat.title')} />

            <div className="mb-4 flex flex-wrap items-center gap-3">
                <h1 className="flex items-center gap-2 text-lg font-semibold">
                    <MessageSquare className="size-5 text-lime" /> {t('chat.title')}
                </h1>
                {bridge.players !== null && online && (
                    <span className="flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-xs font-semibold text-dim">
                        <Users className="size-3.5" /> {t('chat.players', { count: String(bridge.players) })}
                    </span>
                )}
                <span
                    className={cn(
                        'ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold',
                        online ? 'bg-lime/15 text-lime' : 'bg-white/5 text-dim',
                    )}
                >
                    <Radio className={cn('size-3.5', online && 'animate-pulse')} />
                    {bridge.state === 'online'
                        ? t('chat.online')
                        : bridge.state === 'connecting'
                          ? t('chat.connecting')
                          : t('chat.offline')}
                </span>
            </div>

            <div className="overflow-hidden rounded-2xl bg-[#0b0d11] ring-1 ring-line/60">
                <div className="flex items-center justify-between gap-3 border-b border-line/60 px-4 py-2.5">
                    <span className="truncate text-[11px] font-bold tracking-wider text-dim uppercase">
                        {server.name} · {server.host}
                    </span>
                    <span className="hidden text-[11px] text-dim sm:block">{t('chat.subtitle')}</span>
                </div>

                <div
                    ref={listRef}
                    onScroll={onScroll}
                    className="scrollbar-thin relative h-[min(56svh,540px)] overflow-y-auto px-2 py-2 sm:px-3"
                >
                    {lines.length === 0 ? (
                        <div className="grid h-full place-items-center px-6 text-center">
                            <div>
                                <MessageSquare className="mx-auto mb-3 size-8 text-dim" />
                                <p className="text-sm text-dim">{t('chat.empty')}</p>
                                {!server.configured && (
                                    <p className="mx-auto mt-3 max-w-md text-xs text-amber-200/80">
                                        {t('chat.bridgeMissing')}
                                    </p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <ul className="flex flex-col gap-0.5">
                            {lines.map((line) => (
                                <li
                                    key={line.id}
                                    className={cn(
                                        'flex items-start gap-2.5 rounded-lg px-2 py-1.5',
                                        line.mine ? 'bg-lime/[0.05]' : 'hover:bg-white/[0.03]',
                                    )}
                                >
                                    <span
                                        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md text-[11px] font-extrabold text-black/80"
                                        style={{ background: `hsl(${line.hue} 70% 62%)` }}
                                        aria-hidden
                                    >
                                        {line.player.slice(0, 1).toUpperCase()}
                                    </span>
                                    <span className="text-[11px] leading-6 text-dim tabular-nums">
                                        {new Date(line.at).toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </span>
                                    <p className="min-w-0 flex-1 text-sm leading-6 break-words">
                                        <span className={cn('font-bold', line.source === 'site' ? 'text-sky' : 'text-lime')}>
                                            {line.player}
                                        </span>{' '}
                                        <span className="text-white/90">{line.message}</span>
                                    </p>
                                    {line.source === 'site' && (
                                        <span className="mt-1 hidden rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-dim uppercase sm:block">
                                            site
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {!pinned && (
                    <div className="relative">
                        <button
                            type="button"
                            onClick={jump}
                            className="absolute -top-12 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-lime px-3 py-1.5 text-xs font-bold text-lime-ink shadow-lg"
                        >
                            <ArrowDown className="size-3.5" />
                            {unseen > 0 ? t('chat.newMessages', { count: String(unseen) }) : t('chat.scrollDown')}
                        </button>
                    </div>
                )}

                {auth.user ? (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            void send();
                        }}
                        className="border-t border-line/60 p-2.5 sm:p-3"
                    >
                        <div className="flex items-center gap-2">
                            <span className="hidden size-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#ffb36b] to-[#e8335e] text-[11px] font-extrabold sm:flex">
                                {auth.user.name.slice(0, 1).toUpperCase()}
                            </span>
                            <input
                                ref={inputRef}
                                value={draft}
                                onChange={(e) => setDraft(e.target.value.slice(0, MAX_LENGTH))}
                                placeholder={t('chat.placeholder')}
                                maxLength={MAX_LENGTH}
                                className="min-w-0 flex-1 rounded-xl bg-surface-2 px-3 py-2.5 text-sm text-white outline-none ring-1 ring-line placeholder:text-dim focus:ring-lime/50"
                                aria-label={t('chat.placeholder')}
                            />
                            <span
                                className={cn(
                                    'hidden text-[11px] tabular-nums sm:block',
                                    remaining <= 20 ? 'text-amber-300' : 'text-dim',
                                )}
                            >
                                {remaining}
                            </span>
                            <button
                                type="submit"
                                disabled={sending || draft.trim() === ''}
                                className="flex size-10 items-center justify-center rounded-xl bg-lime text-lime-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label={t('chat.send')}
                            >
                                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                            </button>
                        </div>
                        {error && <p className="mt-1.5 px-1 text-xs text-rose-300">{error}</p>}
                    </form>
                ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 px-3 py-3">
                        <span className="text-xs text-dim">{t('chat.loginToChat')}</span>
                        <div className="flex items-center gap-2">
                            <Link
                                href="/login"
                                className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-semibold text-white hover:bg-line"
                            >
                                Log in
                            </Link>
                            <Link
                                href="/register"
                                className="rounded-lg bg-lime px-3 py-1.5 text-xs font-bold text-lime-ink"
                            >
                                Registration
                            </Link>
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between gap-2 border-t border-line/60 px-4 py-2.5 text-[11px] text-dim">
                    <span>
                        {bridge.detail ?? (online ? 'bridge healthy' : 'waiting for the bridge')}
                        {bridge.version ? ` · MC ${bridge.version}` : ''}
                    </span>
                    <span>{lines.length} shown</span>
                </div>
            </div>
        </>
    );
}

/** Laravel sets the XSRF-TOKEN cookie; fetch has to echo it back as a header. */
function readCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}
