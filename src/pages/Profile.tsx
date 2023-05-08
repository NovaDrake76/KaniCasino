import { useContext, useEffect, useState } from "react";
import { getUser, getInventory, fixItem } from "../services/users/UserServices";
import UserInfo from "../components/profile/UserInfo";
import Item from "../components/Item";
import UserContext from "../UserContext";

interface User {
  id: number;
  username: string;
  profilePicture: string;
  level: number;
  xp: number;
  fixedItem: {
    name: string;
    image: string;
    rarity: number;
    description: string;
  };
}

interface Inventory {
  items: any[];
}

const Profile = () => {
  const [user, setUser] = useState<User>();
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingInventory, setLoadingInventory] = useState<boolean>(true);
  const [inventory, setInventory] = useState<Inventory>();
  const { userData } = useContext(UserContext);
  const [isSameUser, setIsSameUser] = useState<boolean>(false);
  const [refresh, setRefresh] = useState<boolean>(false);

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

  useEffect(() => {
    if (userData) {
      if (userData.id == id) {
        setIsSameUser(true);
      }
    }
  }, [userData]);

  useEffect(() => {
    if (refresh) {
      getUserInfo();
      getInventoryInfo();
      setRefresh(false);
    }
  }, [refresh]);

  return (
    <div className="flex flex-col items-center w-screen">
      <div className="flex flex-col max-w-[1312px] py-4 w-full">
        {loading ? (
          <div>
            <h1>Loading...</h1>
          </div>
        ) : (
          user && (
            <UserInfo
              user={user}
              isSameUser={isSameUser}
              setRefresh={setRefresh}
            />
          )
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
                  <Item
                    item={item}
                    key={item.name + Math.random()}
                    fixable={isSameUser}
                    setRefresh={setRefresh}
                  />
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
