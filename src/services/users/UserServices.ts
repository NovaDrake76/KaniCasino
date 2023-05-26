import api from '../api';

export async function getUser(id: string) {
    const response = await api.get(`/users/${id}`, {

    });

    return response.data;
}

export async function getInventory(id: string, page?: number) {
    const response = await api.get(`/users/inventory/${id}${page && `?page=` + page}`, {
    });
    return response.data;
}

export async function fixItem(name: string, image: string, rarity: string) {
    const response = await api.put(`/users/fixedItem/`, {
        name,
        image,
        rarity
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