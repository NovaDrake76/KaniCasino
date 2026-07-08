import api from '../api';

export async function getCases(search?: string) {
    const response = await api.get('/cases/', { params: search ? { q: search } : {} });
    return response.data;
}

export async function getCase(id: string) {
    const response = await api.get(`/cases/${id}`);
    return response.data;
}