import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes.js';

const router = Router();

router.use('/auth', authRoutes);
// Phase 2: router.use('/files', fileRoutes);

export default router;
