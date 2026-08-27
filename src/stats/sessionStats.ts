// the running tally behind the live stats panel. it lives in the tab and nowhere else:
// no request, no row, no server state. closing the tab ends the session.

// one point per round, and a long session is thousands of them, so the series is a
// window. the totals stay exact; only what the graph draws is trimmed.
export const MAX_POINTS = 500;

export interface Round {
    game: string;
    wagered: number;
    payout: number;
}

export interface SessionStats {
    rounds: number;
    wins: number;
    losses: number;
    wagered: number;
    payout: number;
    // cumulative profit after each of the last MAX_POINTS rounds
    points: number[];
}

export const EMPTY: SessionStats = { rounds: 0, wins: 0, losses: 0, wagered: 0, payout: 0, points: [] };

export const profitOf = (stats: SessionStats) => stats.payout - stats.wagered;

// a push returns the stake and counts as neither, which is why wins and losses do not
// have to add up to rounds
export const applyRound = (stats: SessionStats, round: Round): SessionStats => {
    const wagered = stats.wagered + round.wagered;
    const payout = stats.payout + round.payout;
    const points = [...stats.points, payout - wagered];
    return {
        rounds: stats.rounds + 1,
        wins: stats.wins + (round.payout > round.wagered ? 1 : 0),
        losses: stats.losses + (round.payout < round.wagered ? 1 : 0),
        wagered,
        payout,
        points: points.length > MAX_POINTS ? points.slice(points.length - MAX_POINTS) : points,
    };
};

const KEY = "kani.liveStats";

// sessionStorage is per tab and dies with it, which is exactly the lifetime wanted. it
// throws outright in some privacy modes, so every touch is guarded.
export const load = (): SessionStats => {
    try {
        const raw = sessionStorage.getItem(KEY);
        if (!raw) return EMPTY;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.rounds !== "number" || !Array.isArray(parsed.points)) return EMPTY;
        return { ...EMPTY, ...parsed };
    } catch {
        return EMPTY;
    }
};

export const save = (stats: SessionStats) => {
    try {
        sessionStorage.setItem(KEY, JSON.stringify(stats));
    } catch {
        // a full or blocked store must never break a game
    }
};

export const clear = () => {
    try {
        sessionStorage.removeItem(KEY);
    } catch {
        // nothing to do
    }
};

// where the player dragged the panel to. remembered for the tab so it does not jump back
// to the corner every time they walk to another game.
const POS_KEY = "kani.liveStatsPos";

export interface Point { x: number; y: number; }

export const loadPosition = (): Point | null => {
    try {
        const raw = sessionStorage.getItem(POS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return typeof parsed?.x === "number" && typeof parsed?.y === "number" ? parsed : null;
    } catch {
        return null;
    }
};

export const savePosition = (point: Point) => {
    try {
        sessionStorage.setItem(POS_KEY, JSON.stringify(point));
    } catch {
        // the panel just will not remember where it was
    }
};
