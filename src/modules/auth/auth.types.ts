export interface RegisterDto {
  name: string;
  email: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string; // plain value — only returned once, to set the cookie
  refreshTokenExpiresAt: Date;
}
