import api from '../api';

export async function getUser(id: string) {
    const response = await api.get(`/users/${id}`, {

    });

    return response.data;
}

export async function getInventory(id: string) {
    const response = await api.get(`/users/inventory/${id}`, {
    });
    return response.data;
}