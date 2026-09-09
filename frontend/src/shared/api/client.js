import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost/inventory-api/public';

const client = axios.create({ baseURL });

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.error || err.message || 'Request failed';
    return Promise.reject(new Error(message));
  }
);

export default client;
