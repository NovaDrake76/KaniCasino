import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import authInterceptor from './auth/authInterceptor';
import { getAccessToken, clearTokens } from './auth/authUtils';
import { hedged } from './hedge';

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

// reads go through hedged, so a copy stuck on the way to the server is raced by a fresh one. a caller holding its own signal keeps control of it,
// and the mission toasts are handed out once per read, so a second copy could take them from the first and the player would never see them.
const NOT_HEDGED = /^\/missions\/pending\b/;
const plainGet = api.get.bind(api);
api.get = function <T = unknown, R = AxiosResponse<T>, D = unknown>(url: string, config?: AxiosRequestConfig<D>): Promise<R> {
    if (config?.signal || NOT_HEDGED.test(url)) return plainGet<T, R, D>(url, config);
    return hedged((signal) => plainGet<T, R, D>(url, { ...config, signal }));
};

export default api;