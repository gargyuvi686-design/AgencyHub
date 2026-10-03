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

function hasPrefix(buffer: Buffer, signature: number[]): boolean {
  return buffer.length >= signature.length && signature.every((byte, index) => buffer[index] === byte);
}

function contentMatchesDeclaredType(file: Express.Multer.File): boolean {
  const content = file.buffer;
  switch (file.mimetype.toLowerCase()) {
    case 'application/pdf':
      return content.subarray(0, 5).toString('ascii') === '%PDF-';
    case 'image/png':
      return hasPrefix(content, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/jpeg':
      return hasPrefix(content, [0xff, 0xd8, 0xff]);
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return hasPrefix(content, [0x50, 0x4b, 0x03, 0x04]) ||
        hasPrefix(content, [0x50, 0x4b, 0x05, 0x06]) ||
        hasPrefix(content, [0x50, 0x4b, 0x07, 0x08]);
    case 'text/plain':
    case 'text/csv':
    case 'application/csv':
      return !content.includes(0);
    default:
      return false;
  }
}

export function receiveProjectFile(req: Request, res: Response, next: NextFunction): void {
  receive(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      next(Errors.BAD_REQUEST(err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the 10 MB limit.' : 'Invalid file upload.'));
      return;
    }
    if (!err && req.file && !contentMatchesDeclaredType(req.file)) {
      next(Errors.UNSUPPORTED_MEDIA_TYPE());
      return;
    }
    next(err);
  });
}