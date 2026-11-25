import { Link, router, usePage } from '@inertiajs/react';
import { ArrowDownToLine, ArrowUpFromLine, Check, ChevronDown, Crown, FileText, Flag, Gift, Globe, History, LogOut, MessageSquare, Search, Settings, Ticket, Timer, Wallet, X } from 'lucide-react';
import { CoinIcon, DISCORD_URL, DiscordIcon, Logo } from '@/components/casino/art';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatCoins } from '@/lib/casino';
import { LOCALES } from '@/lib/i18n';
import { useI18n } from '@/components/casino/language-provider';
import { useEffect, useState } from 'react';
import { IconBadge } from '@/components/casino/icon-badge';
import { GAME_FILTERS } from '@/lib/casino';
import { cn } from '@/lib/utils';

export function CasinoSidebar({ open, onNavigate }: { open: boolean | null; onNavigate?: () => void }) {
    const page = usePage();
    const { t, tOr } = useI18n();
    const url = new URL(page.url, 'http://x');
    const current = url.pathname === '/games' ? (url.searchParams.get('filter') ?? 'all') : null;
    const counts = (page.props as { gameFilters?: Record<string, number> }).gameFilters;
    // Only offer categories that actually have games; a link to an empty lobby is a dead end.
    const filters = counts ? GAME_FILTERS.filter((f) => (counts[f.key] ?? 0) > 0) : GAME_FILTERS;
    const [q, setQ] = useState('');

    return (
        <aside
            className={cn(
                'scrollbar-thin flex w-[min(320px,86vw)] shrink-0 flex-col gap-4 overflow-y-auto border-r border-line/60 bg-panel p-3 lg:w-[264px]',
                'fixed inset-y-0 left-0 z-[60] shadow-2xl shadow-black/60 transition-transform duration-300 ease-out lg:sticky lg:top-16 lg:z-auto lg:h-[calc(100svh-4rem)] lg:shadow-none',
                open === null
                    ? '-translate-x-full lg:translate-x-0' // default: hidden on mobile, visible on desktop
                    : open
                      ? 'translate-x-0'
                      : '-translate-x-full lg:hidden',
            )}
        >
            <MobileDrawerHeader onClose={onNavigate} />

            <div className="grid grid-cols-2 gap-1.5">
                <QuickTile href="/vip" label={t('common.vipClub')} icon={Crown} className="from-[#ffaf45] to-[#f2630c]" tone="amber" />
                <QuickTile href="/lottery" label={t('common.lottery')} icon={Ticket} className="from-[#7ee23d] to-[#2f9e12]" tone="lime" />
            </div>

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    onNavigate?.();
                    router.get('/games', q ? { q } : {});
                }}
                className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-sm"
            >
                <Search className="size-4 text-dim" />
                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={t('sidebar.searchPlaceholder')}
                    className="w-full bg-transparent text-white outline-none placeholder:text-dim"
                />
            </form>

            <nav className="flex flex-col gap-0.5">
                {filters.map((f) => (
                    <Link
                        key={f.key}
                        href={f.key === 'all' ? '/games' : `/games?filter=${f.key}`}
                        onClick={onNavigate}
                        className={cn(
                            'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/90 transition hover:bg-surface-2',
                            current === f.key && 'bg-surface-2 text-white',
                        )}
                    >
                        <f.icon
                            className={cn(
                                'size-4.5 text-dim transition group-hover:text-lime',
                                current === f.key && 'text-lime',
                            )}
                        />
                        {tOr(`filter.${f.key}`, f.label)}
                        {f.badge && (
                            <span className="ml-auto rounded-full bg-sky px-1.5 py-px text-[9px] font-bold text-white">
                                {f.badge}
                            </span>
                        )}
                    </Link>
                                    ))}

                    <Link
                        href="/chat"
                        onClick={onNavigate}
                        className={cn(
                            'group mt-1 flex items-center gap-3 rounded-lg border-t border-line/60 px-3 pt-3 pb-2.5 text-sm font-medium text-white/90 transition hover:bg-surface-2',
                            current === null && url.pathname === '/chat' && 'bg-surface-2 text-white',
                        )}
                    >
                        <MessageSquare
                            className={cn(
                                'size-4.5 text-dim transition group-hover:text-lime',
                                url.pathname === '/chat' && 'text-lime',
                            )}
                        />
                        {t('nav.chat')}
                        <span className="ml-auto size-2 rounded-full bg-lime/70" />
                    </Link>
                    <Link
                        href="/deposit"
                        onClick={onNavigate}
                        className={cn(
                            'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/90 transition hover:bg-surface-2',
                            url.pathname === '/deposit' && 'bg-surface-2 text-white',
                        )}
                    >
                        <ArrowDownToLine
                            className={cn(
                                'size-4.5 text-dim transition group-hover:text-lime',
                                url.pathname === '/deposit' && 'text-lime',
                            )}
                        />
                        {t('nav.deposit')}
                    </Link>
                    <Link
                        href="/withdraw"
                        onClick={onNavigate}
                        className={cn(
                            'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/90 transition hover:bg-surface-2',
                            url.pathname === '/withdraw' && 'bg-surface-2 text-white',
                        )}
                    >
                        <ArrowUpFromLine
                            className={cn(
                                'size-4.5 text-dim transition group-hover:text-lime',
                                url.pathname === '/withdraw' && 'text-lime',
                            )}
                        />
                        {t('nav.withdraw')}
                    </Link>
            </nav>

            <MobileAccountLinks onNavigate={onNavigate} />

            <div className="mt-auto flex flex-col gap-3 pb-[env(safe-area-inset-bottom)]">
                <WagerRace />
                <div className="flex items-center justify-between">
                    <LanguageMenu />
                    <a
                        href={DISCORD_URL}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="flex size-9 items-center justify-center rounded-lg bg-surface-2 text-dim hover:text-white"
                        aria-label="Discord"
                    >
                        <DiscordIcon className="size-4" />
                    </a>
                </div>
            </div>
        </aside>
    );
}

function QuickTile({
    href,
    label,
    icon,
    className,
    tone,
}: {
    href: string;
    label: string;
    icon: typeof Gift;
    className: string;
    tone: 'sky' | 'amber' | 'lime';
}) {
    return (
        <Link
            href={href}
            className={cn(
                'relative flex h-[92px] flex-col justify-between overflow-hidden rounded-xl bg-gradient-to-b p-2 transition hover:-translate-y-0.5',
                className,
            )}
        >
            <span className="truncate text-[10.5px] leading-tight font-bold tracking-tight text-white">{label}</span>
            <IconBadge icon={icon} tone={tone} className="size-11 self-center rounded-xl" iconClassName="size-6" />
        </Link>
    );
}

/** Language switcher: the choice is stored in the browser and applies instantly. */
function LanguageMenu() {
    const { locale, setLocale, t } = useI18n();
    const current = LOCALES.find((option) => option.id === locale) ?? LOCALES[0];

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm text-white outline-none hover:bg-line">
                <Globe className="size-4 text-dim" /> {current.short}
                <ChevronDown className="size-3.5 text-dim" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52 border-line bg-surface">
                <DropdownMenuLabel className="text-xs text-dim">{t('common.language')}</DropdownMenuLabel>
                {LOCALES.map((option) => (
                    <DropdownMenuItem
                        key={option.id}
                        className="cursor-pointer"
                        onSelect={() => setLocale(option.id)}
                    >
                        <span className="mr-2 text-base leading-none">{option.flag}</span>
                        <span className="flex-1">{option.label}</span>
                        {option.id === locale && <Check className="ml-2 size-4 text-lime" />}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** Countdown to the end of the current week (UTC) — placeholder until races exist. */
function WagerRace() {
    const { t } = useI18n();
    const [left, setLeft] = useState('--:--:--:--');
    useEffect(() => {
        setLeft(untilWeekEnd());
        const t = setInterval(() => setLeft(untilWeekEnd()), 1000);
        return () => clearInterval(t);
    }, []);

    return (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#2a4f86] to-[#1b2d52] p-3.5">
            <Flag className="absolute -right-2 -bottom-3 size-20 rotate-12 text-white/15" />
            <div className="text-[15px] font-semibold text-white">{t('sidebar.weeklyRace')}</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-white/70 tabular-nums">
                <Timer className="size-3.5" /> {left}
            </div>
            <span className="mt-2 inline-block rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
                {t('common.comingSoon')}
            </span>
        </div>
    );
}

function untilWeekEnd(): string {
    const now = new Date();
    const end = new Date(now);
    end.setUTCDate(now.getUTCDate() + ((7 - now.getUTCDay()) % 7 || 7));
    end.setUTCHours(0, 0, 0, 0);
    const s = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(Math.floor(s / 86400))}:${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** Phone-only drawer header: logo, close button and the player card. */
function MobileDrawerHeader({ onClose }: { onClose?: () => void }) {
    const { auth, wallet } = usePage().props;
    const { t } = useI18n();
    const user = auth.user;

    return (
        <div className="flex flex-col gap-3 lg:hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="flex items-center justify-between">
                <Link href="/" onClick={onClose}>
                    <Logo />
                </Link>
                <button type="button" onClick={onClose} aria-label={t('common.close')} className="flex size-9 items-center justify-center rounded-xl bg-surface-2 text-dim">
                    <X className="size-5" />
                </button>
            </div>
            {user ? (
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1b3b78] to-[#2f86ff] p-4">
                    <div className="bg-suits absolute inset-0 opacity-60" />
                    <div className="relative flex items-center gap-3">
                        <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#ffb36b] to-[#e8335e] text-lg font-extrabold">
                            {user.name.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                            <div className="truncate font-bold">{user.name}</div>
                            {wallet?.vip_level && (
                                <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: wallet.vip_level.color }}>
                                    <Crown className="size-3.5" /> {wallet.vip_level.name} VIP
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="relative mt-3 flex items-center justify-between rounded-xl bg-black/25 px-3 py-2 backdrop-blur">
                        <span className="flex items-center gap-2 font-bold tabular-nums">
                            <CoinIcon className="size-5" /> {formatCoins(wallet?.balance ?? 0)}
                        </span>
                        <Link href="/topup" onClick={onClose} className="rounded-lg bg-lime px-3 py-1.5 text-xs font-bold text-lime-ink">
                            {t('common.topUp')}
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-2">
                    <Link href="/login" onClick={onClose} className="rounded-xl bg-surface-2 py-2.5 text-center text-sm font-semibold">
                        {t('common.logIn')}
                    </Link>
                    <Link href="/register" onClick={onClose} className="rounded-xl bg-lime py-2.5 text-center text-sm font-bold text-lime-ink">
                        {t('common.registration')}
                    </Link>
                </div>
            )}
        </div>
    );
}

/** Phone-only account links (desktop has them in the avatar menu). */
function MobileAccountLinks({ onNavigate }: { onNavigate?: () => void }) {
    const { auth } = usePage().props;
    const { t } = useI18n();
    const links: [string, string, typeof Gift][] = auth.user
        ? [
              ['/topup', t('common.topUp'), Wallet],
              ['/settings/wallet', t('common.walletHistory'), History],
              ['/settings/profile', t('common.settings'), Settings],
              ['/legal/faq', t('common.legal'), FileText],
          ]
        : [['/legal/faq', t('common.legal'), FileText]];

    return (
        <div className="flex flex-col gap-0.5 border-t border-line/60 pt-3 lg:hidden">
            {links.map(([href, label, Icon]) => (
                <Link key={href} href={href} onClick={onNavigate} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/90 hover:bg-surface-2">
                    <Icon className="size-4.5 text-dim" /> {label}
                </Link>
            ))}
            {auth.user && (
                <Link
                    href="/logout"
                    method="post"
                    as="button"
                    onClick={() => {
                        onNavigate?.();
                        router.flushAll();
                    }}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-300 hover:bg-surface-2"
                >
                    <LogOut className="size-4.5" /> {t('common.logOut')}
                </Link>
            )}
        </div>
    );
}
