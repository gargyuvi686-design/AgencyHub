import { Request, Response, NextFunction } from 'express';
import { projectService } from './project.service';
import {
  createProjectSchema,
  updateProjectSchema,
  projectListQuerySchema,
  setProjectMembersSchema,
} from './project.schemas';
import { Errors } from '../../lib/errors';
import type { ServiceContext } from '../activity/activity.service';

function getCtx(req: Request): ServiceContext {
  if (!req.user || !req.effectiveAgencyId) throw Errors.UNAUTHORIZED();
  return {
    userId: req.user.userId,
    role: req.user.role,
    agencyId: req.effectiveAgencyId,
    clientId: req.user.clientId,
  };
}

export class ProjectController {
  /**
   * POST /projects — Create project.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = getCtx(req);
      const input = createProjectSchema.parse(req.body);
      const project = await projectService.create(ctx, input);
      res.status(201).json({ data: project });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /projects — List projects.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = getCtx(req);
      const query = projectListQuerySchema.parse(req.query);
      const result = await projectService.list(ctx, query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /projects/:id — Get project details.
   */
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = getCtx(req);
      const project = await projectService.get(ctx, req.params.id);
      res.json({ data: project });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /projects/:id — Update project.
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = getCtx(req);
      const input = updateProjectSchema.parse(req.body);
      const project = await projectService.update(ctx, req.params.id, input);
      res.json({ data: project });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /projects/:id — Delete project.
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = getCtx(req);
      await projectService.delete(ctx, req.params.id);
      res.json({ data: { message: 'Project deleted successfully.' } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /projects/:id/members — Set/sync project members.
   */
  async setMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = getCtx(req);
      const input = setProjectMembersSchema.parse(req.body);
      await projectService.setMembers(ctx, req.params.id, input);
      res.json({ data: { message: 'Project members updated successfully.' } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /projects/:id/members/:userId — Remove member from project.
   */
  async removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = getCtx(req);
      await projectService.removeMember(ctx, req.params.id, req.params.userId);
      res.json({ data: { message: 'Member removed from project.' } });
    } catch (err) {
      next(err);
    }
  }
}

export const projectController = new ProjectController();
