import api from '../api';

export async function login(email: string, password: string) {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
}

export async function refreshToken(refreshToken: string) {
    const response = await api.post('/auth/refresh-token', { refreshToken });
    return response.data;
}
