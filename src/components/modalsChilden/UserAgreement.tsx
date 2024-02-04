const UserAgreementSection = ({ title, content }: { title: string, content: string }) => (
    <div className="mb-2">
        <span className="font-bold">{title}: </span>
        <span className="ml-2 text-justify">{content}</span>
    </div>
);

const UserAgreement = () => {
    return (
        <div className="flex flex-col text-sm text-white">
            <span className="font-bold text-lg mb-4">User Agreement for KaniCasino</span>
            <span className="mb-2">Last Updated: 04/02/2024</span>
            <span className="mb-2">
                Welcome to KaniCasino! This User Agreement outlines the terms and conditions for using our open-source online casino at <span className="text-blue-500">kanicasino.novadrake.com</span>.
            </span>

            {[
                { title: '1. Acceptance of Terms', content: 'By using KaniCasino, you agree to comply with and be bound by the terms and conditions outlined in this User Agreement.' },
                { title: '2. Eligibility', content: 'You must be of legal age to participate in any form of gambling activity in your jurisdiction. KaniCasino is not intended for individuals under the legal gambling age.' },
                { title: '3. Account Registration', content: 'To access certain features of KaniCasino, you may be required to register an account. You are responsible for maintaining the confidentiality of your account information.' },
                { title: '4. Prohibited Activities', content: 'You agree not to engage in any activities that violate applicable laws, regulations, or the terms outlined in this User Agreement. Prohibited activities include, but are not limited to, cheating, fraud, and abuse of the platform.' },
                { title: '5. Termination of Account', content: 'We reserve the right to terminate or suspend your account if you violate the terms of this User Agreement. You may also close your account at any time.' },
                { title: '6. Disclaimers', content: 'KaniCasino is provided "as is" without any warranties. We do not guarantee the accuracy, completeness, or reliability of the content and features on the platform.' },
                { title: '7. Governing Law', content: 'This User Agreement is governed by and construed in accordance with the laws of Brazilian Judicial Branch. Any disputes arising from or related to this agreement will be subject to the exclusive jurisdiction of the courts in Brazil.' },
                { title: '8. Contact Us', content: 'If you have any questions or concerns about this User Agreement, please contact us at novadrake76@gmail.com' },
            ].map((section, index) => (
                <UserAgreementSection key={index} title={section.title} content={section.content} />
            ))}

            <span className="mt-4">
                By using KaniCasino, you agree to abide by the terms and conditions outlined in this User Agreement.
            </span>
        </div>
    );
}

export default UserAgreement;
