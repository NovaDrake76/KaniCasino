import axios from 'axios';
import authInterceptor from './auth/authInterceptor';
import { getAccessToken, clearTokens } from './auth/authUtils';

// const urls = {
//     dev: 'http://localhost:5000',
//     production: 'https://kaniback.onrender.com',
// }

export const SESSION_EXPIRED_EVENT = 'auth:sessionExpired';
// fired once a game request goes through, since a bonus can pay a stake without moving the wallet
export const GAME_PLAYED_EVENT = 'games:played';
const GAME_PATH = /\/games\/(slots|plinko|dice|mines|hilo|blackjack)\b/;

const api = axios.create({
    baseURL: import.meta.env.VITE_BASE_URL

});

api.interceptors.request.use(authInterceptor, (error) => Promise.reject(error));

// a 401 only ever means the token is missing, invalid or expired: failed logins
// answer 400. there is no refresh endpoint, so drop the dead token and let the
// app fall back to a logged-out state instead of leaving a broken session up.
api.interceptors.response.use(
    (response) => {
        const game = response.config?.method === 'post' ? response.config.url?.match(GAME_PATH)?.[1] : undefined;
        if (game) window.dispatchEvent(new CustomEvent(GAME_PLAYED_EVENT, { detail: { game } }));
        return response;
    },
    (error) => {
        if (error.response?.status === 401 && getAccessToken()) {
            clearTokens();
            window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
        }
        return Promise.reject(error);
    }
);

export default api;