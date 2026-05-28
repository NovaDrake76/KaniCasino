import axios from 'axios';
import { getAccessToken } from './authUtils';
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

export default authInterceptor;
