import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authLimiter } from '../../middlewares/rateLimit.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authController } from './auth.controller.js';
import { loginSchema, registerSchema } from './auth.validation.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authLimiter, authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);

export default router;
