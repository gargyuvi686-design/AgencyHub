import { prisma } from './prisma';

const TENANT_MODELS = new Set([
  'User',
  'Client',
  'Project',
  'ProjectMember',
  'Milestone',
  'Task',
  'TaskComment',
  'Meeting',
  'Feedback',
  'FeedbackComment',
  'File',
  'ActivityLog',
  'Invitation',
]);

const CLIENT_SCOPED_MODELS = new Set([
  'User',
  'Client',
  'Project',
  'ProjectMember',
  'Milestone',
  'Task',
  'TaskComment',
  'Meeting',
  'Feedback',
  'FeedbackComment',
  'File',
  'ActivityLog',
  'Invitation',
]);

function applyScopedWhere(
  model: string,
  where: Record<string, any> | undefined,
  agencyId: string,
  clientId?: string | null,
): Record<string, any> {
  const baseWhere = { ...(where ?? {}), agencyId } as Record<string, any>;

  if (!clientId || !CLIENT_SCOPED_MODELS.has(model)) {
    return baseWhere;
  }

  if (model === 'Client') {
    return { AND: [baseWhere, { id: clientId }] };
  }

  if (['Project', 'Feedback', 'User', 'Invitation'].includes(model)) {
    return { ...baseWhere, clientId };
  }

  if (model === 'FeedbackComment') {
    return {
      ...baseWhere,
      feedback: {
        ...(baseWhere.feedback ?? {}),
        clientId,
      },
    };
  }

  if (model === 'TaskComment') {
    const taskWhere = baseWhere.task ?? {};
    return {
      ...baseWhere,
      task: {
        ...taskWhere,
        project: {
          ...(taskWhere.project ?? {}),
          clientId,
        },
      },
    };
  }

  return {
    ...baseWhere,
    project: {
      ...(baseWhere.project ?? {}),
      clientId,
    },
  };
}

/**
 * Creates a scoped Prisma client that enforces agencyId (and optionally clientId)
 * across all tenant queries.
 */
export function createScopedPrisma(agencyId: string, clientId?: string | null) {
  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            args.where = applyScopedWhere(model, args.where, agencyId, clientId);
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            args.where = applyScopedWhere(model, args.where, agencyId, clientId);
          }
          return query(args);
        },
        async findFirstOrThrow({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            args.where = applyScopedWhere(model, args.where, agencyId, clientId);
          }
          return query(args);
        },
        async findUnique({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            const modelName = model.charAt(0).toLowerCase() + model.slice(1);
            const rawWhere = (args.where ?? {}) as Record<string, any>;
            let whereClause = applyScopedWhere(model, rawWhere, agencyId, clientId);
            for (const [key, value] of Object.entries(rawWhere)) {
              if (
                value &&
                typeof value === 'object' &&
                !Array.isArray(value) &&
                !(value instanceof Date)
              ) {
                whereClause = { ...whereClause, ...value };
                delete (whereClause as Record<string, any>)[key];
              }
            }
            return (prisma as any)[modelName].findFirst({
              where: whereClause,
              select: args.select,
              include: args.include,
            });
          }
          return query(args);
        },
        async findUniqueOrThrow({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            const modelName = model.charAt(0).toLowerCase() + model.slice(1);
            const rawWhere = (args.where ?? {}) as Record<string, any>;
            let whereClause = applyScopedWhere(model, rawWhere, agencyId, clientId);
            for (const [key, value] of Object.entries(rawWhere)) {
              if (
                value &&
                typeof value === 'object' &&
                !Array.isArray(value) &&
                !(value instanceof Date)
              ) {
                whereClause = { ...whereClause, ...value };
                delete (whereClause as Record<string, any>)[key];
              }
            }
            return (prisma as any)[modelName].findFirstOrThrow({
              where: whereClause,
              select: args.select,
              include: args.include,
            });
          }
          return query(args);
        },
        async count({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            args.where = applyScopedWhere(model, args.where, agencyId, clientId);
          }
          return query(args);
        },
        async aggregate({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            args.where = applyScopedWhere(model, args.where, agencyId, clientId);
          }
          return query(args);
        },
        async groupBy({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            args.where = applyScopedWhere(model, args.where, agencyId, clientId);
          }
          return query(args);
        },
        async create({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            // Cast through any to avoid Prisma's strict union types
            (args.data as any).agencyId = agencyId;
          }
          return query(args);
        },
        async createMany({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            if (Array.isArray(args.data)) {
              args.data = args.data.map((item: any) => ({ ...item, agencyId }));
            } else if (args.data) {
              args.data = { ...(args.data as any), agencyId };
            }
          }
          return query(args);
        },
        async update({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            throw new Error(`Direct update on tenant model ${model} is disabled for isolation safety; use updateMany instead.`);
          }
          return query(args);
        },
        async delete({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            throw new Error(`Direct delete on tenant model ${model} is disabled for isolation safety; use deleteMany instead.`);
          }
          return query(args);
        },
        async upsert({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            throw new Error(`Direct upsert on tenant model ${model} is disabled for isolation safety; use create/updateMany instead.`);
          }
          return query(args);
        },
        async updateMany({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            args.where = applyScopedWhere(model, args.where, agencyId, clientId);
          }
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            args.where = applyScopedWhere(model, args.where, agencyId, clientId);
          }
          return query(args);
        },
      },
    },
    model: {
      $allModels: {
        async findScoped<T>(
          this: T,
          args: { id: string; clientId?: string | null },
        ): Promise<Record<string, unknown> | null> {
          const ctx = this as any;
          const where: Record<string, unknown> = {
            id: args.id,
            agencyId,
          };
          if (clientId && args.clientId !== undefined) {
            where.clientId = clientId;
          }
          return ctx.findFirst({ where });
        },
      },
    },
  });
}

export type ScopedPrismaClient = ReturnType<typeof createScopedPrisma>;

