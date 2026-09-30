import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { generateOpaqueToken, sha256 } from '../../utils/hash.js';
import { signAccessToken } from '../../utils/jwt.js';
import { userRepository } from '../user/user.repository.js';
import { toPublicUser, type PublicUser } from '../user/user.types.js';
import { authRepository } from './auth.repository.js';
import type { LoginDto, RegisterDto, TokenPair } from './auth.types.js';

const BCRYPT_COST = 12;

function refreshTokenExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

async function issueTokenPair(userId: string): Promise<TokenPair> {
  const accessToken = signAccessToken({ sub: userId });

  const plainRefreshToken = generateOpaqueToken();
  const expiresAt = refreshTokenExpiry();
  await authRepository.createRefreshToken(userId, sha256(plainRefreshToken), expiresAt);

  return { accessToken, refreshToken: plainRefreshToken, refreshTokenExpiresAt: expiresAt };
}

export const authService = {
  async register(dto: RegisterDto): Promise<PublicUser> {
    const existing = await userRepository.findByEmail(dto.email);
    if (existing) throw ApiError.conflict('An account with this email already exists');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    const user = await userRepository.create({ name: dto.name, email: dto.email, passwordHash });

    return toPublicUser(user);
  },

  async login(dto: LoginDto): Promise<{ user: PublicUser; tokens: TokenPair }> {
    const user = await userRepository.findByEmail(dto.email, true);
    // Same error for "no such user" and "wrong password" — never reveal which one it was.
    if (!user) throw ApiError.unauthorized('Invalid credentials');

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) throw ApiError.unauthorized('Invalid credentials');

    const tokens = await issueTokenPair(user._id.toString());
    return { user: toPublicUser(user), tokens };
  },

  async refresh(plainRefreshToken: string): Promise<TokenPair> {
    const tokenHash = sha256(plainRefreshToken);
    const existing = await authRepository.findByHash(tokenHash);

    if (!existing) throw ApiError.unauthorized('Invalid refresh token');

    if (existing.revokedAt) {
      // This token was already rotated away — seeing it again means it's
      // being reused (e.g. stolen and replayed). Treat as a compromise:
      // kill every session this user has, forcing a fresh login everywhere.
      await authRepository.revokeAllForUser(existing.user.toString());
      throw ApiError.unauthorized('Refresh token has already been used');
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      throw ApiError.unauthorized('Refresh token has expired');
    }

    const userId = existing.user.toString();
    const newTokens = await issueTokenPair(userId);
    await authRepository.revoke(existing._id.toString(), sha256(newTokens.refreshToken));

    return newTokens;
  },

  async logout(plainRefreshToken: string | undefined): Promise<void> {
    if (!plainRefreshToken) return;
    const existing = await authRepository.findByHash(sha256(plainRefreshToken));
    if (existing && !existing.revokedAt) {
      await authRepository.revoke(existing._id.toString());
    }
  },
};
