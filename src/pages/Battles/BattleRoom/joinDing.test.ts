import { describe, it, expect } from "vitest";
import { humansIn, someoneJoined } from "./joinDing";
import type { Battle, BattlePlayer } from "../../../services/battles/BattleService";

const seat = (userId: string | null, slot: number): BattlePlayer => ({
  userId,
  username: userId || `bot${slot}`,
  profilePicture: "",
  team: slot,
  slot,
  isBot: !userId,
  items: [],
  total: 0,
});

const battle = (players: BattlePlayer[], over: Partial<Battle> = {}): Battle => ({
  id: "b1",
  status: "waiting",
  mode: "1v1v1",
  bakaMode: false,
  cases: [],
  entryCost: 100,
  createdBy: "host",
  currentRound: 0,
  winnerUserIds: [],
  winningTeam: null,
  tiedTeams: [],
  players,
  ...over,
});

describe("the battle join ding", () => {
  const before = battle([seat("host", 0)]);
  const seen = humansIn(before);

  it("rings for the host when a player takes a seat", () => {
    expect(someoneJoined(seen, battle([seat("host", 0), seat("guest", 1)]), "host")).toBe(true);
  });

  it("stays quiet for a bot, for someone already seated and for anyone but the host", () => {
    expect(someoneJoined(seen, battle([seat("host", 0), seat(null, 1)]), "host")).toBe(false);
    expect(someoneJoined(["host", "guest"], battle([seat("host", 0), seat("guest", 1)]), "host")).toBe(false);
    expect(someoneJoined(seen, battle([seat("host", 0), seat("guest", 1)]), "guest")).toBe(false);
    expect(someoneJoined(seen, battle([seat("host", 0), seat("guest", 1)]), undefined)).toBe(false);
  });

  it("stays quiet once the battle has started", () => {
    expect(someoneJoined(seen, battle([seat("host", 0), seat("guest", 1)], { status: "in_progress" }), "host")).toBe(false);
  });
});
