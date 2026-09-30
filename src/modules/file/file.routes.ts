import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { uploadSingleFile, verifyFileSignature } from '../../middlewares/upload.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { fileController } from './file.controller.js';
import { fileIdParamSchema, listFilesSchema } from './file.validation.js';

const router = Router();

// every file route requires a logged-in user
router.use(authenticate);

router.post('/', uploadSingleFile, verifyFileSignature, fileController.upload);
router.get('/', validate(listFilesSchema), fileController.list);
router.get('/:id', validate(fileIdParamSchema), fileController.getById);
router.delete('/:id', validate(fileIdParamSchema), fileController.remove);

export default router;
