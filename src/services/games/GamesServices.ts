import api from '../api';

export async function openBox(id: string, quantity: number) {
    const response = await api.post(`/games/openCase/${id}`, {
        quantity: quantity || 1
    });
    return response.data;
}

export async function upgradeItem(selectedItemIds: string[], targetItemId: string) {
    const response = await api.post(`/games/upgrade/`, { selectedItemIds, targetItemId });
    return response.data;
}

export async function getCoinFlipHistory(limit = 15) {
    const response = await api.get(`/games/coinflip/history`, { params: { limit } });
    return response.data;
}

export async function spinSlots(betAmount: number) {
    const response = await api.post(`/games/slots/`, {
        betAmount
    });
    return response.data;
}

export async function dropPlinko(betAmount: number, risk: string) {
    const response = await api.post(`/games/plinko/`, { betAmount, risk });
    return response.data;
}

export async function rollDice(betAmount: number, target: number, direction: "over" | "under") {
    const response = await api.post(`/games/dice/`, { betAmount, target, direction });
    return response.data;
}

export async function startMines(betAmount: number, mineCount: number) {
    const response = await api.post(`/games/mines/start`, { betAmount, mineCount });
    return response.data;
}

export async function revealMines(tile: number) {
    const response = await api.post(`/games/mines/reveal`, { tile });
    return response.data;
}

export async function cashoutMines() {
    const response = await api.post(`/games/mines/cashout`, {});
    return response.data;
}

export async function getActiveMinesGame() {
    const response = await api.get(`/games/mines/active`);
    return response.data;
}

export async function startHilo(betAmount: number) {
    const response = await api.post(`/games/hilo/start`, { betAmount });
    return response.data;
}

export async function guessHilo(direction: "hi" | "lo") {
    const response = await api.post(`/games/hilo/guess`, { direction });
    return response.data;
}

export async function skipHilo() {
    const response = await api.post(`/games/hilo/skip`, {});
    return response.data;
}

export async function cashoutHilo() {
    const response = await api.post(`/games/hilo/cashout`, {});
    return response.data;
}

export async function getActiveHiloGame() {
    const response = await api.get(`/games/hilo/active`);
    return response.data;
}

export async function dealBlackjack(betAmount: number) {
    const response = await api.post(`/games/blackjack/deal`, { betAmount });
    return response.data;
}

export async function hitBlackjack() {
    const response = await api.post(`/games/blackjack/hit`, {});
    return response.data;
}

export async function standBlackjack() {
    const response = await api.post(`/games/blackjack/stand`, {});
    return response.data;
}

export async function doubleBlackjack() {
    const response = await api.post(`/games/blackjack/double`, {});
    return response.data;
}

export async function splitBlackjack() {
    const response = await api.post(`/games/blackjack/split`, {});
    return response.data;
}

export async function insureBlackjack(accept: boolean) {
    const response = await api.post(`/games/blackjack/insurance`, { accept });
    return response.data;
}

export async function getActiveBlackjackHand() {
    const response = await api.get(`/games/blackjack/active`);
    return response.data;
}