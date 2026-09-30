export interface AuthenticatedUser {
  id: string;
}

export interface FileValidationResult {
  mimeType: string;
  extension: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      fileValidation?: FileValidationResult;
    }
  }
}

export {};
