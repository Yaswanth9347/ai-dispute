import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authService, LoginData, RegisterData, AuthResponse } from '@/services/authService';
import { User } from '@/types';

// Auth Query Keys
export const authKeys = {
  all: ['auth'] as const,
  profile: () => [...authKeys.all, 'profile'] as const,
};

// Login mutation
export const useLogin = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: LoginData) => authService.login(data),
    onSuccess: (response) => {
      if (response.success && response.data) {
        localStorage.setItem('auth_token', response.data.token);
        queryClient.setQueryData(authKeys.profile(), response.data.user);
      }
    },
  });
};

// Register mutation
export const useRegister = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: RegisterData) => authService.register(data),
    onSuccess: (response) => {
      if (response.success && response.data) {
        localStorage.setItem('auth_token', response.data.token);
        queryClient.setQueryData(authKeys.profile(), response.data.user);
      }
    },
  });
};

// Get user profile
export const useProfile = () => {
  return useQuery({
    queryKey: authKeys.profile(),
    queryFn: () => authService.getProfile(),
    enabled: !!localStorage.getItem('auth_token'),
    select: (data) => data.data,
  });
};

// Update profile mutation
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<User>) => authService.updateProfile(data),
    onSuccess: (response) => {
      if (response.success && response.data) {
        queryClient.setQueryData(authKeys.profile(), response.data);
      }
    },
  });
};

// Logout mutation
export const useLogout = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      localStorage.removeItem('auth_token');
      queryClient.clear();
    },
  });
};

// Forgot password mutation
export const useForgotPassword = () => {
  return useMutation({
    mutationFn: (email: string) => authService.forgotPassword(email),
  });
};

// Reset password mutation
export const useResetPassword = () => {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) => 
      authService.resetPassword(token, password),
  });
};

// Verify email mutation
export const useVerifyEmail = () => {
  return useMutation({
    mutationFn: (token: string) => authService.verifyEmail(token),
  });
};