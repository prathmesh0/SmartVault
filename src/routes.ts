import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes.js';
import fileRoutes from './modules/file/file.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/files', fileRoutes);

export default router;
