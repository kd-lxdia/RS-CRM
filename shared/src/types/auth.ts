import { UserRole } from './index';

export interface JwtPayload {
  id: string;
  role: UserRole;
  dealerId: string | null;
  zoneId: string | null;
  name: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    role: UserRole;
    name: string;
    dealerId: string | null;
    zoneId: string | null;
  };
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface AuthErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}
