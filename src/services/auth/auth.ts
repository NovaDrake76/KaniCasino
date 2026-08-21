import api from '../api';

export async function login(email: string, password: string) {
    const response = await api.post('/users/login', { email, password });
    return response.data;
}

// marketingOptIn only lands if this sign-in is what creates the account
export async function googleLogin(token: string, referralCode?: string, marketingOptIn?: boolean) {
    const response = await api.post('/users/googlelogin', { token, referralCode, marketingOptIn });
    return response.data;
}

export async function register(email: string, password: string, username: string, referralCode?: string, marketingOptIn?: boolean) {
    const response = await api.post('/users/register', {
        email, password, username, referralCode, marketingOptIn
    });
    return response.data;
}

export async function me() {
    const response = await api.get('/users/me');
    return response.data;
}