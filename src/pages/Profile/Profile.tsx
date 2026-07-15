import { useContext, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { getUser, getInventory } from "../../services/users/UserServices";
import { FiFilter } from 'react-icons/fi'
import UserInfo from "./UserInfo";
import FriendButton from "./FriendButton";
import Item from "../../components/Item";
import UserContext from "../../UserContext";
import Skeleton from "react-loading-skeleton";
import Filters from "../../components/InventoryFilters";
import Pagination from "../../components/Pagination";
import BalanceHistory from "./BalanceHistory";
import CollectionsPanel from "../Collections/CollectionsPanel";
import MissionsPanel from "../Missions/MissionsPanel";
import { User } from '../../components/Types'

interface Inventory {
  totalPages: number;
  currentPage: number;
  items: any[];
}


const Profile = () => {
  const { id } = useParams();
  const [user, setUser] = useState<User>();
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingInventory, setLoadingInventory] = useState<boolean>(true);
  const [inventory, setInventory] = useState<Inventory>();
  const [invItems, setInvItems] = useState<any[]>([]);
  const { userData } = useContext(UserContext);
  const [isSameUser, setIsSameUser] = useState<boolean>(false);
  const [refresh, setRefresh] = useState<boolean>(false);
  const [openFilters, setOpenFilters] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<"inventory" | "collections" | "history" | "missions">("inventory");
  const [filters, setFilters] = useState({
    name: '',
    rarity: '',
    sortBy: 'newer',
    order: 'asc',
  });
  const delayDebounceFn = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (invItems?.length > 0) {
      delayDebounceFn.current = setTimeout(() => {
        getInventoryInfo();
      }, 1000);
      return () => {
        if (delayDebounceFn.current) {
          clearTimeout(delayDebounceFn.current);
        }
      };
    }
  }, [filters]);


  const getUserInfo = async () => {
    try {
      const response = await getUser(id as string);
      setUser(response);
    } catch (error) {
      console.log(error);
    }
    setLoading(false);
  };

  const getInventoryInfo = async (newPage?: boolean) => {
    setLoadingInventory(true);
    try {
      const response = await getInventory(
        id as string,
        page,
        filters
      );
      setInventory(response);
      newPage
        ? setInvItems((prev) => [...prev, ...response.items])
        : setInvItems(response.items);
    } catch (error) {
      console.log(error);
    }
    setLoadingInventory(false);
  };

  const handleEnterPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Cancel the debounce
      clearTimeout(delayDebounceFn.current as NodeJS.Timeout);
      // Fetch the inventory immediately
      getInventoryInfo();
    }
  };

  useEffect(() => {
    setIsSameUser(userData?.id == id);
  }, [id, userData]);

  useEffect(() => {
    if (refresh) {
      getUserInfo();
      getInventoryInfo();
      setRefresh(false);
    }
  }, [refresh]);

  useEffect(() => {
    setInvItems([]);
    setPage(1);
    setActiveTab("inventory");
    getUserInfo();
  }, [id]);

  useEffect(() => {
    getInventoryInfo();
  }, [page, id]);


  const tabs: { key: "inventory" | "collections" | "history" | "missions"; label: string }[] = [
    { key: "inventory", label: "Inventory" },
    { key: "collections", label: "Collections" },
    ...(isSameUser
      ? [
          { key: "missions" as const, label: "Missions" },
          { key: "history" as const, label: "Balance history" },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col items-center w-screen">
      <div className="flex flex-col max-w-[1312px] py-4 w-full">
        {loading ? (
          <div className="flex items-center justify-start pb-7">
            <Skeleton
              circle={true}
              height={144}
              width={144}
              highlightColor="#161427"
              baseColor="#1c1a31"
            />
          </div>
        ) : (
          user && (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <UserInfo
                user={user}
                isSameUser={isSameUser}
                setRefresh={setRefresh}
              />
              <FriendButton profileId={id as string} isSameUser={isSameUser} />
            </div>
          )
        )}
      </div>

      <div className="flex flex-col items-center w-full bg-[#141225] min-h-screen">
        <div className="flex flex-col p-8 gap-2 items-center w-full max-w-[1312px]">
          <div className="w-full flex justify-center mb-6">
            <div className="inline-flex gap-1 bg-[#19172d] border border-[#2a2840] rounded-xl p-1 max-w-full overflow-x-auto">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`shrink-0 whitespace-nowrap px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === t.key
                      ? "bg-[#281d3f] text-white shadow"
                      : "text-[#84819a] hover:text-white hover:bg-[#221f38]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "history" ? (
            <BalanceHistory />
          ) : activeTab === "missions" ? (
            <MissionsPanel userId={id as string} isOwner={isSameUser} />
          ) : activeTab === "collections" ? (
            <CollectionsPanel userId={id as string} isOwner={isSameUser} />
          ) : (
          <>
          <div className="flex flex-col w-full items-end mr-[70px] gap-4 -mt-10">
            <div onClick={() => setOpenFilters(!openFilters)} className="border p-2 rounded-md cursor-pointer">
              <FiFilter className="text-2xl " />
            </div>
            {openFilters && <Filters filters={filters} setFilters={setFilters} onKeyPress={handleEnterPress} />}

          </div>
          {inventory &&
            inventory.totalPages > 1 &&
            (
              <Pagination totalPages={inventory.totalPages} currentPage={inventory.currentPage} setPage={setPage} />
            )}
          <div className="flex flex-wrap gap-6  justify-center ">

            {loadingInventory ? (
              { array: Array(12).fill(0) }.array.map((_, i) => (
                <Skeleton
                  width={176}
                  height={216}
                  highlightColor="#161427"
                  baseColor="#1c1a31"
                  key={i}
                />
              ))
            ) : invItems && Object.keys(invItems).length > 0 ? (
              invItems.map((item: any, i: number) => (
                <Item
                  item={item}
                  key={item?.name + i}
                  fixable={isSameUser}
                  sellable={isSameUser}
                  setRefresh={setRefresh}
                />
              ))
            ) : (
              <h2>No items</h2>
            )}
          </div>
          {inventory &&
            inventory.totalPages > 1 &&
            (
              <Pagination totalPages={inventory.totalPages} currentPage={inventory.currentPage} setPage={setPage} />
            )}
          </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;