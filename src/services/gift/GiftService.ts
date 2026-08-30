import api from "../api";

export interface GiftSlot {
  caseId: string;
  title: string;
  image: string;
  price: number;
  opens: number;
  value: number;
  chance: number;
}

export interface GiftCategory {
  category: string;
  cover: string;
  eligible: number;
  expectedValue: number;
  slots: GiftSlot[];
}

export interface TopSlotRung {
  multiplier: number;
  minLevel: number;
  locked: boolean;
  chance: number;
}

export interface GiftGrant {
  grantId: string;
  caseId: string;
  title: string;
  image: string;
  remaining: number;
  expiresAt: string;
}

export interface GiftState {
  level: number;
  streak: number;
  streakTilt: number;
  maxStreakTilt: number;
  topSlot: TopSlotRung[];
  topSlotAverage: number;
  streakMax: number;
  rareBoost: number;
  atBestStreak: { rareBoost: number; topSlotAverage: number };
  canSpin: boolean;
  nextAt: string | null;
  categories: GiftCategory[];
  grants: GiftGrant[];
}

export interface SpinResult {
  category: string;
  won: { caseId: string; title: string; image: string; opens: number; value: number };
  topSlot: { multiplier: number; hit: boolean };
  opens: number;
  grantId: string;
  grantRemaining: number;
  expiresAt: string;
  streak: number;
  state: GiftState;
}

export const getGift = async (): Promise<GiftState> => (await api.get("/gift")).data;

// fired the moment a spin is claimed, so the navbar badge can go dark without a reload
export const GIFT_CLAIMED_EVENT = "kani.giftClaimed";

export interface GiftStatus {
  canSpin: boolean;
  nextAt: string | null;
  streak: number;
  // what taking this spin would put them on, which is what there is to lose by skipping it
  nextStreak: number;
  keepsStreak: boolean;
}

export const getGiftStatus = async (): Promise<GiftStatus> => (await api.get("/gift/status")).data;

export const getGrants = async (caseId?: string): Promise<GiftGrant[]> =>
  (await api.get("/gift/grants", { params: caseId ? { caseId } : {} })).data;

export const spinGift = async (category: string): Promise<SpinResult> => {
  const result = (await api.post("/gift/spin", { category })).data;
  window.dispatchEvent(new Event(GIFT_CLAIMED_EVENT));
  return result;
};
