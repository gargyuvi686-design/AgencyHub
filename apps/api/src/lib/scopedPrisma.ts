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
        async findUnique({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            const modelName = model.charAt(0).toLowerCase() + model.slice(1);
            return (prisma as any)[modelName].findFirst({
              where: { ...args.where, agencyId },
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
