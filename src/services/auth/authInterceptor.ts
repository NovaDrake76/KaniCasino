import axios from 'axios';
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from './authUtils';
import { refreshToken } from './auth';
const apiKey = import.meta.env.VITE_API_KEY;

function authInterceptor(config: { headers: any }) {
    const token = getAccessToken();

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    if (apiKey) {
        config.headers['x-api-key'] = apiKey; 
    }

    return config;
}

// add the request interceptor
axios.interceptors.request.use(authInterceptor);

axios.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const refreshTokenValue = getRefreshToken();

        if (error.response && error.response.status === 401 && refreshTokenValue && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const { accessToken, refreshToken: newRefreshToken } = await refreshToken(refreshTokenValue);

                saveTokens(accessToken, newRefreshToken);

                originalRequest.headers.Authorization = `Bearer ${accessToken}`;

                return axios(originalRequest);
            } catch (err) {
                clearTokens();
                return Promise.reject(err);
            }
        }

        return Promise.reject(error);
    },
);

export default authInterceptor;
