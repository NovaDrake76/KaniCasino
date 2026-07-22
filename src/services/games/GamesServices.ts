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