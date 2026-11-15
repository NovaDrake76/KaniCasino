import { createContext, useContext } from "react";
import { BoardFeed, PotFeed } from "./HomeFeed.types";

export const POT_LOADING: PotFeed = { status: "loading", pot: null, skew: 0 };
export const BOARD_LOADING: BoardFeed = { status: "loading", board: null, skew: 0 };

// without the provider there is nothing to read, so a reader outside the home page waits and never asks the server itself
export const PotFeedContext = createContext<PotFeed>(POT_LOADING);
export const BoardFeedContext = createContext<BoardFeed>(BOARD_LOADING);

export const useHomePot = () => useContext(PotFeedContext);
export const useHomeBoard = () => useContext(BoardFeedContext);
