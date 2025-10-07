import { apiRequest } from '@/lib/api';
import { 
  User, 
  AuthState, 
  ApiResponse 
} from '@/types';

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export const authService = {
  // Login user
  login: async (data: LoginData): Promise<ApiResponse<AuthResponse>> => {
    return apiRequest.post<AuthResponse>('/auth/login', data);
  },

  // Register new user
  register: async (data: RegisterData): Promise<ApiResponse<AuthResponse>> => {
    return apiRequest.post<AuthResponse>('/auth/register', data);
  },

  // Get current user profile
  getProfile: async (): Promise<ApiResponse<User>> => {
    return apiRequest.get<User>('/auth/profile');
  },

  // Update user profile
  updateProfile: async (data: Partial<User>): Promise<ApiResponse<User>> => {
    return apiRequest.put<User>('/auth/profile', data);
  },

  // Logout user
  logout: async (): Promise<ApiResponse<null>> => {
    return apiRequest.post<null>('/auth/logout', {});
  },

  // Forgot password
  forgotPassword: async (email: string): Promise<ApiResponse<null>> => {
    return apiRequest.post<null>('/auth/forgot-password', { email });
  },

  // Reset password
  resetPassword: async (token: string, password: string): Promise<ApiResponse<null>> => {
    return apiRequest.post<null>('/auth/reset-password', { token, password });
  },

  // Verify email
  verifyEmail: async (token: string): Promise<ApiResponse<null>> => {
    return apiRequest.post<null>('/auth/verify-email', { token });
  },
};