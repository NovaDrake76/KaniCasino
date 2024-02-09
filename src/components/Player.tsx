import { useRef, useState } from "react";
import Avatar from "./Avatar";
import { User } from "../components/Types";
import PlayerPreview from "./PlayerPreview";
import { Link } from "react-router-dom";

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
            {
                showPreview && (
                    <div className='absolute'>
                        <PlayerPreview player={user} />
                    </div>
                )
            }
            <Link to={`/profile/${user._id}`}>
                <div className={`flex items-center justify-center text-white ${direction == "row" ? "gap-4" : "flex-col"}`}>
                    <Avatar id={user._id} image={user.profilePicture} size={size} showLevel={!!showLevel} level={user.level} />
                    <span className="mt-2 font-semibold ">{user.username}</span>
                </div>
            </Link>
        </div>
    )
}

export default Player;

