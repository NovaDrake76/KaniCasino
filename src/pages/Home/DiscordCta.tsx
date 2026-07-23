const DiscordCta = () => {
  const discordURL = import.meta.env.VITE_DISCORD_INVITE;
  if (!discordURL) return null;

  return (
    <div className="flex items-center justify-center w-full py-6">
      <div className="w-full max-w-md pt-6 border-t border-white/20 mt-2 ">
        <p className="text-sm font-bold opacity-90 mb-3 uppercase tracking-wider text-center w-full ">
          Want to discuss the game?
        </p>
        <a
          href={discordURL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-3 bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all hover:-translate-y-0.5 group w-full"
        >
          <svg
            className="w-6 h-6 fill-current group-hover:scale-110 transition-transform"
            viewBox="0 0 127.14 96.36"
          >
            <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c1.24-23.28-3.28-47.56-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
          </svg>
          Join our Discord
        </a>
      </div>
    </div>
  );
};

export default DiscordCta;
