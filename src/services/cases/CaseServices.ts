import api from '../api';

export async function getCases(search?: string) {
    const response = await api.get('/cases/', { params: search ? { q: search } : {} });
    return response.data;
}

export async function getCase(id: string) {
    const response = await api.get(`/cases/${id}`);
    return response.data;
}

export interface MostOpenedCase {
    _id: string;
    title: string;
    image: string;
    price: number;
    category?: string;
    opens: number;
}

export async function getMostOpenedCases(limit = 5): Promise<MostOpenedCase[]> {
    const response = await api.get('/cases/most-opened', { params: { limit } });
    return response.data;
}