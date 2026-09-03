import api from '../api';

// the server's own reason when it sent one: a rate-limited signup and a disabled account
// both say something more useful than "please try again"
export function authError(error: unknown, fallback: string) {
    const data = (error as { response?: { data?: { message?: string } } })?.response?.data;
    return data?.message || fallback;
}

export async function login(email: string, password: string) {
    const response = await api.post('/users/login', { email, password });
    return response.data;
}

// google verified somebody who has no account here yet. nothing has been created: the
// ticket carries their identity to the finishing step, where they choose a name and say
// whether they want their google picture on a public leaderboard.
export interface GoogleProfileNeeded {
    needsProfile: true;
    ticket: string;
    suggested: { username: string; picture: string | null };
}

export type GoogleLoginResult = { token: string; needsProfile?: false } | GoogleProfileNeeded;

// marketingOptIn only lands if this sign-in is what creates the account
export async function googleLogin(
    token: string,
    referralCode?: string,
    marketingOptIn?: boolean
): Promise<GoogleLoginResult> {
    const response = await api.post('/users/googlelogin', { token, referralCode, marketingOptIn });
    return response.data;
}

export async function completeGoogleSignup(body: {
    ticket: string;
    username: string;
    useGooglePicture: boolean;
    referralCode?: string;
    marketingOptIn?: boolean;
}): Promise<{ token: string }> {
    const response = await api.post('/users/google/complete', body);
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