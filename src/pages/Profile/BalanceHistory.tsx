import { useEffect, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { getTransactions } from "../../services/users/UserServices";
import Monetary from "../../components/Monetary";
import Pagination from "../../components/Pagination";

interface Transaction {
  _id: string;
  type: string;
  direction: "credit" | "debit";
  amount: number;
  balanceAfter?: number;
  meta?: any;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  signup: "Welcome bonus",
  bonus: "Claimed bonus",
  case_open: "Opened case",
  slot_bet: "Slot spin",
  slot_win: "Slot win",
  crash_bet: "Crash bet",
  crash_cashout: "Crash cashout",
  coinflip_bet: "Coin flip bet",
  coinflip_win: "Coin flip win",
  battle_entry: "Battle entry",
  battle_refund: "Battle refund",
  market_buy: "Marketplace purchase",
  market_sale: "Marketplace sale",
  market_order: "Buy order placed",
  market_order_refund: "Buy order refunded",
  item_sell: "Sold to shop",
  admin_adjust: "Admin adjustment",
  mission_reward: "Mission reward",
};

const describe = (tx: Transaction): string => {
  const base = TYPE_LABELS[tx.type] || tx.type;
  const m = tx.meta || {};
  if (tx.type === "market_buy" && m.reversal) return "Purchase reversed";
  if (tx.type === "case_open" && m.caseTitle) {
    return `Opened ${m.caseTitle}${m.quantity > 1 ? ` x${m.quantity}` : ""}`;
  }
  if ((tx.type === "market_buy" || tx.type === "market_sale") && m.itemName) {
    return `${base}: ${m.itemName}`;
  }
  if (tx.type === "item_sell" && m.count) {
    return `Sold ${m.count} item${m.count > 1 ? "s" : ""} to shop`;
  }
  if (tx.type === "mission_reward" && m.missionTitle) {
    return `Mission reward: ${m.missionTitle}`;
  }
  if ((tx.type === "market_order" || tx.type === "market_order_refund") && m.itemName) {
    return `${base}: ${m.itemName}`;
  }
  return base;
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

const BalanceHistory: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getTransactions(page)
      .then((data) => {
        if (!active) return;
        setTransactions(data.transactions || []);
        setTotalPages(data.totalPages || 1);
      })
      .catch((error) => console.log(error))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page]);

  return (
    <div className="w-full max-w-[900px] flex flex-col gap-2">
      {loading ? (
        [1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Skeleton key={i} height={64} baseColor="#1c1a31" highlightColor="#161427" />
        ))
      ) : transactions.length === 0 ? (
        <div className="text-center text-[#84819a] py-12">No transactions yet.</div>
      ) : (
        transactions.map((tx) => {
          const credit = tx.direction === "credit";
          return (
            <div
              key={tx._id}
              className="flex items-center justify-between gap-3 bg-[#212031] rounded-lg px-4 py-3"
            >
              <div className="flex flex-col min-w-0">
                <span className="font-semibold truncate">{describe(tx)}</span>
                <span className="text-xs text-[#84819a]">{formatDate(tx.createdAt)}</span>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className={`font-bold ${credit ? "text-green-400" : "text-red-400"}`}>
                  {credit ? "+" : "-"}
                  <Monetary value={tx.amount} />
                </span>
                {typeof tx.balanceAfter === "number" && (
                  <span className="text-xs text-[#84819a] flex items-center gap-1">
                    balance <Monetary value={tx.balanceAfter} />
                  </span>
                )}
              </div>
            </div>
          );
        })
      )}
      {totalPages > 1 && (
        <div className="flex justify-center mt-3">
          <Pagination totalPages={totalPages} currentPage={page} setPage={setPage} />
        </div>
      )}
    </div>
  );
};

export default BalanceHistory;
