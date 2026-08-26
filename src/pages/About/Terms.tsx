import UserAgreement from "../../components/modalsChilden/UserAgreement";

// the routed page and the footer modal render the same document, so the two cannot
// drift apart. discord's bot verification wants a url rather than a modal.
const Terms = () => (
    <div className="flex items-start justify-center w-full px-4 py-8">
        <div className="max-w-3xl w-full">
            <UserAgreement />
        </div>
    </div>
);

export default Terms;
