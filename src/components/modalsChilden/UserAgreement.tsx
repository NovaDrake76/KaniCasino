const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-4">
        <span className="font-bold text-base block mb-1">{title}</span>
        <div className="text-justify flex flex-col gap-2">{children}</div>
    </div>
);

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
        <span className="font-semibold">{label}: </span>
        <span>{children}</span>
    </div>
);

const UserAgreement = () => {
    return (
        <div className="flex flex-col text-sm">
            <span className="font-bold text-lg mb-1">Terms of Service</span>
            <span className="mb-1 italic">Last updated: 25 August 2026</span>
            <span className="mb-4 text-ink-muted">
                These terms cover <span className="text-blue-500">kanicasino.com</span> and the
                KaniCasino Discord bot. By using either you agree to them. KaniCasino is an
                independent, open-source project run from Brazil. If anything here is unclear,
                write to <span className="text-blue-500">novadrake77@gmail.com</span> and a person
                will answer you.
            </span>

            <Section title="1. There is no real money in KaniCasino">
                <span>
                    KaniCasino is a game. Its currency, K₽, is fictional. It cannot be bought, sold,
                    deposited, withdrawn, transferred out, or exchanged for money or anything of
                    real value, by us or by anyone else. There are no prizes. We never ask for
                    payment details and we do not process payments.
                </span>
                <span>
                    Items you win exist only inside KaniCasino and have no value outside it. Buying
                    or selling KaniCasino accounts, items or K₽ for real money is forbidden, and
                    doing it is grounds for closing the account. Nothing on the site is an
                    investment, and nothing here is gambling in the legal sense, because nothing of
                    value is ever staked or won.
                </span>
            </Section>

            <Section title="2. Who may use it">
                <span>
                    You must be at least 18. KaniCasino uses the look and mechanics of casino games,
                    and it is not intended for children. You must also be allowed to use games of
                    this kind where you live. If you are not, do not use it.
                </span>
            </Section>

            <Section title="3. Your account">
                <Row label="3.1 One person, one account">
                    Extra accounts made to collect the same rewards twice, or to influence
                    leaderboards, rankings or the marketplace, may all be closed.
                </Row>
                <Row label="3.2 Keeping it yours">
                    You are responsible for your login and for what happens through it. Tell us if
                    you think somebody else has it.
                </Row>
                <Row label="3.3 Names and pictures">
                    Usernames and profile pictures that are hateful, sexual, impersonate somebody
                    else, or are otherwise abusive will be changed or the account closed.
                </Row>
                <Row label="3.4 Closing it">
                    You can stop using KaniCasino whenever you like, and ask us to delete your
                    account by email. We may suspend or close an account that breaks these terms.
                </Row>
            </Section>

            <Section title="4. The Discord bot">
                <Row label="4.1 What it is">
                    An optional way to use KaniCasino from Discord. It shows what a player has
                    collected, ranks the players in a server, and opens cases on the balance of an
                    account that has been linked. It is the same account and the same K₽ as the
                    site.
                </Row>
                <Row label="4.2 Linking is yours to choose">
                    The bot can only act on your account after you link it, which needs you to be
                    signed in on the site. You can unlink at any time from the settings tab on your
                    profile, and one Discord account can be linked to one KaniCasino account.
                </Row>
                <Row label="4.3 Opening a case costs K₽">
                    A case opened through the bot charges your balance exactly as it would on the
                    site, and the item is added to the same inventory. Somebody with no linked
                    account can watch a demonstration spin, which keeps nothing and charges nothing.
                </Row>
                <Row label="4.4 Using it fairly">
                    Do not automate the bot, script commands, or use it in a way meant to flood a
                    server or our service. Server administrators may remove the bot from their
                    server at any time, and we may stop serving a Discord account or a server that
                    abuses it.
                </Row>
                <Row label="4.5 Discord's own rules">
                    Discord is a separate company. Using the bot also means following Discord's
                    Terms of Service and Community Guidelines, and Discord's own terms govern your
                    Discord account, not us.
                </Row>
            </Section>

            <Section title="5. Fair play">
                <span>
                    Do not cheat, exploit bugs, or use bots, scripts or automation against the site
                    or the games. If you find a way to get K₽ or items that you should not have,
                    tell us instead of using it. We may reverse balances, items and results that
                    came from a bug or from abuse, and we may close accounts that did it knowingly.
                </span>
                <span>
                    Every draw is provably fair and can be checked yourself: the server seed is
                    committed before the bet and revealed afterwards, and the page at{" "}
                    <span className="text-blue-500">kanicasino.com/provably-fair</span> shows how to
                    verify any result.
                </span>
            </Section>

            <Section title="6. The game changes">
                <span>
                    KaniCasino is worked on continuously. Cases, odds, prices, features and games
                    may be added, changed or removed, and balances or items may be adjusted where
                    something was broken. Because K₽ and items have no real value, none of this is
                    a loss of property, and we do not owe compensation for it.
                </span>
                <span>
                    We may also stop running KaniCasino. If we do, we will say so on the site
                    beforehand where we reasonably can.
                </span>
            </Section>

            <Section title="7. Content and ownership">
                <span>
                    Character art belongs to its respective creators and rights holders, and is used
                    here by a fan project with no claim of ownership and no affiliation with them.
                    The artists page credits the artists we know of. If you hold rights to something
                    used here and want it removed, email us and we will remove it.
                </span>
                <span>
                    KaniCasino's own source code is open source under its repository licence. These
                    terms cover the service we run, not your use of that code.
                </span>
            </Section>

            <Section title="8. No warranty, and what we are responsible for">
                <span>
                    KaniCasino is provided as it is, free of charge, with no warranty of any kind.
                    We do not promise it will be available, uninterrupted, or free of errors. To the
                    extent the law allows, we are not liable for any loss arising from using it, and
                    since the service is free and its currency is fictional, any liability that
                    cannot be excluded is limited to what you paid us, which is nothing.
                </span>
                <span>
                    Nothing here limits rights you have under Brazilian consumer law that cannot be
                    limited by agreement.
                </span>
            </Section>

            <Section title="9. Your data">
                <span>
                    What we collect and why is set out in our Privacy Policy at{" "}
                    <span className="text-blue-500">kanicasino.com/privacy-policy</span>, which is
                    part of these terms.
                </span>
            </Section>

            <Section title="10. Changes to these terms">
                <span>
                    We may update these terms. The date at the top always shows the current version,
                    and if a change materially affects you we will say so on the site before it
                    takes effect. Continuing to use KaniCasino after that means you accept them.
                </span>
            </Section>

            <Section title="11. Governing law">
                <span>
                    These terms are governed by Brazilian law, and disputes go to the courts of
                    Brazil. If you are a consumer, this does not take away the right to bring a
                    claim where you live.
                </span>
            </Section>

            <Section title="12. Contact">
                <span>
                    Questions, rights requests, takedown requests and anything else:{" "}
                    <span className="text-blue-500">novadrake77@gmail.com</span>.
                </span>
            </Section>
        </div>
    );
};

export default UserAgreement;
