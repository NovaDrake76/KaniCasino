import { useEffect, useState } from "react";
import { getUser } from "../services/users/UserServices";
import UserInfo from "../components/profile/UserInfo";

interface User {
  id: number;
  username: string;
  profilePicture: string;
  level: number;
  xp: number;
}

const Profile = () => {
  const [user, setUser] = useState<User>();
  const [loading, setLoading] = useState<boolean>(true);

  //get id from url
  const id = window.location.pathname.split("/")[2];

  useEffect(() => {
    getUserInfo();
  }, []);

  const getUserInfo = async () => {
    try {
      const response = await getUser(id);
      setUser(response);
    } catch (error) {
      console.log(error);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center w-screen">
      <div className="flex flex-col max-w-[1312px] py-4 w-full">
        {loading ? (
          <div>
            <h1>Loading...</h1>
          </div>
        ) : (
          user && <UserInfo user={user} />
        )}
      </div>
    </div>
  );
};

export default Profile;
