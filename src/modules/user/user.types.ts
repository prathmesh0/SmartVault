import type { Types } from 'mongoose';

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

export function toPublicUser(user: {
  _id: Types.ObjectId;
  name: string;
  email: string;
}): PublicUser {
  return { id: user._id.toString(), name: user.name, email: user.email };
}
