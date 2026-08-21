import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TableView from "./Table.view";
import { rotate } from "./Table.services";
import { TableServices, ViewTable } from "./Table.types";
import UserContext from "../../../UserContext";

vi.mock("framer-motion", async () => {
  const react = await import("react");
  const passthrough = new Proxy(
    {},
    {
      get:
        (_t, tag: string) =>
        ({ children, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) =>
          react.createElement(tag, { ...rest, initial: undefined, animate: undefined, exit: undefined, layout: undefined, transition: undefined }, children),
    }
  );
  return { motion: passthrough, AnimatePresence: ({ children }: { children: React.ReactNode }) => children };
});

const seat = (over: Partial<ViewTable["seats"][0]> = {}) => ({
  seat: 0,
  userId: null,
  username: "",
  profilePicture: "",
  stack: 0,
  committed: 0,
  totalCommitted: 0,
  status: "empty" as const,
  leaveAfterHand: false,
  holeCards: null,
  ...over,
});

const table = (over: Partial<ViewTable> = {}): ViewTable => ({
  _id: "t1",
  slug: "hakurei-1",
  name: "Hakurei Shrine",
  seatCount: 6,
  smallBlind: 5,
  bigBlind: 10,
  minBuyIn: 200,
  maxBuyIn: 2000,
  handNumber: 3,
  button: 0,
  status: "betting",
  street: "flop",
  board: [12, 25, 38],
  pots: [{ amount: 120, eligible: [0, 1] }],
  currentBet: 20,
  minRaise: 10,
  toAct: 0,
  actionDeadline: null,
  actionSeq: 9,
  pfServerSeedHash: "abc",
  pool: [],
  atRisk: [],
  yourSeat: 0,
  legal: [],
  seats: [
    seat({ seat: 0, userId: "u1", username: "Nathan", stack: 500, status: "active", holeCards: [0, 14] }),
    seat({ seat: 1, userId: "u2", username: "Rival", stack: 700, status: "active" }),
    seat({ seat: 2 }),
    seat({ seat: 3 }),
    seat({ seat: 4 }),
    seat({ seat: 5 }),
  ],
  ...over,
});

const services = (over: Partial<TableServices> = {}): TableServices => ({
  table: table(),
  loading: false,
  error: null,
  isLogged: true,
  signIn: vi.fn(),
  order: rotate(6, 0),
  heroSeat: 0,
  secondsLeft: 12,
  feed: [],
  showdown: null,
  atRiskIds: new Set(),
  buyInSeat: null,
  openBuyIn: vi.fn(),
  closeBuyIn: vi.fn(),
  buyInItems: [],
  buyInLoading: false,
  submitBuyIn: vi.fn(),
  cashOutOpen: false,
  cashOut: null,
  openCashOut: vi.fn(),
  closeCashOut: vi.fn(),
  submitCashOut: vi.fn(),
  act: vi.fn(),
  acting: false,
  pool: [],
  ...over,
});

const draw = (over: Partial<TableServices> = {}) =>
  render(
    <MemoryRouter>
      <UserContext.Provider value={{ userData: { walletBalance: 5000 } }}>
        <TableView {...services(over)} />
      </UserContext.Provider>
    </MemoryRouter>
  );

describe("seat rotation", () => {
  // whatever chair you actually hold, you are drawn at the bottom of the table
  it("puts the hero first so they render at the bottom", () => {
    expect(rotate(6, 0)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(rotate(6, 3)).toEqual([3, 4, 5, 0, 1, 2]);
    expect(rotate(2, 1)).toEqual([1, 0]);
  });

  it("leaves the order alone for a spectator", () => {
    expect(rotate(6, null)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe("the table", () => {
  it("draws the name, blinds and hand number", () => {
    draw();
    expect(screen.getByText("Hakurei Shrine")).toBeTruthy();
    expect(screen.getByText(/Hand #3/)).toBeTruthy();
  });

  it("draws a seated player and an empty chair", () => {
    const { container } = draw();
    expect(screen.getByText("Nathan")).toBeTruthy();
    expect(screen.getByText("Rival")).toBeTruthy();
    expect(container.querySelectorAll("button")).toBeTruthy();
    expect(screen.getAllByText("Sit here")).toHaveLength(4);
  });

  it("shows the rail only once you are seated", () => {
    draw();
    expect(screen.getByText(/Waiting for your turn/)).toBeTruthy();

    draw({ table: table({ yourSeat: null }), heroSeat: null });
    expect(screen.getByText(/Pick a seat/)).toBeTruthy();
  });

  it("offers exactly the actions the server said were legal", () => {
    draw({
      table: table({
        legal: [
          { type: "fold" },
          { type: "call", amount: 20 },
          { type: "raise", min: 40, max: 500 },
        ],
      }),
    });
    expect(screen.getByText("Fold")).toBeTruthy();
    expect(screen.getByText(/Call/)).toBeTruthy();
    expect(screen.getByText(/Raise to/)).toBeTruthy();
    expect(screen.queryByText("Check")).toBeNull();
  });

  it("says the table is gone rather than rendering an empty one", () => {
    draw({ table: null, error: "That table is no longer open" });
    expect(screen.getByText("That table is no longer open")).toBeTruthy();
  });
});

describe("the item cage", () => {
  it("announces what is on the line", () => {
    const reimu = {
      uniqueId: "r1",
      name: "Reimu",
      image: "r.png",
      rarity: "5",
      value: 750,
      stakedBy: 1,
    };
    draw({
      table: table({ pool: [reimu], atRisk: [reimu] }),
      pool: [reimu],
      atRiskIds: new Set(["r1"]),
    });
    expect(screen.getByText(/Reimu is on the line/)).toBeTruthy();
  });

  it("says nothing when everything is covered", () => {
    draw();
    expect(screen.queryByText(/on the line/i)).toBeNull();
  });
});
