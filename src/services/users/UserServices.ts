import api from '../api';

export async function getUser(id: string) {
    const response = await api.get(`/users/${id}`, {

    });

    return response.data;
}

export async function getInventory(id: string, page = 1, filters?: any) {
    let url = `/users/inventory/${id}?page=${page}`;

    if (filters) {
        for (const key in filters) {
            if (filters[key]) {
                url += `&${key}=${filters[key]}`;
            }
        }
    }

    const response = await api.get(url);
    return response.data;
}
export async function fixItem(item: string) {
    const response = await api.put(`/users/fixedItem/`, {
        item
    });
    return response.data;
}

export async function putFixDescription(description: string) {
    const response = await api.put(`/users/fixedItem/description`, {
        description
    });
    return response.data;
}

export async function claimBonus() {
    const response = await api.post(`/users/claimBonus`);
    return response.data;
}

export async function updateProfilePicture(image: string) {
    const response = await api.put(`/users/profilePicture/`, //put image on body
        {
            image
        });

    return response.data;
}

export async function getNotifications(page = 1) {
    const response = await api.get(`/users/notifications?page=${page}`);
    return response.data;
}

export async function getTopPlayers() {
    const response = await api.get(`/users/topPlayers`);
    return response.data;
}

export async function getMyRanking() {
    const response = await api.get(`/users/ranking`);
    return response.data;
}