import { useContext, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
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
import AffiliatesPanel from "../Affiliates/AffiliatesPanel";
import { resolveTab, Tab } from "./tabs";
import { User } from '../../components/Types'

interface Inventory {
  totalPages: number;
  currentPage: number;
  items: any[];
}

// tabs that show a "NEW!" badge until the owner opens them for the first time
const NEW_TABS = ["collections", "missions", "affiliates"];

const Profile = () => {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const activeTab = resolveTab(searchParams.get("tab"), isSameUser);
  const [seenTabs, setSeenTabs] = useState<string[]>([]);
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
    getUserInfo();
  }, [id]);

  // load which "new" tabs this user has already opened (per user, per browser)
  useEffect(() => {
    if (!userData?.id) return;
    try {
      setSeenTabs(JSON.parse(localStorage.getItem(`kani.tabSeen.${userData.id}`) || "[]"));
    } catch {
      setSeenTabs([]);
    }
  }, [userData?.id]);

  // opening a new tab (by click or deep-link) clears its badge for good
  useEffect(() => {
    if (!userData?.id || !isSameUser) return;
    if (!NEW_TABS.includes(activeTab) || seenTabs.includes(activeTab)) return;
    const next = [...seenTabs, activeTab];
    setSeenTabs(next);
    localStorage.setItem(`kani.tabSeen.${userData.id}`, JSON.stringify(next));
  }, [activeTab, isSameUser, userData?.id, seenTabs]);

  useEffect(() => {
    getInventoryInfo();
  }, [page, id]);


  const tabs: { key: Tab; label: string }[] = [
    { key: "inventory", label: "Inventory" },
    { key: "collections", label: "Collections" },
    ...(isSameUser
      ? [
          { key: "missions" as const, label: "Missions" },
          { key: "affiliates" as const, label: "Affiliates" },
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
        <div className="flex flex-col p-4 md:p-8 gap-2 items-center w-full max-w-[1312px]">
          <div className="w-full flex justify-center mb-8">
            <div className="w-full max-w-[1100px] border-b border-line">
              <div className="flex gap-6 md:gap-8 overflow-x-auto pt-3">
                {tabs.map((t) => {
                  const active = activeTab === t.key;
                  const isNew =
                    isSameUser && NEW_TABS.includes(t.key) && !seenTabs.includes(t.key);
                  return (
                    <button
                      key={t.key}
                      onClick={() => {
                        // re-clicking the open tab must not throw away the case and item
                        // params below it. a literal rebuilds from scratch, so switching
                        // tabs drops them, which is what unmounting did before anyway.
                        if (activeTab === t.key) return;
                        setSearchParams({ tab: t.key }, { replace: true });
                      }}
                      className={`relative shrink-0 whitespace-nowrap pb-3 text-sm font-bold uppercase tracking-wider transition-colors ${
                        active ? "text-white" : "text-[#84819a] hover:text-white"
                      }`}
                    >
                      {t.label}
                      {isNew && (
                        <span className="absolute -top-2 -right-2 flex items-center rounded-full bg-accent-gold px-1.5 py-0.5 text-[9px] font-extrabold uppercase leading-none text-black shadow animate-pulse">
                          New
                        </span>
                      )}
                      <span
                        className={`absolute left-0 right-0 -bottom-px h-[3px] transition-all ${
                          active ? "bg-[#e5308c]" : "bg-transparent"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {activeTab === "history" ? (
            <BalanceHistory />
          ) : activeTab === "missions" ? (
            <MissionsPanel userId={id as string} isOwner={isSameUser} />
          ) : activeTab === "affiliates" ? (
            <AffiliatesPanel isOwner={isSameUser} />
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