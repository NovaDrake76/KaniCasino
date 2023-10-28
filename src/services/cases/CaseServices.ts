import api from '../api';

export async function getCases() {
    const response = await api.get('/cases/');
    return response.data;
}

export async function getCase(id: string) {
    const response = await api.get(`/cases/${id}`);
    return response.data;
}