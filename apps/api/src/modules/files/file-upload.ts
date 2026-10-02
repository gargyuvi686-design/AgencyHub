import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';
import { Errors } from '../../lib/errors';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'application/csv',
]);

const receive = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      callback(Errors.BAD_REQUEST('Unsupported file type.'));
      return;
    }
    callback(null, true);
  },
}).single('file');

export function receiveProjectFile(req: Request, res: Response, next: NextFunction): void {
  receive(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      next(Errors.BAD_REQUEST(err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the 10 MB limit.' : 'Invalid file upload.'));
      return;
    }
    next(err);
  });
}