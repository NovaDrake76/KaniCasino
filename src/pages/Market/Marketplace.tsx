import React, { useContext, useEffect, useState } from "react";
import MarketItem from "./MarketItem";
import { getItems } from "../../services/market/MarketService";
import SellItemModal from "./SellItemModal";
import MainButton from "../../components/MainButton";
import Title from "../../components/Title";
import Skeleton from "react-loading-skeleton";
import UserContext from "../../UserContext";
import Pagination from "../../components/Pagination";
import Filters from "./Filters";


interface Props {

    image: string;
    name: string;
    rarity: number;
    _id: string;
    uniqueId: string
    cheapestPrice: number;
    totalListings: number;
  
}


interface ItemData {
  totalPages: number;
  currentPage: number;
  items: Props[];
}

const Marketplace: React.FC = () => {
  const [items, setItems] = useState<ItemData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [openSellModal, setOpenSellModal] = useState<boolean>(false);
  const [refresh, setRefresh] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [filters, setFilters] = useState({
    name: '',
    rarity: '',
    sortBy: '',
    order: 'asc'
  });

  const { isLogged } = useContext(UserContext);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const items = await getItems(page, filters);
      setItems(items);
      setLoading(false);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (refresh) {
      fetchItems();
      setRefresh(false);
    }
  }, [refresh]);

  useEffect(() => {
    setRefresh(true);
    scrollTo(0, 0);
  }, [page]);

  useEffect(() => {
    fetchItems();
  }, [filters]);

  return (
    <div className="flex flex-col w-screen items-center justify-center ">
      <SellItemModal
        isOpen={openSellModal}
        onClose={() => setOpenSellModal(false)}
        setRefresh={setRefresh}
      />
      <div className="flex items-center justify-center w-full max-w-[1600px] relative ">
        <Title title="Marketplace" />

        <div className="absolute md:right-24 -top-6 md:top-0">
          {isLogged && (
            <div className="w-52">

              <MainButton
                onClick={() => setOpenSellModal(true)}
                text="Sell an item"
              />
            </div>
          )}
        </div>
      </div>
      {
        items?.totalPages && items?.totalPages > 1 && (
          <Pagination totalPages={items.totalPages} currentPage={page} setPage={setPage} />
        )
      }
            <Filters filters={filters} setFilters={setFilters} />

      {loading ? (
        <div className="flex flex-wrap items-center gap-4 justify-center px-8 ">
          {Array(10)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="w-[226px] h-[334px]  ">
                <Skeleton height={334} width={226} />
              </div>
            ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4 justify-center px-8  max-w-[1600px]">
          {items && items.items && items.items.length > 0 ? (items.items.map((item) => (
            <MarketItem
              key={item._id}
              item={item}
        
            />
          ))) : (
            <div className="flex flex-col items-center justify-center w-full">
              <h1 className="text-2xl font-bold text-center">
                There's no items for sale, try again later
              </h1>
            </div>
          )}
        </div>
      )}
      {
        items?.totalPages && items?.totalPages > 1 && (
          <Pagination totalPages={items.totalPages} currentPage={page} setPage={setPage} />
        )
      }
    </div>
  );
};

export default Marketplace;
