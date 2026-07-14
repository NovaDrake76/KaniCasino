import api from "../api";

export interface CollectionSummaryItem {
  caseId: string;
  title: string;
  image: string;
  price: number;
  slotsTotal: number;
  slotsOwned: number;
  completionPct: number;
  duplicatesValue: number;
  duplicatesCount: number;
  complete: boolean;
}

export interface CollectionsSummary {
  userId: string;
  totals: {
    cases: number;
    casesComplete: number;
    slotsTotal: number;
    slotsOwned: number;
    completionPct: number;
    duplicatesValue: number;
    duplicatesCount: number;
  };
  collections: CollectionSummaryItem[];
}

export interface AlbumItem {
  _id: string;
  name: string;
  image: string;
  rarity: string;
  baseValue: number;
  sellValue: number;
  owned: number;
  duplicates: number;
  duplicateValue: number;
  status: "owned" | "missing";
  inCase: boolean;
  uniqueIds: string[];
}

export interface CollectionDetail {
  caseId: string;
  title: string;
  image: string;
  price: number;
  slotsTotal: number;
  slotsOwned: number;
  completionPct: number;
  duplicatesValue: number;
  duplicatesCount: number;
  currentPage: number;
  totalPages: number;
  items: AlbumItem[];
  extras: AlbumItem[];
}

export interface QuicksellLine {
  _id: string;
  name: string;
  image: string;
  rarity: string;
  owned: number;
  sellCount: number;
  unitSellValue: number;
  lineValue: number;
}

export interface QuicksellPreview {
  caseId: string;
  lines: QuicksellLine[];
  totalItems: number;
  totalValue: number;
  plan: string[];
}

export interface QuicksellResult {
  changed: boolean;
  // when changed === false (the sale went through)
  sold?: number;
  value?: number;
  walletBalance?: number;
  // when changed === true, the fresh preview is returned inline
  caseId?: string;
  lines?: QuicksellLine[];
  plan?: string[];
  totalItems?: number;
  totalValue?: number;
}

export async function getCollectionsSummary(userId: string): Promise<CollectionsSummary> {
  const res = await api.get(`/collections/summary`, { params: { userId } });
  return res.data;
}

export async function getCollection(
  caseId: string,
  userId: string,
  opts: { page?: number; filter?: string; sortBy?: string } = {}
): Promise<CollectionDetail> {
  const res = await api.get(`/collections/${caseId}`, { params: { userId, ...opts } });
  return res.data;
}

export async function previewQuicksell(caseId: string): Promise<QuicksellPreview> {
  const res = await api.post(`/collections/quicksell/preview`, { caseId });
  return res.data;
}

export async function commitQuicksell(caseId: string, plan: string[]): Promise<QuicksellResult> {
  const res = await api.post(`/collections/quicksell/commit`, { caseId, plan });
  return res.data;
}
