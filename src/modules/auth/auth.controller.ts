import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import {
  clearRefreshTokenCookie,
  REFRESH_COOKIE_NAME,
  setRefreshTokenCookie,
} from '../../utils/cookies.js';
import { userService } from '../user/user.service.js';
import { authService } from './auth.service.js';
import type { LoginDto, RegisterDto } from './auth.types.js';

export const authController = {
  register: asyncHandler(async (req: Request<unknown, unknown, RegisterDto>, res: Response) => {
    const user = await authService.register(req.body);
    sendSuccess(res, { user }, { status: 201 });
  }),

  login: asyncHandler(async (req: Request<unknown, unknown, LoginDto>, res: Response) => {
    const { user, tokens } = await authService.login(req.body);
    setRefreshTokenCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);
    sendSuccess(res, { user, accessToken: tokens.accessToken });
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const incoming = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    if (!incoming) throw ApiError.unauthorized('No refresh token provided');

    const tokens = await authService.refresh(incoming);
    setRefreshTokenCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);
    sendSuccess(res, { accessToken: tokens.accessToken });
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    const incoming = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    await authService.logout(incoming);
    clearRefreshTokenCookie(res);
    sendSuccess(res, { message: 'Logged out' });
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    // req.user is guaranteed by the `authenticate` middleware that runs before this
    const user = await userService.getPublicById(req.user!.id);
    sendSuccess(res, { user });
  }),
};
