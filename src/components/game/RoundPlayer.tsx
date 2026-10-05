import { useRef, useState } from "react";
import PlayerPreview from "../PlayerPreview";
import Avatar from "../Avatar";

interface RoundPlayerProps {
  id: string;
  player: { username: string; profilePicture?: string; level?: number };
}

// a player in a live round's bet list: their avatar and name, with their card after a short hover
const RoundPlayer = ({ id, player }: RoundPlayerProps) => {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enter = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 500);
  };
  const leave = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <div className="relative" onMouseEnter={enter} onMouseLeave={leave}>
      {open && <PlayerPreview player={player as never} />}
      <a href={`/profile/${id}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-white">
        <Avatar image={player.profilePicture || ""} id={id} size="small" level={player.level || 0} noLink />
        <span className="truncate text-sm font-semibold">{player.username}</span>
      </a>
    </div>
  );
};

export default RoundPlayer;
