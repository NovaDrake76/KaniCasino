import { useEffect, useState } from "react";
import { getUser, getInventory } from "../services/users/UserServices";
import UserInfo from "../components/profile/UserInfo";
import Item from "../components/Item";

interface User {
  id: number;
  username: string;
  profilePicture: string;
  level: number;
  xp: number;
}

interface Inventory {
  items: any[];
}

const Profile = () => {
  const [user, setUser] = useState<User>();
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingInventory, setLoadingInventory] = useState<boolean>(true);
  const [inventory, setInventory] = useState<Inventory>();

  //get id from url
  const id = window.location.pathname.split("/")[2];

  useEffect(() => {
    getUserInfo();
    getInventoryInfo();
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

  const getInventoryInfo = async () => {
    try {
      const response = await getInventory(id);
      setInventory(response);
    } catch (error) {
      console.log(error);
    }
    setLoadingInventory(false);
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
      {loadingInventory ? (
        <div>
          <h1>Loading...</h1>
        </div>
      ) : (
        <div className="flex flex-col items-center w-full bg-[#141225]">
          <div className="flex flex-col p-8 gap-2 items-center max-w-[1312px]">
            <h2 className="text-2xl font-bold py-4">Inventory</h2>
            <div className="flex flex-wrap gap-6  justify-center ">
              {inventory && inventory.items.length > 0 ? (
                inventory.items.map((item: any) => (
                  <Item item={item} key={item.name} />
                ))
              ) : (
                <h2>No items</h2>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
