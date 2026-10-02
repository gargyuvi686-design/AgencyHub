import type { Request, Response, NextFunction } from 'express';
import { Errors } from '../../lib/errors';
import type { ServiceContext } from '../activity/activity.service';
import { fileService, safeDownloadName } from './file.service';
import { updateFileVisibilitySchema } from './file.schemas';

function buildContext(req: Request): ServiceContext {
  if (!req.user) throw Errors.UNAUTHORIZED();
  return {
    userId: req.user.userId,
    role: req.user.role,
    agencyId: req.effectiveAgencyId ?? req.user.agencyId ?? null,
    clientId: req.user.clientId ?? null,
  };
}

function sendDownload(
  result: Awaited<ReturnType<typeof fileService.workspaceDownload>>,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader('Content-Type', result.mimeType);
  res.setHeader('Content-Length', String(result.sizeBytes));
  res.setHeader('Content-Disposition', `attachment; filename="${safeDownloadName(result.originalName)}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  result.stream.on('error', next);
  result.stream.pipe(res);
}

export class FileController {
  async listWorkspace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await fileService.listWorkspace(buildContext(req), req.params.id));
    } catch (err) {
      next(err);
    }
  }

  async uploadWorkspace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await fileService.upload(buildContext(req), req.params.id, req.file);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async listPortal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await fileService.listPortal(buildContext(req), req.params.id));
    } catch (err) {
      next(err);
    }
  }

  async updateVisibility(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = updateFileVisibilitySchema.parse(req.body);
      res.json(await fileService.setClientVisibility(buildContext(req), req.params.id, input.visibleToClient));
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await fileService.delete(buildContext(req), req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async downloadWorkspace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendDownload(await fileService.workspaceDownload(buildContext(req), req.params.id), res, next);
    } catch (err) {
      next(err);
    }
  }

  async downloadPortal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendDownload(await fileService.portalDownload(buildContext(req), req.params.id), res, next);
    } catch (err) {
      next(err);
    }
  }
}

export const fileController = new FileController();