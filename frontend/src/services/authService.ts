import axiosInstance from '../config/axios.config';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  id: string;
  email: string;
  name: string;
  organization?: string;
}

export interface SessionResponse {
  isAuthenticated: boolean;
  userId?: string;
  email?: string;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await axiosInstance.post<AuthResponse>(
      '/auth/login',
      credentials
    );
    return response.data;
  },

  async logout(): Promise<void> {
    await axiosInstance.post('/auth/logout', {});
  },

  async getSession(): Promise<SessionResponse> {
    try {
      const response = await axiosInstance.get<SessionResponse>('/auth/session');
      return response.data;
    } catch (error) {
      return { isAuthenticated: false };
    }
  },
};
