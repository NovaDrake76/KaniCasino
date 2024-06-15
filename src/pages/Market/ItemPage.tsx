import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getItemListings } from "../../services/market/MarketService";
import MarketItem from "./MarketItem";
import Pagination from "../../components/Pagination";
import Skeleton from "react-loading-skeleton";
import { IMarketItem } from "../../components/Types";

interface ItemData {
  totalPages: number;
  currentPage: number;
  items: IMarketItem[];
}

const ItemPage: React.FC = () => {
  const { itemId } = useParams<{ itemId: string }>();
  const [items, setItems] = useState<ItemData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);

  const fetchItemListings = async () => {
    setLoading(true);
    try {
      const items = await getItemListings(itemId as string, page);
      setItems(items);
      setLoading(false);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItemListings();
  }, [page]);

  useEffect(() => {
    fetchItemListings();
  }, [itemId]);

  return (
    <div className="flex flex-col w-screen items-center justify-center">
      <h1 className="text-3xl font-bold mb-6">Item Listings</h1>
      {
        items?.totalPages && items?.totalPages > 1 && (
          <Pagination totalPages={items.totalPages} currentPage={page} setPage={setPage} />
        )
      }
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
        <div className="flex flex-wrap items-center gap-4 justify-center px-8 max-w-[1600px]">
          {items && items.items && items.items.length > 0 ? (items.items.map((item) => (
            <MarketItem
              key={item._id}
              item={item}
              click={() => {}}
              remove={() => {}}
              loadingRemoval={false}
            />
          ))) : (
            <div className="flex flex-col items-center justify-center w-full">
              <h1 className="text-2xl font-bold text-center">
                There are no listings for this item.
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

export default ItemPage;
