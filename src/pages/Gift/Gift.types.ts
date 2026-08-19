import type { BasicItem } from "../../components/Types";
import type {
  GiftCategory,
  GiftGrant,
  GiftSlot,
  GiftState,
  SpinResult,
  TopSlotRung,
} from "../../services/gift/GiftService";

export type { GiftCategory, GiftGrant, GiftSlot, GiftState, SpinResult, TopSlotRung };

// picker -> the chosen category with its odds -> the reel -> what it paid
export type GiftStage = "picking" | "charging" | "spinning" | "won";

export interface GiftViewProps {
  loading: boolean;
  state: GiftState | null;
  stage: GiftStage;
  category: GiftCategory | null;
  reel: BasicItem[];
  landing: BasicItem | null;
  spinning: boolean;
  pending: boolean;
  result: SpinResult | null;
  onPick: (category: string) => void;
  onBack: () => void;
  onSpin: () => void;
  onOpen: (caseId: string) => void;
}
