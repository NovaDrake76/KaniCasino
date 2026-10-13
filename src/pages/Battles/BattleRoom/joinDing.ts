import type { Battle } from "../../../services/battles/BattleService";

// the people seated in a battle, bots left out
export const humansIn = (battle: Battle): string[] =>
  battle.players.flatMap((player) => (player.userId ? [player.userId] : []));

// someone the host had not seen yet took a seat in the host's waiting battle
export const someoneJoined = (seen: string[], next: Battle, myId: string | undefined): boolean =>
  !!myId &&
  next.createdBy === myId &&
  next.status === "waiting" &&
  humansIn(next).some((userId) => userId !== myId && !seen.includes(userId));
