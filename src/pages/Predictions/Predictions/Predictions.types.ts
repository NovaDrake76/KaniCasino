import { Market } from "../../../services/predictions/PredictionService";

export type StatusFilter = "open" | "closed" | "resolved" | "all";

export interface PredictionsViewProps {
  markets: Market[];
  loading: boolean;
  categories: string[];
  category: string;
  setCategory: (category: string) => void;
  status: StatusFilter;
  setStatus: (status: StatusFilter) => void;
  search: string;
  setSearch: (search: string) => void;
  page: number;
  totalPages: number;
  setPage: (page: number) => void;
  openMarket: (slug: string) => void;
}
