import { useRef, useState } from "react";
import Avatar from "./Avatar";
import { User } from "../components/Types";
import PlayerPreview from "./PlayerPreview";
import { Link } from "react-router-dom";

interface Player {
    user: User
    size: "small" | "medium" | "large" | "extra-large"
}

const Player: React.FC<Player> = ({ user, size }) => {
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
                <div className='flex items-center justify-center gap-4 text-white'>
                    <Avatar id={user._id} image={user.profilePicture} size={size} showLevel={true} level={user.level} />
                    <span className="mt-2 font-semibold">{user.username}</span>
                </div>
            </Link>
        </div>
    )
}

export default Player;

