import { useRef, useState } from "react";
import Avatar from "./Avatar";
import { User } from "../components/Types";
import PlayerPreview from "./PlayerPreview";
import { Link } from "react-router-dom";
import Badge from "./Badge";

// the badge rides the avatar rather than the name, which wrapped to two lines on the
// podium and left it floating. the level chip already owns the bottom-right corner.
const BADGE_AT: Record<string, string> = {
    small: "-top-1 -right-1",
    medium: "-top-1 -right-1",
    large: "top-1 right-1",
    "extra-large": "top-2 right-2",
};
const BADGE_SIZE: Record<string, "inline" | "large"> = {
    small: "inline",
    medium: "inline",
    large: "large",
    "extra-large": "large",
};

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
                    <span className="relative shrink-0">
                        <Avatar id={user._id} image={user.profilePicture} size={size} showLevel={!!showLevel} level={user.level} noLink />
                        <span className={`absolute ${BADGE_AT[size]}`}>
                            <Badge badge={user.badge} linked={false} hoverCard={false} size={BADGE_SIZE[size]} />
                        </span>
                    </span>
                    <span className="mt-2 font-semibold text-center">{user.username}</span>
                </div>
            </Link>
        </div>
    )
}

export default Player;

