import type { Request, Response, NextFunction } from 'express';
import { FeedbackStatus } from '@prisma/client';
import { Errors } from '../../lib/errors';
import type { ServiceContext } from '../activity/activity.service';
import {
  createFeedbackCommentSchema,
  createFeedbackSchema,
  updateFeedbackStatusSchema,
} from './feedback.schemas';
import { feedbackService } from './feedback.service';

function buildContext(req: Request): ServiceContext {
  if (!req.user) throw Errors.UNAUTHORIZED();
  return {
    userId: req.user.userId,
    role: req.user.role,
    agencyId: req.effectiveAgencyId ?? req.user.agencyId ?? null,
    clientId: req.user.clientId ?? null,
  };
}

export class FeedbackController {
  async listAgency(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      if (status && !Object.values(FeedbackStatus).includes(status as FeedbackStatus)) {
        throw Errors.BAD_REQUEST('Invalid feedback status.');
      }
      const result = await feedbackService.listForAgency(buildContext(req), status as FeedbackStatus | undefined);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async listPortal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await feedbackService.listForPortal(buildContext(req)));
    } catch (err) {
      next(err);
    }
  }

  async listForProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await feedbackService.listForProject(buildContext(req), req.params.id);
      res.json({ data: result.data });
    } catch (err) {
      next(err);
    }
  }

  async submit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createFeedbackSchema.parse(req.body);
      const result = await feedbackService.submit(buildContext(req), req.params.id, input);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async listComments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await feedbackService.listComments(buildContext(req), req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async addComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createFeedbackCommentSchema.parse(req.body);
      const result = await feedbackService.addComment(buildContext(req), req.params.id, input);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = updateFeedbackStatusSchema.parse(req.body);
      const result = await feedbackService.updateStatus(buildContext(req), req.params.id, input);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const feedbackController = new FeedbackController();