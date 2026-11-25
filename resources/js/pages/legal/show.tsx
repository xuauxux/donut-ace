import { Head, Link, usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { DISCORD_URL, DiscordIcon } from '@/components/casino/art';
import { cn } from '@/lib/utils';

type Props = {
    page: string;
    title: string;
    updatedAt: string;
};

type Item = { q: string; a: ReactNode };
type Section = { id: string; title: string; body: ReactNode };

const TABS = [
    { slug: 'faq', label: 'FAQ' },
    { slug: 'terms', label: 'Terms of Service' },
    { slug: 'code-of-ethics', label: 'Code of Ethics' },
    { slug: 'privacy', label: 'Privacy Policy' },
];

/** The arcade FAQ. Coins are virtual, so there is no wagering or payment text here. */
const faqItems = (coins: string): Item[] => [
    {
        q: 'What is Donut Ace?',
        a: (
            <p>
                Donut Ace is an independent arcade for DonutSMP players. It offers games including Mines, Towers,
                Coinflip, Blackjack, Dice, Limbo and Crash, alongside public fairness tools.
            </p>
        ),
    },
    {
        q: 'Is Donut Ace a DonutSMP casino?',
        a: (
            <p>
                Some players use “DonutSMP casino” to describe sites with chance-based games. Donut Ace operates as an
                arcade and social platform using in-game coins. Our terms prohibit using the platform to deposit,
                wager or withdraw real-world monetary value.
            </p>
        ),
    },
    {
        q: 'Is Donut Ace affiliated with DonutSMP?',
        a: <p>No. Donut Ace is independent and is not affiliated with DonutSMP, Mojang AB or Microsoft.</p>,
    },
    {
        q: 'How do I start playing?',
        a: (
            <p>
                Choose Register or Sign In, enter your Minecraft username and complete the verification instructions.
                Our getting-started guide explains account linking, deposits, game rules and withdrawals.
            </p>
        ),
    },
    {
        q: 'How do DonutSMP deposits and withdrawals work?',
        a: (
            <p>
                Use the Deposit dialog to obtain the current in-game payment command. Withdrawals are requested
                through your wallet for your linked account. Follow the live instructions and bot status on the site;
                do not send coins to a name copied from an unsolicited message.
            </p>
        ),
    },
    {
        q: 'Why is my withdrawable balance lower than my balance?',
        a: (
            <p>
                Some rewards and promotions carry wagering requirements. Your wallet shows how much is available to
                withdraw and any requirements that remain. Check the conditions before claiming a promotion.
            </p>
        ),
    },
    {
        q: 'How long do withdrawals take?',
        a: (
            <p>
                Timing depends on the payout bot, the request and current service availability. Check your wallet for
                the request status. If you need help, contact support through the{' '}
                <a
                    href={DISCORD_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-semibold text-lime hover:underline"
                >
                    Donut Ace Discord
                </a>
                .
            </p>
        ),
    },
    {
        q: 'What does provably fair mean?',
        a: (
            <p>
                For supported games, seeds and round inputs let you independently reproduce a completed outcome. Visit
                the fairness tools to check a round. Provably fair does not mean every round wins, and it does not
                remove a game’s house edge.
            </p>
        ),
    },
    {
        q: 'Where can I find each game’s odds and rules?',
        a: (
            <p>
                Read the game page’s rules, FAQs, win chances or payout table before placing a play. Start with Mines,
                Limbo, Dice or Blackjack; each game has different mechanics.
            </p>
        ),
    },
    {
        q: 'Where do I find rewards and rain?',
        a: (
            <p>
                Check Rewards for available offers and their requirements. Rain appears in live chat; eligibility and
                availability depend on the current event. Rewards and promo codes may have claim limits.
            </p>
        ),
    },
    {
        q: 'How old do I need to be?',
        a: (
            <p>
                You must be at least 18 years old under the Donut Ace terms. Play for entertainment — {coins} have no
                cash value, and if play stops being fun, take a break.
            </p>
        ),
    },
];

/** Terms of Service, written for a virtual-currency arcade. */
const termsSections = (coins: string): Section[] => [
    {
        id: 'acceptance',
        title: 'Acceptance of Terms',
        body: (
            <>
                <p>
                    These Terms of Service (the “Terms”) govern your use of the Donut Ace website and its related
                    services (the “Service”). By accessing or using the Service you agree to be bound by these Terms.
                    If you do not agree with them, do not use the Service.
                </p>
            </>
        ),
    },
    {
        id: 'age',
        title: 'Age Requirement',
        body: (
            <p>
                You must be at least 18 years old to use Donut Ace. By using the Service you confirm and warrant that
                you meet this requirement. If you are under 18, stop using the Service immediately.
            </p>
        ),
    },
    {
        id: 'account',
        title: 'Account Registration',
        body: (
            <p>
                You need an account (an “Account”) to access the Service. Give accurate, complete and current
                information when you register, and keep it up to date. You are solely responsible for protecting your
                Account credentials and for all activity that happens under your Account. Donut Ace is not liable for
                unauthorised access to or use of your Account.
            </p>
        ),
    },
    {
        id: 'virtual-currency',
        title: `Use of ${coins}`,
        body: (
            <>
                <p>
                    Donut Ace is an arcade website that uses {coins} for in-game activities. {coins} have no real-world
                    value and exist solely for entertainment on Donut Ace. You agree not to purchase or exchange them
                    for real currency — including US dollars — and not to exchange them with other users.
                </p>
                <p>
                    {coins}, virtual content and rewards obtained through the Service are fictitious. They carry no
                    monetary or real-world value, are intended only for Donut Ace’s virtual environment, and do not
                    represent real-world currency, property or assets.
                </p>
                <p>
                    Do not convert, trade, sell or exchange {coins} or virtual content obtained from Donut Ace for
                    real-world currency, goods or services. Attempts may result in account suspension or termination.
                </p>
                <p>
                    Donut Ace does not support, endorse or facilitate gambling with real-world currency. Its activities
                    are simulated arcade games for recreation. Outcomes may involve chance, but they cannot produce
                    real-world monetary gains or losses. Any resemblance to gambling is fictional and involves no real
                    monetary stakes.
                </p>
            </>
        ),
    },
    {
        id: 'game-rules',
        title: 'Game Rules',
        body: (
            <p>
                Donut Ace provides fandom-based entertainment, virtual content and currency inspired by the Donut
                Minecraft server. Its games are for entertainment and offer no opportunity to win real-world money or
                items. By taking part you acknowledge this and agree to follow each game’s rules and conditions.
                Breaking them may lead to penalties, including account suspension or termination.
            </p>
        ),
    },
    {
        id: 'deposits',
        title: 'Deposits and Withdrawals',
        body: (
            <p>
                {coins} deposits and withdrawals depend on Service availability. Donut Ace is not liable for delays,
                interruptions or unavailability, or for missing deposits or withdrawals caused by technical issues,
                system malfunctions, user error or other unforeseen circumstances.
            </p>
        ),
    },
    {
        id: 'refunds',
        title: `${coins} Refunds`,
        body: (
            <>
                <p>
                    Report missing {coins} to on-site support within 72 hours of the incident. Include evidence and an
                    uncut video showing when it happened. Support cannot assist if these requirements are not met.
                </p>
                <p>
                    Once {coins} have been placed in a play for the first time they are no longer eligible for a
                    refund. Meeting the reporting requirements does not guarantee that support can resolve the issue.
                    We are not responsible for on-site or in-game losses related to the site.
                </p>
            </>
        ),
    },
    {
        id: 'moderation',
        title: 'Blacklisting and Moderation',
        body: (
            <p>
                Donut Ace may blacklist or suspend accounts that break site rules, engage in abusive behaviour or
                attempt fraudulent manipulation. These decisions are at Donut Ace’s sole discretion and require no
                prior warning. Moderators may issue warnings, suspend accounts, permanently ban users or take other
                action needed to keep the platform fair and enjoyable.
            </p>
        ),
    },
    {
        id: 'liability',
        title: 'Limitation of Liability',
        body: (
            <p>
                You understand and agree that your use of the Service is at your sole risk. To the fullest extent
                permitted by applicable law, Donut Ace is not liable for any direct, indirect, incidental,
                consequential or punitive damages arising out of or in connection with your use of the Service,
                including technical issues, interruptions or losses related to {coins} usage. Donut Ace is not liable
                for errors, omissions or inaccuracies in the Service’s content, including virtual descriptions, prices
                or availability.
            </p>
        ),
    },
    {
        id: 'fair-use',
        title: 'Fair Use and Cheating',
        body: (
            <p>
                Do not undermine the Service, including by using bots, automation or third-party software to manipulate
                or exploit the platform. Cheating, hacking or other dishonest behaviour on Donut Ace results in
                immediate Account termination and may be reported to the relevant authorities where necessary.
            </p>
        ),
    },
    {
        id: 'force-majeure',
        title: 'Force Majeure',
        body: (
            <p>
                Donut Ace is not liable for disruptions, delays or failures caused by unforeseen events beyond our
                control, including system failures. We will make reasonable efforts to restore the Service as soon as
                practicable.
            </p>
        ),
    },
    {
        id: 'termination',
        title: 'Termination of Accounts',
        body: (
            <>
                <p>
                    Donut Ace may terminate or suspend your Account at its sole discretion, with or without cause and
                    without prior notice. Reasons may include breaking these Terms, abusive behaviour, fraudulent
                    manipulation or breaking any stated rules and conditions.
                </p>
                <p>
                    Donut Ace is not responsible for bans or limitations elsewhere, including Minecraft account
                    terminations or bans, Donut server bans or in-game restrictions. If your Account is terminated for
                    breaching these Terms, you forfeit any rights or claims to virtual content or {coins} on the
                    platform.
                </p>
            </>
        ),
    },
    {
        id: 'bot-accounts',
        title: 'Terminated Bot Accounts',
        body: (
            <p>
                If a bot account is banned, all {coins} and content associated with the affected game type are removed
                from the site. No refunds are available in this situation. This policy protects the integrity and
                fairness of the games.
            </p>
        ),
    },
    {
        id: 'ip',
        title: 'Intellectual Property',
        body: (
            <p>
                All virtual content and assets provided by Donut Ace are the property of Donut Ace or their respective
                owners and are protected by copyright and other intellectual property laws. Do not reproduce,
                distribute, modify, create derivative works from or publicly display any virtual content or assets
                from Donut Ace without explicit permission.
            </p>
        ),
    },
    {
        id: 'downtime',
        title: 'Website Downtime',
        body: (
            <p>
                The website may be unavailable because of technical issues, maintenance or system upgrades. Donut Ace
                is not liable for losses or damages caused by these disruptions.
            </p>
        ),
    },
    {
        id: 'changes',
        title: 'Changes to Terms',
        body: (
            <p>
                Donut Ace may modify or update these Terms at any time without prior notice. Continuing to use the
                Service after updated Terms are posted means you accept them. We will make reasonable efforts to notify
                users of significant changes through the website or other appropriate channels.
            </p>
        ),
    },
    {
        id: 'severability',
        title: 'Severability',
        body: (
            <p>
                If any provision of these Terms is found to be unenforceable or invalid, the remaining provisions stay
                in full force and effect.
            </p>
        ),
    },
    {
        id: 'contact',
        title: 'Contact',
        body: (
            <p>
                Contact our official{' '}
                <a
                    href={DISCORD_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-semibold text-lime hover:underline"
                >
                    Discord server
                </a>{' '}
                or on-site support with questions or concerns about these Terms.
            </p>
        ),
    },
];

/** Code of Ethics — community standards. Reports go to Discord, never to an email. */
const ethicsSections: Section[] = [
    {
        id: 'respect',
        title: 'Respect for All',
        body: (
            <p>
                We value the diversity of our community and work to keep it a respectful place. Everyone here is
                expected to treat others with dignity, whatever their background, beliefs or skill level.
            </p>
        ),
    },
    {
        id: 'fair-play',
        title: 'Fair Play',
        body: (
            <p>
                Fair play is the cornerstone of the platform. Cheating, exploiting bugs or manipulating game outcomes
                is strictly prohibited. Accounts that break this principle may be suspended or terminated.
            </p>
        ),
    },
    {
        id: 'responsible-play',
        title: 'Responsible Play',
        body: (
            <p>
                Donut Ace is built for entertainment. Play within your means, and step away if it stops being healthy
                or enjoyable — coins have no cash value, so there is nothing to chase and no loss to recover.
            </p>
        ),
    },
    {
        id: 'privacy',
        title: 'Privacy Respect',
        body: (
            <p>
                Respect other players’ privacy. Do not share your own or ask for anyone else’s personal information —
                real names, addresses, account logins, passwords or payment details. Anything that looks like a
                privacy breach should be reported to the team straight away.
            </p>
        ),
    },
    {
        id: 'harassment',
        title: 'Non-Harassment',
        body: (
            <p>
                There is zero tolerance for harassment of any kind, including bullying, discrimination and hate
                speech. Anyone found doing it may face disciplinary action, up to and including a permanent ban.
            </p>
        ),
    },
    {
        id: 'laws',
        title: 'Compliance with Laws',
        body: (
            <p>
                You are responsible for following the laws that apply where you live. Donut Ace cannot be held
                responsible for a user’s failure to comply with local regulations.
            </p>
        ),
    },
    {
        id: 'reporting',
        title: 'Reporting Misconduct',
        body: (
            <p>
                If you see conduct that breaks this Code, report it in the{' '}
                <a
                    href={DISCORD_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-semibold text-lime hover:underline"
                >
                    Donut Ace Discord
                </a>
                . Moderators review every report; include what happened, where and when, plus screenshots or a clip if
                you have them. Reports are handled privately.
            </p>
        ),
    },
];

/** Privacy Policy — plain-language, and accurate about what this app actually stores. */
const privacySections: Section[] = [
    {
        id: 'scope',
        title: 'Scope of This Policy',
        body: (
            <>
                <p>
                    At Donut Ace (“we”, “us”, “our”) we respect your privacy and protect your personal information
                    under this policy (the “Privacy Policy”). We collect data strictly to run the arcade well and make
                    it a better place to play.
                </p>
                <p>
                    This Privacy Policy is part of the Donut Ace Terms of Service and applies to everyone who uses our
                    website, games and related services (the “Services”) or creates an account with us. By using the
                    Services, or by creating or linking an account, you consent to this policy. If you do not agree
                    with any part of it, please do not use the Services or send us personal information.
                </p>
            </>
        ),
    },
    {
        id: 'what-we-store',
        title: 'What We Store',
        body: (
            <>
                <p>We keep the account information you give us:</p>
                <ul>
                    <li>your username;</li>
                    <li>your email address, used for sign-in and account recovery;</li>
                    <li>a Discord account, if you choose to link one.</li>
                </ul>
                <p>
                    Alongside that we store the records needed to run the games fairly and keep the platform
                    secure — your coin balance, the rounds you have played, your settings and language, and technical
                    data such as session cookies, sign-in times and IP addresses in our logs.
                </p>
                <p>
                    We do not store card numbers or bank details. If you buy coins, the payment is handled by the
                    payment provider, and we only receive the result of the transaction.
                </p>
            </>
        ),
    },
    {
        id: 'how-we-use-it',
        title: 'How We Use It',
        body: (
            <>
                <p>Your data is used to:</p>
                <ul>
                    <li>create and secure your account and keep you signed in;</li>
                    <li>run games, credit and debit coins, and show your play history;</li>
                    <li>detect cheating, bots, multi-accounting and other abuse;</li>
                    <li>answer support requests and investigate reports;</li>
                    <li>meet legal and accounting obligations that apply to us.</li>
                </ul>
                <p>We do not sell your personal information, and we do not build advertising profiles from it.</p>
            </>
        ),
    },
    {
        id: 'cookies',
        title: 'Cookies and Local Storage',
        body: (
            <p>
                We use the cookies required to keep you signed in, protect forms against cross-site request forgery and
                remember preferences such as language. We do not use advertising or cross-site tracking cookies. You
                can block or delete cookies in your browser, but the Services will not work without the strictly
                necessary ones.
            </p>
        ),
    },
    {
        id: 'sharing',
        title: 'Who We Share It With',
        body: (
            <>
                <p>We share personal information only where it is needed to operate the Service:</p>
                <ul>
                    <li>hosting, database and email providers that run the platform on our behalf;</li>
                    <li>our payment provider, when you choose to buy coins;</li>
                    <li>moderators and staff, when investigating a report or a rule breach;</li>
                    <li>authorities or courts, where the law requires it.</li>
                </ul>
                <p>
                    Providers act on our instructions and may only use the data to deliver their service to us.
                </p>
            </>
        ),
    },
    {
        id: 'retention',
        title: 'How Long We Keep It',
        body: (
            <p>
                Account data is kept while your account is open. If you close your account, we delete or anonymise
                your personal information within a reasonable period, except for records we must keep for legal,
                security or fraud-prevention reasons — for example, a ban record needed to stop a repeat offender
                returning.
            </p>
        ),
    },
    {
        id: 'rights',
        title: 'Your Rights',
        body: (
            <>
                <p>
                    You can ask us to show you the personal information we hold about you, correct anything that is
                    wrong, or delete your account and the data attached to it. Where the law gives you the right, you
                    can also object to or restrict certain processing.
                </p>
                <p>
                    Ask in the{' '}
                    <a
                        href={DISCORD_URL}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="font-semibold text-lime hover:underline"
                    >
                        Donut Ace Discord
                    </a>{' '}
                    and we will respond as soon as we can. We may need to confirm the account is yours first.
                </p>
            </>
        ),
    },
    {
        id: 'children',
        title: 'Children',
        body: (
            <p>
                The Services are for adults only — you must be at least 18 to hold an account. We do not knowingly
                collect personal information from anyone under 18. If you believe a child has created an account,
                tell us in the Discord and we will remove it.
            </p>
        ),
    },
    {
        id: 'security',
        title: 'Security',
        body: (
            <p>
                Passwords are stored hashed, traffic is encrypted in transit, and access to personal data is limited
                to the staff who need it. No system is perfect, so keep your password to yourself and tell us at once
                if you think your account has been accessed by someone else.
            </p>
        ),
    },
    {
        id: 'changes',
        title: 'Changes to This Policy',
        body: (
            <p>
                We may update this Privacy Policy as the Service changes. The current version is always published on
                this page, and significant changes will be announced on the site or in the Discord.
            </p>
        ),
    },
    {
        id: 'contact',
        title: 'Contact',
        body: (
            <p>
                Questions about privacy, or a request about your data? Reach us in the{' '}
                <a
                    href={DISCORD_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-semibold text-lime hover:underline"
                >
                    Donut Ace Discord
                </a>
                .
            </p>
        ),
    },
];

export default function LegalShow({ page, title, updatedAt }: Props) {
    const { company, casino } = usePage().props;
    const coins = casino.currency;

    return (
        <>
            <Head title={title} />
            <div className="mx-auto w-full max-w-3xl">
                <div className="mb-4 flex gap-2">
                    {TABS.map((tab) => (
                        <Link
                            key={tab.slug}
                            href={`/legal/${tab.slug}`}
                            className={cn(
                                'rounded-xl px-4 py-2 text-sm font-semibold transition',
                                tab.slug === page
                                    ? 'bg-surface-2 text-white ring-1 ring-line'
                                    : 'text-dim hover:bg-surface-2/60 hover:text-white',
                            )}
                        >
                            {tab.label}
                        </Link>
                    ))}
                </div>

                <article className="rounded-2xl bg-surface p-6 ring-1 ring-line/60 md:p-10">
                    <div className="border-b border-line/60 pb-6">
                        <div className="text-xs font-bold tracking-wider text-lime uppercase">Help</div>
                        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{title}</h1>
                        <p className="mt-1 text-xs text-dim">
                            Last updated: {updatedAt} · {company.name}
                        </p>
                    </div>

                    {page === 'terms' ? (
                        <TermsBody coins={coins} />
                    ) : page === 'code-of-ethics' ? (
                        <EthicsBody />
                    ) : page === 'privacy' ? (
                        <PrivacyBody />
                    ) : (
                        <FaqBody coins={coins} />
                    )}

                    <div className="mt-10 flex flex-col gap-3 rounded-xl bg-surface-2 p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="font-bold text-white">Still stuck?</div>
                            <div className="text-sm text-dim">Ask in the Donut Ace Discord — we answer there.</div>
                        </div>
                        <Link
                            href="/games"
                            className="flex items-center justify-center gap-2 rounded-xl bg-lime px-4 py-2.5 text-sm font-bold text-lime-ink"
                        >
                            Back to the games
                        </Link>
                        <a
                            href={DISCORD_URL}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="flex items-center justify-center gap-2 rounded-xl bg-[#5865F2] px-4 py-2.5 text-sm font-bold text-white"
                        >
                            <DiscordIcon className="size-4" /> Discord
                        </a>
                    </div>
                </article>
            </div>
        </>
    );
}

function FaqBody({ coins }: { coins: string }) {
    return (
        <>
            <p className="mt-6 text-[15px] leading-relaxed text-white/80">
                Answers about the DonutSMP arcade, in-game coins and getting started on Donut Ace.
            </p>
            <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-white/80">
                {faqItems(coins).map((item) => (
                    <section key={item.q} className="scroll-mt-24">
                        <h2 className="text-lg font-bold text-white">{item.q}</h2>
                        <div className="mt-2">{item.a}</div>
                    </section>
                ))}
            </div>
        </>
    );
}

function EthicsBody() {
    return (
        <>
            <p className="mt-6 text-[15px] leading-relaxed text-white/80">
                We are committed to a fair, respectful and responsible community. The sections below set out the
                standard we hold ourselves — and everyone who plays at Donut Ace — to.
            </p>
            <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-white/80">
                {ethicsSections.map((s) => (
                    <section key={s.id} id={s.id} className="scroll-mt-24">
                        <h2 className="text-lg font-bold text-white">{s.title}</h2>
                        <div className="mt-2">{s.body}</div>
                    </section>
                ))}
            </div>
        </>
    );
}

function PrivacyBody() {
    return (
        <div className="mt-6 space-y-8 text-[15px] leading-relaxed text-white/80 [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:space-y-1.5">
            {privacySections.map((s) => (
                <section key={s.id} id={s.id} className="scroll-mt-24">
                    <h2 className="text-lg font-bold text-white">{s.title}</h2>
                    {s.body}
                </section>
            ))}
        </div>
    );
}

function TermsBody({ coins }: { coins: string }) {
    const sections = termsSections(coins);

    return (
        <>
            <div className="mt-6 rounded-xl bg-surface-2/60 p-4">
                <div className="mb-2 text-xs font-bold tracking-wider text-dim uppercase">Contents</div>
                <ol className="grid gap-1 text-sm sm:grid-cols-2">
                    {sections.map((s, i) => (
                        <li key={s.id}>
                            <a href={`#${s.id}`} className="text-white/80 hover:text-lime">
                                {i + 1}. {s.title}
                            </a>
                        </li>
                    ))}
                </ol>
            </div>
            <div className="mt-6 space-y-8 text-[15px] leading-relaxed text-white/80 [&_p]:mt-3">
                {sections.map((s, i) => (
                    <section key={s.id} id={s.id} className="scroll-mt-24">
                        <h2 className="text-lg font-bold text-white">
                            <span className="mr-2 text-lime">{i + 1}.</span>
                            {s.title}
                        </h2>
                        {s.body}
                    </section>
                ))}
            </div>
        </>
    );
}
