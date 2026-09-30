import { RefreshTokenModel, type RefreshTokenDocument } from './refreshToken.model.js';

export const authRepository = {
  createRefreshToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<RefreshTokenDocument> {
    return RefreshTokenModel.create({ user: userId, tokenHash, expiresAt });
  },

  findByHash(tokenHash: string): Promise<RefreshTokenDocument | null> {
    return RefreshTokenModel.findOne({ tokenHash });
  },

  async revoke(tokenId: string, replacedByTokenHash?: string): Promise<void> {
    await RefreshTokenModel.updateOne(
      { _id: tokenId },
      { revokedAt: new Date(), ...(replacedByTokenHash && { replacedByTokenHash }) },
    );
  },

  async revokeAllForUser(userId: string): Promise<void> {
    await RefreshTokenModel.updateMany(
      { user: userId, revokedAt: null },
      { revokedAt: new Date() },
    );
  },
};
