import { useRef, useState } from "react";
import Avatar from "./Avatar";
import { User } from "../components/Types";
import PlayerPreview from "./PlayerPreview";
import { Link } from "react-router-dom";
import Badge from "./Badge";

interface Player {
    user: User
    size: "small" | "medium" | "large" | "extra-large"
    direction?: "row" | "column",
    showLevel?: boolean
}

const Player: React.FC<Player> = ({ user, size, direction = "row", showLevel = "true" }) => {
    const [showPreview, setShowPreview] = useState<boolean>(false);
    const hoverTimeoutRef = useRef<any>(null);

    const handleMouseEnter = () => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }

        hoverTimeoutRef.current = setTimeout(() => {
            setShowPreview(true);
        }, 500);
    };

    const handleMouseLeave = () => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }
        setShowPreview(false);
    };

    return (
        <div
            onMouseEnter={() => handleMouseEnter()}
            onMouseLeave={handleMouseLeave}
        >
            {showPreview && <PlayerPreview player={user} />}
            <Link to={`/profile/${user._id}`}>
                <div className={`flex items-center justify-center text-white ${direction == "row" ? "gap-4" : "flex-col"}`}>
                    <Avatar id={user._id} image={user.profilePicture} size={size} showLevel={!!showLevel} level={user.level} noLink />
                    <span className="mt-2 flex items-center gap-1.5 font-semibold text-center">
                        <Badge badge={user.badge} linked={false} hoverCard={false} />
                        {user.username}
                    </span>
                </div>
            </Link>
        </div>
    )
}

export default Player;

