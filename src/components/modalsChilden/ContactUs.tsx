const ContactUs = () => {
    return (
        <div className="p-4">
            <span className="text-2xl font-bold mb-4">Contact Us</span>

            <p className="text-lg mb-4">
                Have questions or need assistance? Feel free to reach out to us through the following channels:
            </p>

            <div className="mb-4">
                <span className="text-xl font-bold mb-2">Email</span>
                <p className="text-lg">
                    Send us an email at <a href="mailto:novadrake76@gmail.com" className="text-blue-500">novadrake76@gmail.com</a>.
                </p>
            </div>

            <div>
                <span className="text-xl font-bold mb-2">Discord</span>
                <p className="text-lg">
                    Reach out to us on Discord: <a href="https://discord.com/users/830191630069137459" target="_blank" rel="noopener noreferrer" className="text-blue-500">novadrake76</a>.
                </p>
            </div>
        </div>
    );
};

export default ContactUs;
