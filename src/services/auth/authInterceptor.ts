import axios from 'axios';
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from './authUtils';
import { refreshToken } from './auth';

function authInterceptor(config: { headers: any }) {
    const token = getAccessToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}

axios.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const refreshTokenValue = getRefreshToken();

        if (error.response.status === 401 && refreshTokenValue && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const { accessToken, refreshToken: newRefreshToken } = await refreshToken(refreshTokenValue);

                saveTokens(accessToken, newRefreshToken);

                originalRequest.headers.Authorization = `${accessToken}`;

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
