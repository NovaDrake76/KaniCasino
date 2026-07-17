import api from '../api';

export async function login(email: string, password: string) {
    const response = await api.post('/users/login', { email, password });
    return response.data;
}

export async function googleLogin(token: string, referralCode?: string) {
    const response = await api.post('/users/googlelogin', { token, referralCode });
    return response.data;
}

export async function register(email: string, password: string, username: string, profilePicture: any, referralCode?: string) {
    const response = await api.post('/users/register', {
        email, password, username,
        profilePicture: profilePicture ? profilePicture : "",
        referralCode
    });
    return response.data;
}

export async function me() {
    const response = await api.get('/users/me');
    return response.data;
}