import { useFandomBoardServices } from "./FandomBoard.services";

export interface ChaseRow {
  rank: number;
  userId: string;
  username: string;
  profilePicture: string;
  level: number;
  count: number;
  gap: string;
  me: boolean;
}

export type FandomBoardViewProps = ReturnType<typeof useFandomBoardServices>;
