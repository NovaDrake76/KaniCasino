import { useOrderBook } from "./OrderBook.services";
import OrderBookView from "./OrderBook.view";

const OrderBook = () => {
  const service = useOrderBook();
  return <OrderBookView {...service} />;
};

export default OrderBook;
