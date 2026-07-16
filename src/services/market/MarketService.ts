import api from '../api';
import { PricePoint } from '../../components/PriceChart';

export interface MarketStats {
    floor: number;              // instant sell-to-house price: a hard price floor
    lowestListing: number | null;
    totalListings: number;
    bestBid: number | null;     // highest open buy order
    lastSale: { price: number; soldAt: string } | null;
    median7d: number | null;
    median30d: number | null;
    volume7d: number;
    volume30d: number;
    feeRate: number;
}

export interface ItemHistory {
    item: { _id: string; name: string; image: string; rarity: string; baseValue: number };
    range: string;
    points: PricePoint[];
    stats: MarketStats;
}

export interface BuyOrder {
    _id: string;
    item: string;
    itemName: string;
    itemImage: string;
    rarity: string;
    price: number;
    quantity: number;
    filled: number;
    escrow: number;
    status: string;
    createdAt: string;
}

export async function getItems(page: number, filters: any) {
    const { name, rarity, sortBy, order, listedOnly } = filters;
    const response = await api.get(`/marketplace`, {
        params: { page, limit: 30, name, rarity, sortBy, order, listedOnly: listedOnly ? 1 : undefined }
    });
    return response.data;
}

export async function getItemListings(itemId: string, page: number) {
    const response = await api.get(`/marketplace/item/${itemId}`, {
        params: { page, limit: 30 }
    });
    return response.data;
}

export async function getItemHistory(itemId: string, range: string): Promise<ItemHistory> {
    const response = await api.get(`/marketplace/item/${itemId}/history`, { params: { range } });
    return response.data;
}

export async function getItemOrders(itemId: string): Promise<{ orders: { price: number; quantity: number }[] }> {
    const response = await api.get(`/marketplace/item/${itemId}/orders`);
    return response.data;
}

export async function sellItem(item: any, price: number) {
    const response = await api.post(`/marketplace/`, { item, price });
    return response.data;
}

export async function buyItem(id: string) {
    const response = await api.post(`/marketplace/buy/${id}`);
    return response.data;
}

export async function removeListing(id: string) {
    const response = await api.delete(`/marketplace/${id}`);
    return response.data;
}

export async function placeBuyOrder(itemId: string, price: number, quantity: number) {
    const response = await api.post(`/marketplace/orders`, { itemId, price, quantity });
    return response.data;
}

export async function getMyOrders(): Promise<{ orders: BuyOrder[] }> {
    const response = await api.get(`/marketplace/orders/me`);
    return response.data;
}

export async function cancelBuyOrder(id: string) {
    const response = await api.delete(`/marketplace/orders/${id}`);
    return response.data;
}
