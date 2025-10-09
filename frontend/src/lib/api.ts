import axios from 'axios';
import { ApiResponse, PaginatedResponse } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);

// Generic API functions
export const apiRequest = {
  get: <T>(url: string): Promise<ApiResponse<T>> =>
    api.get(url).then((res) => res.data),
  
  post: <T>(url: string, data: any): Promise<ApiResponse<T>> =>
    api.post(url, data).then((res) => res.data),
  
  put: <T>(url: string, data: any): Promise<ApiResponse<T>> =>
    api.put(url, data).then((res) => res.data),
  
  delete: <T>(url: string): Promise<ApiResponse<T>> =>
    api.delete(url).then((res) => res.data),
  
  getPaginated: <T>(url: string, params?: any): Promise<PaginatedResponse<T>> =>
    api.get(url, { params }).then((res) => res.data),
};

// File upload function
export const uploadFile = async (file: File, type: 'evidence' | 'document'): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  
  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  
  return response.data.data.fileUrl;
};

export default api;