import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

const client = axios.create({ baseURL });

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.message || err.response?.data?.error || err.message || 'Request failed';
    const wrapped = new Error(message);
    // Preserve the original response (status/body) and error code for callers
    // that need structured detail - e.g. a 409 duplicate_reference confirm
    // flow, or the offline queue telling a real HTTP error apart from a
    // request that never reached the server at all.
    wrapped.response = err.response;
    wrapped.code = err.response?.data?.error;
    return Promise.reject(wrapped);
  }
);

export default client;
