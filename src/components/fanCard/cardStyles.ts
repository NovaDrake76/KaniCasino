import { FanCardStyleId } from "./cardTypes";

export const PINNED: FanCardStyleId = "pinned";
export const POSTERS: FanCardStyleId[] = ["notice", "funk", "agit", "vhs", "foil"];
export const ALL_STYLES: FanCardStyleId[] = [PINNED, ...POSTERS];

// the posters come with the crown. this mirrors utils/cardStyles.js on the server, which
// is the side that decides: this one only keeps the sheet from offering a locked look.
export const stylesFor = (leadsABoard: boolean): FanCardStyleId[] => (leadsABoard ? [...ALL_STYLES] : [PINNED]);

export const resolveStyle = (chosen: string | null | undefined, open: FanCardStyleId[]): FanCardStyleId =>
  open.includes(chosen as FanCardStyleId) ? (chosen as FanCardStyleId) : PINNED;
