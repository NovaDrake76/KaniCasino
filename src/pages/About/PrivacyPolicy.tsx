import TermsOfPrivacy from "../../components/modalsChilden/TermsOfPrivacy";

// the routed page and the footer modal render the same document, so the two cannot
// drift apart again
const PrivacyPolicy = () => (
    <div className="flex items-start justify-center w-full px-4 py-8">
        <div className="max-w-3xl w-full">
            <TermsOfPrivacy />
        </div>
    </div>
);

export default PrivacyPolicy;
