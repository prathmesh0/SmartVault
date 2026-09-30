import { UserModel, type UserDocument } from './user.model.js';

export const userRepository = {
  create(data: { name: string; email: string; passwordHash: string }): Promise<UserDocument> {
    return UserModel.create(data);
  },
  findByEmail(email: string, withPassword = false): Promise<UserDocument | null> {
    const query = UserModel.findOne({
      email: email.toLowerCase(),
    });
    return withPassword ? query.select('+passwordHash') : query;
  },

  findById(id: string): Promise<UserDocument | null> {
    return UserModel.findById(id);
  },
};
