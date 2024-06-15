import api from '../api';

export async function getItems(page: number, filters: any) {
    const { name, rarity, sortBy, order } = filters;
    const response = await api.get(`/marketplace`, {
        params: {
            page,
            limit: 30,
            name,
            rarity,
            sortBy,
            order
        }
    });
    return response.data;
}

export async function getItemListings(itemId: string, page: number) {
    const response = await api.get(`/marketplace/item/${itemId}`, {
        params: {
            page,
            limit: 30
        }
    });
    return response.data;
}

export async function sellItem(item: any, price: number) {
    const response = await api.post(`/marketplace/`, {
        item,
        price
    });
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
