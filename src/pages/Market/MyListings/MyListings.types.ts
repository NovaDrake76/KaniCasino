import { useMyListings } from "./MyListings.services";

export interface MyListingsProps {
  onChanged: () => void;
}

export type MyListingsViewProps = ReturnType<typeof useMyListings>;
