import { ApiError } from '../../utils/ApiError.js';
import { userRepository } from './user.repository.js';
import { toPublicUser, type PublicUser } from './user.types.js';

export const userService = {
  async getPublicById(id: string): Promise<PublicUser> {
    const user = await userRepository.findById(id);
    if (!user) throw ApiError.notFound('User not found');
    return toPublicUser(user);
  },
};
