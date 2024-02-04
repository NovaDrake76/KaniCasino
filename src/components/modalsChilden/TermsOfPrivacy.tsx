const PrivacyPolicySection = ({ title, content }: { title: string, content: string | JSX.Element[] }) => (
    <div className="mb-2">
        <span className="font-bold text-base">{title}:</span>
        <span className="ml-2 text-justify">{content}</span>
    </div>
);

const TermsOfPrivacy = () => {
    return (
        <div className="flex flex-col text-sm ">
            <span className="font-bold text-lg mb-4">Privacy Policy for KaniCasino</span>
            <span className="mb-2 italic">Last Updated: 04/02/2024</span>
            <span className="mb-2">
                Welcome to KaniCasino! This Privacy Policy outlines how we collect, use, and protect your personal information when you use our open-source online casino at <span className="text-blue-500">kanicasino.novadrake.com</span>.
            </span>

            {[
                {
                    title: '1. Information We Collect', content: [
                        { title: '1.1 Personal Information', content: 'We do not collect any personally identifiable information, such as names, addresses, or contact details, as KaniCasino does not involve real money transactions.' },
                        { title: '1.2 Gameplay Data', content: 'We may collect and store data related to your gameplay, including game statistics, in-game actions, and other relevant information to enhance your gaming experience and improve our services.' },
                    ]
                },
                {
                    title: '2. Use of Information', content: [
                        { title: '2.1 Gameplay Optimization', content: 'We use the collected gameplay data to optimize the user experience, provide better game features, and troubleshoot any issues that may arise during gameplay.' },
                        { title: '2.2 Communication', content: 'We may use your contact information if provided (e.g., email address) to communicate important updates, notifications, or respond to inquiries related to KaniCasino.' },
                    ]
                },
                { title: '3. Data Security', content: 'We take reasonable measures to safeguard the information we collect to prevent unauthorized access, disclosure, alteration, or destruction of your data.' },
                { title: '4. Third-Party Services', content: 'KaniCasino may utilize third-party services for analytics, hosting, or other purposes. These services have their own privacy policies, and we encourage you to review them.' },
                { title: '5. Changes to Privacy Policy', content: 'This Privacy Policy may be updated from time to time. Any changes will be reflected on this page, and it is your responsibility to review this policy periodically.' },
                { title: '6. Contact Us', content: 'If you have any questions or concerns about this Privacy Policy, please contact us at novadrake76@gmail.com' },
            ].map((section, index) => (
                <PrivacyPolicySection key={index} title={section.title} content={Array.isArray(section.content) ? section.content.map((item, i) => (<PrivacyPolicySection key={i} title={item.title} content={item.content} />)) : section.content} />
            ))}

            <span className="mt-4">
                By using KaniCasino, you agree to the terms outlined in this Privacy Policy.
            </span>
        </div>
    );
}

export default TermsOfPrivacy;
