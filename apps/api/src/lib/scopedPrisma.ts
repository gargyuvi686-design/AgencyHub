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
            args.where = { ...args.where, agencyId };
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            args.where = { ...args.where, agencyId };
          }
          return query(args);
        },
        async findFirstOrThrow({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            args.where = { ...args.where, agencyId };
          }
          return query(args);
        },
        async findUnique({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            const modelName = model.charAt(0).toLowerCase() + model.slice(1);
            let whereClause = { ...args.where, agencyId };
            for (const key of Object.keys(args.where)) {
              if (
                args.where[key] &&
                typeof args.where[key] === 'object' &&
                !Array.isArray(args.where[key]) &&
                !(args.where[key] instanceof Date)
              ) {
                whereClause = { ...whereClause, ...args.where[key] };
                delete (whereClause as any)[key];
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
            let whereClause = { ...args.where, agencyId };
            for (const key of Object.keys(args.where)) {
              if (
                args.where[key] &&
                typeof args.where[key] === 'object' &&
                !Array.isArray(args.where[key]) &&
                !(args.where[key] instanceof Date)
              ) {
                whereClause = { ...whereClause, ...args.where[key] };
                delete (whereClause as any)[key];
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
            args.where = { ...args.where, agencyId };
          }
          return query(args);
        },
        async aggregate({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            args.where = { ...args.where, agencyId };
          }
          return query(args);
        },
        async groupBy({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            args.where = { ...args.where, agencyId };
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
            args.where = { ...args.where, agencyId };
          }
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            args.where = { ...args.where, agencyId };
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

// TODO (Phase 5): Add clientId scoping across tenant queries for CLIENT portal users (scenarios 3, 4, 9).

