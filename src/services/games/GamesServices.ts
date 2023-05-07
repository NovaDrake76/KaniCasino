import api from '../api';

export async function openBox(id: string, userId: string) {
    const response = await api.post(`/games/openCase/${id}`, { userId });
    return response.data;
}