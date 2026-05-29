import { useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import UserContext from "../../UserContext";
import {
  getFriendStatus,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
} from "../../services/users/UserServices";

interface Props {
  profileId: string;
  isSameUser: boolean;
}

const FriendButton: React.FC<Props> = ({ profileId, isSameUser }) => {
  const { isLogged } = useContext(UserContext);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    try {
      const data = await getFriendStatus(profileId);
      setStatus(data.status);
    } catch (error) {
      setStatus(null);
    }
  };

  useEffect(() => {
    if (isLogged && !isSameUser && profileId) {
      loadStatus();
    }
  }, [isLogged, isSameUser, profileId]);

  if (!isLogged || isSameUser || !status || status === "self") {
    return null;
  }

  const run = async (action: () => Promise<any>, successStatus: string, message: string) => {
    setLoading(true);
    try {
      await action();
      setStatus(successStatus);
      toast.success(message, { theme: "dark" });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Something went wrong", { theme: "dark" });
      loadStatus();
    }
    setLoading(false);
  };

  const baseClass = "px-4 py-2 rounded font-semibold transition-all disabled:opacity-50";

  if (status === "friends") {
    return (
      <button
        className={`${baseClass} bg-[#281D3F] hover:bg-red-600`}
        disabled={loading}
        onClick={() => run(() => removeFriend(profileId), "none", "Friend removed")}
      >
        Friends ✓
      </button>
    );
  }

  if (status === "requested") {
    return (
      <button className={`${baseClass} bg-[#281D3F] cursor-default`} disabled>
        Request sent
      </button>
    );
  }

  if (status === "incoming") {
    return (
      <div className="flex gap-2">
        <button
          className={`${baseClass} bg-indigo-600 hover:bg-indigo-700`}
          disabled={loading}
          onClick={() => run(() => acceptFriendRequest(profileId), "friends", "Friend request accepted")}
        >
          Accept request
        </button>
        <button
          className={`${baseClass} bg-[#281D3F] hover:bg-red-600`}
          disabled={loading}
          onClick={() => run(() => declineFriendRequest(profileId), "none", "Request declined")}
        >
          Decline
        </button>
      </div>
    );
  }

  return (
    <button
      className={`${baseClass} bg-indigo-600 hover:bg-indigo-700`}
      disabled={loading}
      onClick={() => run(() => sendFriendRequest(profileId), "requested", "Friend request sent")}
    >
      Add Friend
    </button>
  );
};

export default FriendButton;
