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

const TermsOfPrivacy = () => {
    return (
        <div className="flex flex-col text-sm">
            <span className="font-bold text-lg mb-1">Privacy Policy</span>
            <span className="mb-1 italic">Last updated: 26 July 2026</span>
            <span className="mb-4 text-ink-muted">
                KaniCasino ("we") is an independent project run from Brazil, and is the controller
                of the personal data described below. This policy explains what we
                collect when you use <span className="text-blue-500">kanicasino.com</span>, why, and
                the rights you have over it. It is written to meet the Brazilian General Data
                Protection Law (LGPD, Law 13.709/2018). For anything in this policy, including the
                rights in section 8, write to{" "}
                <span className="text-blue-500">novadrake77@gmail.com</span> and a person will
                answer you.
            </span>

            <Section title="1. What KaniCasino is">
                <span>
                    KaniCasino is a free, open-source game using a fictional currency called K₽.
                    There is no deposit, no withdrawal, and no way to convert K₽ into money or
                    anything of real value. We never ask for payment details and we do not process
                    payments.
                </span>
            </Section>

            <Section title="2. Data we collect">
                <Row label="2.1 Account data">
                    Your email address, a username, and a profile picture. If you sign in with
                    Google we receive your email address, name and profile picture from Google, and
                    store a Google account identifier. If you register directly we store a hashed
                    password, never the password itself.
                </Row>
                <Row label="2.2 Gameplay data">
                    Your K₽ balance, inventory, level and experience, game results, provably-fair
                    roll records, marketplace listings and trades, missions, referrals, and a
                    ledger of every K₽ movement on your account.
                </Row>
                <Row label="2.3 Technical data">
                    Server logs and connection data, including IP address, needed to operate the
                    site and prevent abuse. Analytics and advertising providers set cookies and
                    similar identifiers in your browser (see section 5).
                </Row>
                <Row label="2.4 Communications">
                    Messages you send us, and whether our emails to you were delivered, bounced or
                    reported as spam.
                </Row>
            </Section>

            <Section title="3. Why we use it, and our legal basis">
                <Row label="3.1 To run the service">
                    Creating and securing your account, saving your progress, running the games and
                    the marketplace, and keeping the provably-fair records that let you verify any
                    result. Legal basis: performance of a contract with you (LGPD Art. 7, V).
                </Row>
                <Row label="3.2 To keep the game fair and secure">
                    Detecting abuse, cheating and duplicate accounts, and investigating problems.
                    Legal basis: our legitimate interest in a working, fair service (Art. 7, IX).
                </Row>
                <Row label="3.3 Service messages">
                    Account and security notices, and changes to this policy. These are part of
                    running your account and are not marketing, so they are not optional while your
                    account exists.
                </Row>
                <Row label="3.4 Optional updates about the game">
                    News about new cases, games and features. We send these only if you switch them
                    on in your profile settings. Legal basis: your consent (Art. 7, I), which you
                    can withdraw at any time.
                </Row>
            </Section>

            <Section title="4. Marketing email and how to stop it">
                <span>
                    Optional updates are off by default and stay off unless you turn them on. Every
                    such email carries a one-click unsubscribe link and honours the unsubscribe
                    header your mail provider uses. You can also switch them off at any time in your
                    profile settings. Withdrawing consent does not affect service messages, and it
                    never affects your account or your ability to play.
                </span>
            </Section>

            <Section title="5. Who else processes your data">
                <span>
                    We use the following providers, each acting on our behalf or as an independent
                    controller under their own policies:
                </span>
                <ul className="list-disc ml-5 flex flex-col gap-1">
                    <li>Amazon Web Services (hosting, file storage and outbound email), United States and Brazil</li>
                    <li>MongoDB Atlas (database hosting)</li>
                    <li>Cloudflare (content delivery and protection)</li>
                    <li>Google Analytics (usage measurement) and Google AdSense (advertising)</li>
                    <li>Google Sign-In, if you choose to use it</li>
                </ul>
                <span>
                    We do not sell your personal data and we do not share it for anyone else's
                    independent marketing.
                </span>
            </Section>

            <Section title="6. International transfers">
                <span>
                    Some of these providers store or process data outside Brazil, mainly in the
                    United States. Where that happens we rely on the transfer safeguards those
                    providers offer under LGPD Art. 33.
                </span>
            </Section>

            <Section title="7. How long we keep it">
                <Row label="Account data">
                    For as long as your account exists. If you delete your account we remove or
                    anonymise your personal data.
                </Row>
                <Row label="Gameplay and ledger records">
                    Kept while the account exists so balances and provably-fair verification stay
                    meaningful. Some game round records are deleted automatically after a short
                    period.
                </Row>
                <Row label="Suppressed email addresses">
                    If your address hard-bounces or you report our mail as spam, we keep a record of
                    that so we never email you again.
                </Row>
            </Section>

            <Section title="8. Your rights">
                <span>
                    Under LGPD Art. 18 you can ask us to confirm whether we process your data,
                    access it, correct it, anonymise or delete it, receive it in a portable form,
                    know who we have shared it with, and withdraw consent. To exercise any of these,
                    email <span className="text-blue-500">novadrake77@gmail.com</span>. We answer
                    within 15 days. You may also complain to the ANPD, Brazil's data protection
                    authority.
                </span>
            </Section>

            <Section title="9. Security">
                <span>
                    Passwords are stored hashed. Traffic is encrypted in transit. Access to the
                    production database is restricted. No system is perfectly secure, so we cannot
                    promise absolute safety, but if a breach puts your rights at material risk we
                    will notify you and the ANPD as the law requires.
                </span>
            </Section>

            <Section title="10. Age">
                <span>
                    KaniCasino is not intended for children. You must be old enough to use
                    gambling-styled games where you live, and at least 18. We do not knowingly
                    collect data from children; if we learn that we have, we delete it.
                </span>
            </Section>

            <Section title="11. Changes">
                <span>
                    We may update this policy. If a change materially affects your rights we will
                    tell you by email or in the site before it takes effect, and the date at the top
                    always shows the current version.
                </span>
            </Section>

            <Section title="12. Contact">
                <span>
                    Privacy questions, rights requests and anything else:{" "}
                    <span className="text-blue-500">novadrake77@gmail.com</span>.
                </span>
            </Section>
        </div>
    );
};

export default TermsOfPrivacy;
