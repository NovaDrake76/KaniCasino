import { useFandomServices } from "./Fandom.services";

export type FandomTab = "contested" | "biggest" | "open" | "reach" | "collectors";

export interface BoardCard {
  name: string;
  image: string;
  color: string;
  fansLabel: string;
  holder: string | null;
  holderId: string | null;
  holderPicture: string;
  count: number;
  contested: boolean;
}

export interface ReachCard {
  name: string;
  image: string;
  color: string;
  caseId: string | null;
  mine: number;
  leader: number;
  headline: string;
  headlineLabel: string;
  standing: string;
  pct: number;
  claimable: boolean;
}

export type FandomViewProps = ReturnType<typeof useFandomServices>;
