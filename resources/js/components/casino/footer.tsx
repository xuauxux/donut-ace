import { Link, usePage } from '@inertiajs/react';
import { DISCORD_URL, DiscordIcon, Logo } from '@/components/casino/art';
import { useI18n } from '@/components/casino/language-provider';
import type { TranslationKey } from '@/lib/i18n';

const COLUMNS: { title: TranslationKey; links: [TranslationKey, string][] }[] = [
    {
        title: 'footer.platform',
        links: [
            ['nav.casino', '/games'],
            ['nav.vip', '/vip'],
            ['nav.lottery', '/lottery'],
            ['filter.new', '/games?filter=new'],
        ],
    },
    {
        title: 'footer.legal',
        links: [
            ['legal.faq', '/legal/faq'],
            ['legal.terms', '/legal/terms'],
            ['legal.ethics', '/legal/code-of-ethics'],
            ['legal.privacy', '/legal/privacy'],
        ],
    },
];

export function CasinoFooter() {
    const { company, name, casino } = usePage().props;
    const { t } = useI18n();
    const year = new Date().getFullYear();

    return (
        <footer className="mt-12 border-t border-line/60 bg-panel">
            <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-8 md:flex-row md:gap-8 md:px-6 md:py-10">
                <div className="md:w-56">
                    <Logo />
                    <p className="mt-3 text-xs leading-relaxed text-dim">
                        {t('footer.tagline')}
                    </p>
                    <p className="mt-2 text-[11px] leading-relaxed text-dim/80">
                        {t('footer.disclaimer')}
                    </p>
                </div>
                <div className="grid flex-1 grid-cols-2 gap-8 sm:grid-cols-3">
                    {COLUMNS.map((c) => (
                        <div key={c.title} className={c.title === 'footer.platform' ? 'hidden sm:block' : undefined}>
                            <div className="mb-3 text-xs font-bold tracking-wider text-white uppercase">{t(c.title)}</div>
                            <ul className="flex flex-col gap-2">
                                {c.links.map(([label, href]) => (
                                    <li key={href}>
                                        <Link href={href} className="text-sm text-dim transition hover:text-white">
                                            {t(label)}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                    <div>
                        <div className="mb-3 text-xs font-bold tracking-wider text-white uppercase">{t('footer.support')}</div>
                        <a
                            href={DISCORD_URL}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-2 rounded-lg bg-[#5865F2]/15 px-3 py-2 text-sm font-semibold text-[#a8b1ff] transition hover:bg-[#5865F2]/25 hover:text-white"
                        >
                            <DiscordIcon className="size-4" />
                            Discord
                        </a>
                    </div>
                </div>
            </div>
            <div className="border-t border-line/60">
                <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-5 text-xs leading-relaxed text-dim md:px-6">
                    <p>
                        {t('footer.legalNotice', {
                            name,
                            company: company.name,
                            number: company.number,
                            address: company.address,
                        })}
                        <br />
                        {t('footer.rights', { year, name })}
                    </p>
                    <span className="shrink-0 rounded-md bg-surface-2 px-2 py-1 font-bold text-white">18+</span>
                </div>
            </div>
        </footer>
    );
}
