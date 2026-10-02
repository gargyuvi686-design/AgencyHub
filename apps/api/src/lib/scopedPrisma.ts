import { prisma } from './prisma';

/**
 * Scoped Prisma extension factory.
 *
 * Returns a Prisma extension that augments selected models with a `findScoped`
 * helper that ALWAYS injects `agency_id = agencyId` into queries and optionally
 * `client_id = clientId` for CLIENT-role callers.
 *
 * Tenancy rule (doc 02 §3):
 *   - agency_id comes from the VERIFIED JWT, never the request body/URL.
 *   - Cross-tenant ID miss returns 404, not 403 (avoid leaking existence).
 *
 * @param agencyId  Effective agency ID resolved by authenticate middleware.
 * @param clientId  Optional – set for CLIENT-role callers; scopes to their client record.
 */
export function createScopedPrisma(agencyId: string, clientId?: string | null) {
  return prisma.$extends({
    model: {
      $allModels: {
        /**
         * Find a single record, asserting it belongs to this tenant.
         * Equivalent to: WHERE id = ? AND agency_id = ? (AND client_id = ? for clients)
         * Returns null instead of throwing – callers convert to 404.
         */
        async findScoped<T>(
          this: T,
          args: { id: string; clientId?: string | null },
        ): Promise<Record<string, unknown> | null> {
          const ctx = this as any;
          const where: Record<string, unknown> = {
            id: args.id,
            agencyId,
          };

          // For CLIENT-role requests, additionally scope by clientId when provided
          if (clientId && args.clientId !== undefined) {
            where.clientId = clientId;
          }

          return ctx.findFirst({ where });
        },
      },
    },
  });
}

/**
 * Convenience type for scoped Prisma clients.
 */
export type ScopedPrismaClient = ReturnType<typeof createScopedPrisma>;
