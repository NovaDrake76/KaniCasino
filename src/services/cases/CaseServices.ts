import api from '../api';

export async function getCases() {
    const response = await api.get('/cases/');
    return response.data;
}

