import i18n from "../../i18n";
const ContactUs = () => {
    return (
        <div className="p-4">
            <span className="text-2xl font-bold mb-4">{i18n.t("help.contactUs")}</span>

            <p className="text-lg mb-4">
                Have questions or need assistance? Feel free to reach out to us through the following channels:
            </p>

            <div className="mb-4">
                <span className="text-xl font-bold mb-2">{i18n.t("auth.emailShort")}</span>
                <p className="text-lg">
                    Send us an email at <a href="mailto:novadrake76@gmail.com" className="text-blue-500">{i18n.t("help.novadrake76GmailCom")}</a>.
                </p>
            </div>

            <div>
                <span className="text-xl font-bold mb-2">{i18n.t("help.discord")}</span>
                <p className="text-lg">
                    Reach out to us on Discord: <a href="https://discord.com/users/830191630069137459" target="_blank" rel="noopener noreferrer" className="text-blue-500">{i18n.t("help.novadrake76")}</a>.
                </p>
            </div>
        </div>
    );
};

export default ContactUs;
