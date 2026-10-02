import { createReadStream } from 'node:fs';
import { access, mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { Errors } from '../../lib/errors';
import { activityService, type ServiceContext } from '../activity/activity.service';
import { resolveProjectAccess } from '../projects/resolveProjectAccess';

const FILE_SELECT = {
  id: true,
  agencyId: true,
  projectId: true,
  uploadedBy: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  visibleToClient: true,
  createdAt: true,
  uploader: { select: { id: true, name: true } },
};

function uploadDirectory(): string {
  return path.resolve(process.env.UPLOAD_DIR || env.UPLOAD_DIR);
}

function storagePath(storageKey: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(storageKey)) {
    throw Errors.NOT_FOUND('File');
  }
  return path.join(uploadDirectory(), storageKey);
}

function storedOriginalName(name: string): string {
  return name.replace(/[\\/\r\n\0]/g, '_').trim().slice(0, 255) || 'upload';
}

export function safeDownloadName(name: string): string {
  return name
    .replace(/[\\/\r\n\0"]/g, '_')
    .replace(/[^A-Za-z0-9._ -]/g, '_')
    .trim()
    .slice(0, 180) || 'download';
}

export class FileService {
  async listWorkspace(ctx: ServiceContext, projectId: string) {
    await resolveProjectAccess(ctx, projectId);
    const data = await prisma.file.findMany({
      where: { agencyId: ctx.agencyId!, projectId },
      select: FILE_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return { data };
  }

  async upload(ctx: ServiceContext, projectId: string, file?: Express.Multer.File) {
    if (!file) throw Errors.BAD_REQUEST('A file is required.');
    await resolveProjectAccess(ctx, projectId);

    const storageKey = randomUUID();
    const targetPath = storagePath(storageKey);
    await mkdir(uploadDirectory(), { recursive: true });
    await writeFile(targetPath, file.buffer, { flag: 'wx' });

    let record;
    try {
      record = await prisma.file.create({
        data: {
          agencyId: ctx.agencyId!,
          projectId,
          uploadedBy: ctx.userId,
          originalName: storedOriginalName(file.originalname),
          storageKey,
          mimeType: file.mimetype.toLowerCase(),
          sizeBytes: file.size,
        },
        select: FILE_SELECT,
      });
    } catch (err) {
      await unlink(targetPath).catch(() => undefined);
      throw err;
    }

    await activityService.log({
      ctx,
      eventType: 'file.uploaded',
      entityType: 'file',
      entityId: record.id,
      projectId,
      metadata: { originalName: record.originalName, sizeBytes: record.sizeBytes },
    });

    return { data: record };
  }

  private async findWorkspaceFile(ctx: ServiceContext, fileId: string) {
    if (!ctx.agencyId) throw Errors.UNAUTHORIZED();
    const file = await prisma.file.findFirst({
      where: { id: fileId, agencyId: ctx.agencyId },
      select: { ...FILE_SELECT, storageKey: true },
    });
    if (!file) throw Errors.NOT_FOUND('File');
    if (ctx.role === 'AGENCY_MEMBER') {
      await resolveProjectAccess(ctx, file.projectId);
    }
    return file;
  }

  async setClientVisibility(ctx: ServiceContext, fileId: string, visibleToClient: boolean) {
    await this.findWorkspaceFile(ctx, fileId);
    const result = await prisma.file.updateMany({
      where: { id: fileId, agencyId: ctx.agencyId! },
      data: { visibleToClient },
    });
    if (result.count === 0) throw Errors.NOT_FOUND('File');
    const data = await prisma.file.findFirst({ where: { id: fileId, agencyId: ctx.agencyId! }, select: FILE_SELECT });
    if (!data) throw Errors.NOT_FOUND('File');
    return { data };
  }

  async delete(ctx: ServiceContext, fileId: string) {
    const file = await this.findWorkspaceFile(ctx, fileId);
    if (ctx.role !== 'AGENCY_ADMIN' && file.uploadedBy !== ctx.userId) throw Errors.FORBIDDEN();

    const result = await prisma.file.deleteMany({ where: { id: fileId, agencyId: ctx.agencyId! } });
    if (result.count === 0) throw Errors.NOT_FOUND('File');
    await unlink(storagePath(file.storageKey)).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') throw err;
    });
  }

  async listPortal(ctx: ServiceContext, projectId: string) {
    if (ctx.role !== 'CLIENT' || !ctx.clientId || !ctx.agencyId) throw Errors.FORBIDDEN();
    await resolveProjectAccess(ctx, projectId);
    const data = await prisma.file.findMany({
      where: {
        agencyId: ctx.agencyId,
        projectId,
        visibleToClient: true,
        project: { clientId: ctx.clientId },
      },
      select: FILE_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return { data };
  }

  async workspaceDownload(ctx: ServiceContext, fileId: string) {
    const file = await this.findWorkspaceFile(ctx, fileId);
    return this.openDownload(file);
  }

  async portalDownload(ctx: ServiceContext, fileId: string) {
    if (ctx.role !== 'CLIENT' || !ctx.clientId || !ctx.agencyId) throw Errors.FORBIDDEN();
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        agencyId: ctx.agencyId,
        visibleToClient: true,
        project: { clientId: ctx.clientId },
      },
      select: { ...FILE_SELECT, storageKey: true },
    });
    if (!file) throw Errors.NOT_FOUND('File');
    return this.openDownload(file);
  }

  private async openDownload(file: { storageKey: string; originalName: string; mimeType: string; sizeBytes: number }) {
    const filePath = storagePath(file.storageKey);
    try {
      await access(filePath);
      await stat(filePath);
    } catch {
      throw Errors.NOT_FOUND('File');
    }
    return {
      stream: createReadStream(filePath),
      originalName: safeDownloadName(file.originalName),
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
    };
  }
}

export const fileService = new FileService();