import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { uploadLimiter } from '../../middlewares/rateLimit.middleware.js';
import { uploadSingleFile, verifyFileSignature } from '../../middlewares/upload.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { fileController } from './file.controller.js';
import { fileIdParamSchema, listFilesSchema } from './file.validation.js';

const router = Router();

router.use(authenticate);

// uploadLimiter is per-user, so it must come after authenticate.
router.post('/', uploadLimiter, uploadSingleFile, verifyFileSignature, fileController.upload);
router.get('/', validate(listFilesSchema), fileController.list);
router.get('/:id', validate(fileIdParamSchema), fileController.getById);
router.delete('/:id', validate(fileIdParamSchema), fileController.remove);
router.post('/:id/retry', validate(fileIdParamSchema), fileController.retry);

export default router;
