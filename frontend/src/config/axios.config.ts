import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Create axios instance with default configuration
const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  withCredentials: true, // Always send cookies with requests
});

// Request interceptor - automatically adds withCredentials to all requests
axiosInstance.interceptors.request.use(
  (config) => {
    config.withCredentials = true;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handles 401 errors globally
let isRedirecting = false;

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect on 401 for protected endpoints (not public endpoints)
    const url = error.config?.url || '';
    const isPublicEndpoint = url.includes('/public/') || url.includes('/verification/');
    
    if (error.response?.status === 401 && !isPublicEndpoint && !isRedirecting) {
      isRedirecting = true;
      // Just set the error message, don't redirect (let App component handle navigation)
      localStorage.setItem('authError', 'Your session has expired. Please log in again.');
      // Reset flag after a short delay
      setTimeout(() => {
        isRedirecting = false;
      }, 1000);
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
export { API_URL };
