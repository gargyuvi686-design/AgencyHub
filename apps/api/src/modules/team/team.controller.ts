import { Request, Response, NextFunction } from 'express';
import { teamService } from './team.service';
import { inviteSchema, updateTeamMemberSchema, teamListQuerySchema } from './team.schemas';
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

export class TeamController {
  /**
   * POST /team/invite — AGENCY_ADMIN only.
   * Returns the accept link (raw token). No email is sent.
   */
  async invite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = getCtx(req);
      const input = inviteSchema.parse(req.body);
      const result = await teamService.invite(ctx, input);
      res.status(201).json({
        data: {
          message: `Invitation created for ${input.email}.`,
          acceptLink: result.acceptLink,
          token: result.token,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /team — paginated list of team members. AGENCY_ADMIN only.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = getCtx(req);
      const query = teamListQuerySchema.parse(req.query);
      const result = await teamService.listMembers(ctx, query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /team/:userId — change role or isActive.
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = getCtx(req);
      const input = updateTeamMemberSchema.parse(req.body);
      const updated = await teamService.updateMember(ctx, req.params.userId, input);
      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /team/:userId — soft deactivate (not hard delete).
   */
  async deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = getCtx(req);
      await teamService.deactivateMember(ctx, req.params.userId);
      res.json({ data: { message: 'Team member deactivated.' } });
    } catch (err) {
      next(err);
    }
  }
}

export const teamController = new TeamController();
