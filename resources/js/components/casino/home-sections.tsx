import { Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    Crown,
    Dices,
    Gift,
    MessageCircle,
    Sparkles,
    Ticket,
    Timer,
    Trophy,
} from 'lucide-react';
import { CoinIcon, DISCORD_URL, DiscordIcon, HeroArt } from '@/components/casino/art';
import { IconBadge } from '@/components/casino/icon-badge';
import type { Tone } from '@/components/casino/icon-badge';
import { useI18n } from '@/components/casino/language-provider';
import { formatCoinsShort } from '@/lib/casino';
import type { TranslationKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { BigWin } from '@/types';

export function BigWins({ wins }: { wins: BigWin[] }) {
    const { t, gameName } = useI18n();

    if (wins.length === 0) return null;

    return (
        <section className="mb-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <Crown className="size-4 text-lime" /> {t('home.bigWins')}
            </div>
            <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1">
                {wins.map((w) => (
                    <Link
                        key={w.round_id}
                        href={`/play/${w.game_id}`}
                        className="flex shrink-0 items-center gap-2 rounded-xl bg-surface p-1.5 pr-3 ring-1 ring-line/60 hover:ring-lime/50"
                    >
                        <span
                            className="flex size-10 items-center justify-center overflow-hidden rounded-lg bg-surface-2"
                            style={w.background ? { background: `linear-gradient(135deg, ${w.background[0]}, ${w.background[1]})` } : undefined}
                        >
                            {w.thumbnail ? (
                                <img src={w.thumbnail} alt="" className="size-full object-cover" />
                            ) : w.icon ? (
                                <img src={w.icon} alt="" className="size-7" />
                            ) : null}
                        </span>
                        <span className="leading-tight">
                            <span className="block max-w-28 truncate text-xs text-dim">
                                {w.player} · {gameName({ id: w.game_id, name: w.game_name })}
                            </span>
                            <span className="flex items-center gap-1 text-sm font-semibold text-white tabular-nums">
                                <CoinIcon className="size-3.5" /> {formatCoinsShort(w.win)}
                            </span>
                        </span>
                    </Link>
                ))}
            </div>
        </section>
    );
}

export function Hero() {
    const { auth } = usePage().props;
    const { t } = useI18n();
    const loggedIn = Boolean(auth.user);

    return (
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#161c28] via-[#1b3b78] to-[#2f86ff] ring-1 ring-line/60">
            <div className="bg-suits absolute inset-0 opacity-70" />
            <HeroArt className="pointer-events-none absolute -right-6 bottom-0 hidden h-[104%] md:block lg:right-4" />
            <div className="relative max-w-xl p-6 md:p-9">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
                    <Dices className="size-3.5 text-lime" /> {t('home.welcome')}
                </span>
                {loggedIn ? (
                    <>
                        <h1 className="mt-4 text-3xl leading-[1.05] font-extrabold tracking-tight text-white md:text-[40px]">
                            {t('home.discordHeroTitle')}
                        </h1>
                        <p className="mt-3 text-sm text-white/75">{t('home.discordText')}</p>
                        <div className="mt-6 flex gap-2">
                            <a
                                href={DISCORD_URL}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="inline-flex items-center gap-2 rounded-xl bg-lime px-5 py-3 text-sm font-bold text-lime-ink shadow-[0_8px_30px_-8px_rgba(201,247,58,.8)] transition hover:brightness-110"
                            >
                                <DiscordIcon className="size-4" /> {t('home.joinDiscord')}
                            </a>
                            <Link
                                href="/games"
                                className="rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
                            >
                                {t('home.browseGames')}
                            </Link>
                        </div>
                    </>
                ) : (
                    <>
                        <h1 className="mt-4 text-3xl leading-[1.05] font-extrabold tracking-tight text-white md:text-[40px]">
                            {t('home.discordHeroTitle')}
                        </h1>
                        <p className="mt-3 text-sm text-white/75">{t('home.discordText')}</p>
                        <div className="mt-6 flex flex-wrap gap-2">
                            <a
                                href={DISCORD_URL}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="inline-flex items-center gap-2 rounded-xl bg-lime px-5 py-3 text-sm font-bold text-lime-ink shadow-[0_8px_30px_-8px_rgba(201,247,58,.8)] transition hover:brightness-110"
                            >
                                <DiscordIcon className="size-4" /> {t('home.joinDiscord')}
                            </a>
                            <Link
                                href="/register"
                                className="rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
                            >
                                {t('common.registration')}
                            </Link>
                            <Link
                                href="/login"
                                className="rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
                            >
                                {t('common.logIn')}
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </section>
    );
}

const TILES: { key: TranslationKey; href: string; icon: typeof Dices; tone: Tone; bg: string }[] = [
    { key: 'common.vipClub', href: '/vip', icon: Crown, tone: 'amber', bg: 'from-[#4a2a10] to-[#1b2029]' },
    { key: 'common.lottery', href: '/lottery', icon: Ticket, tone: 'lime', bg: 'from-[#22401a] to-[#1b2029]' },
    { key: 'common.topRtp', href: '/games?filter=top', icon: Trophy, tone: 'rose', bg: 'from-[#4a1a2a] to-[#1b2029]' },
];

export function CategoryTiles() {
    const { auth } = usePage().props;
    const { t } = useI18n();

    return (
        <section className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Link
                href={auth.user ? '/games' : '/register'}
                className="relative col-span-2 flex min-h-[104px] items-center overflow-hidden rounded-2xl bg-gradient-to-r from-[#1b2029] to-[#173f8a] p-4 ring-1 ring-line/60 transition hover:ring-sky/60"
            >
                <div className="relative z-10">
                    <div className="text-[17px] font-semibold text-white">{t('common.casino')}</div>
                    <div className="mt-0.5 text-xs text-white/70">{t('home.casinoTileSub')}</div>
                    <span className="mt-2 inline-block rounded-md bg-sky px-2.5 py-1 text-xs font-semibold text-white">
                        {auth.user ? t('home.playNow') : t('common.registration')}
                    </span>
                </div>
                <IconBadge icon={Dices} tone="sky" className="absolute right-5 size-16 rotate-6 rounded-3xl" iconClassName="size-9" />
            </Link>
            {TILES.map((tile) => (
                <Link
                    key={tile.key}
                    href={tile.href}
                    className={cn(
                        'relative flex min-h-[104px] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br p-4 ring-1 ring-line/60 transition hover:ring-lime/50',
                        tile.bg,
                    )}
                >
                    <div className="text-[15px] font-semibold text-white">{t(tile.key)}</div>
                    <span className="flex size-6 items-center justify-center rounded-full bg-white/10">
                        <ArrowRight className="size-3.5 text-white" />
                    </span>
                    <IconBadge icon={tile.icon} tone={tile.tone} className="absolute right-3 bottom-3 size-12 -rotate-6" iconClassName="size-6" />
                </Link>
            ))}
        </section>
    );
}

export function Promotions() {
    const { t } = useI18n();

    const cards: {
        title: string;
        text: string;
        icon: typeof Gift;
        tone: Tone;
        bg: string;
        soon?: boolean;
        href?: string;
        external?: boolean;
        tag?: string;
        timer?: boolean;
        onClick?: () => void;
        action: string;
        disabled?: boolean;
    }[] = [
        {
            title: t('home.discordTitle'),
            text: t('home.discordText'),
            icon: MessageCircle,
            tone: 'sky',
            bg: 'from-[#3949ab] via-[#2b2f6b] to-[#1b2029]',
            href: DISCORD_URL,
            external: true,
            tag: t('home.community'),
            timer: false,
            action: t('home.joinDiscord'),
        },
        {
            title: t('home.weeklyBattle'),
            text: t('home.weeklyBattleText'),
            icon: Trophy,
            tone: 'violet',
            bg: 'from-[#3b1a66] via-[#241d38] to-[#1b2029]',
            soon: true,
            action: t('home.stayTuned'),
        },
        {
            title: t('common.vipClub'),
            text: t('home.vipText'),
            icon: Crown,
            tone: 'rose',
            bg: 'from-[#661a33] via-[#2e1d26] to-[#1b2029]',
            href: '/vip',
            action: t('home.openVip'),
        },
        {
            title: t('common.lottery'),
            text: t('home.lotteryText'),
            icon: Ticket,
            tone: 'lime',
            bg: 'from-[#2c5a0a] via-[#202a16] to-[#1b2029]',
            href: '/lottery',
            action: t('home.buyTicket'),
        },
    ];

    return (
        <section className="mt-8">
            <div id="promotions" className="mb-3 flex scroll-mt-24 items-center gap-2">
                <Gift className="size-4.5 text-lime" />
                <h2 className="text-[15px] font-semibold text-white">{t('home.promotions')}</h2>
            </div>
            <div className="scrollbar-none -mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-4">
                {cards.map((card) => (
                    <div
                        key={card.title}
                        className={cn(
                            'relative flex min-h-[200px] w-[80vw] shrink-0 snap-start scroll-mt-24 flex-col overflow-hidden rounded-2xl bg-gradient-to-br p-4 ring-1 ring-line/60 sm:w-auto',
                            card.bg,
                        )}
                    >
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-white/70">
                            <span className="rounded bg-black/30 px-1.5 py-0.5">
                                {card.soon ? t('home.comingSoon') : (card.tag ?? t('home.active'))}
                            </span>
                            {!card.soon && card.timer !== false && (
                                <span className="flex items-center gap-1">
                                    <Timer className="size-3" /> 24h
                                </span>
                            )}
                        </div>
                        <div className="mt-3 max-w-[70%] text-lg leading-tight font-semibold text-white">{card.title}</div>
                        <p className="mt-1 max-w-[65%] text-xs text-white/70">{card.text}</p>
                        <IconBadge icon={card.icon} tone={card.tone} className="absolute -right-2 bottom-10 size-24 rotate-12 rounded-[28px]" iconClassName="size-12" />
                        <div className="mt-auto pt-4">
                            {card.href ? (
                                card.external ? (
                                    <a
                                        href={card.href}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-lime px-3 py-1.5 text-xs font-bold text-lime-ink"
                                    >
                                        <DiscordIcon className="size-3.5" /> {card.action}
                                    </a>
                                ) : (
                                    <Link href={card.href} className="rounded-lg bg-lime px-3 py-1.5 text-xs font-bold text-lime-ink">
                                        {card.action}
                                    </Link>
                                )
                            ) : card.onClick ? (
                                <button
                                    type="button"
                                    onClick={card.onClick}
                                    disabled={card.disabled}
                                    className="rounded-lg bg-lime px-3 py-1.5 text-xs font-bold text-lime-ink disabled:bg-white/15 disabled:text-white/60"
                                >
                                    {card.action}
                                </button>
                            ) : (
                                <span className="flex items-center gap-1 text-xs text-white/60">
                                    <Sparkles className="size-3.5" /> {card.action}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
