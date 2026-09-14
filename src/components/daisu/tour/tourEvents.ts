// what the tour waits for, as plain window events: the page that causes one needs no idea a
// tour exists
export const JAR_TAKEN_EVENT = "daisu:jar-taken";
export const CASE_REVEALED_EVENT = "case:revealed";
export const GAME_RESULT_EVENT = "game:result";
export const DAISU_STAGE_EVENT = "daisu:stage";

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
