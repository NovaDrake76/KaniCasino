// what the tour waits for, as plain window events: the page that causes one needs no idea a
// tour exists
export const JAR_TAKEN_EVENT = "daisu:jar-taken";
export const CASE_REVEALED_EVENT = "case:revealed";
export const GAME_RESULT_EVENT = "game:result";
export const DAISU_STAGE_EVENT = "daisu:stage";
export const ITEM_PINNED_EVENT = "item:pinned";
export const ITEM_SOLD_EVENT = "item:sold";
export const SHOP_OPEN_EVENT = "daisu:shop";
export const CHAT_OPEN_EVENT = "chat:open";
export const DAISU_POKED_EVENT = "daisu:poked";

export interface RevealedItem {
  name: string;
  rarity: string | number;
  sellValue?: number;
}

export interface GameResult {
  game: string;
  wagered: number;
  payout: number;
}

const emit = (name: string, detail?: unknown) => window.dispatchEvent(new CustomEvent(name, { detail }));

export const emitJarTaken = () => emit(JAR_TAKEN_EVENT);
export const emitCaseRevealed = (items: RevealedItem[]) => emit(CASE_REVEALED_EVENT, { items });
export const emitGameResult = (result: GameResult) => emit(GAME_RESULT_EVENT, result);
export const showDaisu = (stage: "bubble" | "popup" | "room") => emit(DAISU_STAGE_EVENT, stage);
export const emitItemPinned = () => emit(ITEM_PINNED_EVENT);
export const emitItemSold = () => emit(ITEM_SOLD_EVENT);
// her room on the shop, on one item's card when a key is given
export const openDaisuShop = (key?: string) => emit(SHOP_OPEN_EVENT, key);
export const openChat = () => emit(CHAT_OPEN_EVENT);
export const emitPoked = () => emit(DAISU_POKED_EVENT);
