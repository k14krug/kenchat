export interface User {
  id: string;
  username: string;
  email?: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  lastLogin?: Date;
}

export interface CreateUserRequest {
  username: string;
  email?: string;
  password: string;
}

export interface UpdateUserRequest {
  email?: string;
  password?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface UserResponse {
  id: string;
  username: string;
  email?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}

export interface JWTPayload {
  userId: string;
  username: string;
  email?: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenVersion: number;
  iat?: number;
  exp?: number;
}
