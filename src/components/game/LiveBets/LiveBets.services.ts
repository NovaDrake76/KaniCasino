import { useEffect, useState } from "react";
import { LiveBet, subscribeToLiveBets } from "../../../services/liveFeed/LiveFeedService";

// what the table shows at once. the server keeps more than this so a joiner is never
// handed an empty table, but a game page only has room for a strip.
const SHOWN = 8;

export const useLiveBetsServices = () => {
  const [rows, setRows] = useState<LiveBet[]>([]);

  useEffect(() => {
    return subscribeToLiveBets(
      (batch) => setRows((batch || []).slice(0, SHOWN)),
      // a row already on screen must not double up if the socket redelivers it
      (row) => setRows((prev) => [row, ...prev.filter((r) => r.id !== row.id)].slice(0, SHOWN))
    );
  }, []);

  return { rows };
};
