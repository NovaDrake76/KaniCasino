import { useBattlesServices } from "./Battles.services";

export interface CaseInfo {
  _id: string;
  title: string;
  image: string;
  price: number;
}

export type BattlesViewProps = ReturnType<typeof useBattlesServices>;
