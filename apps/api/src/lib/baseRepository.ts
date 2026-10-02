/**
 * Base repository class that all tenant repositories extend.
 *
 * Provides common helpers for agency-scoped reads:
 *   - findOrFail: finds by id+agencyId and throws 404 (not 403) on miss.
 *   - listPaginated: standard page/limit/total pattern.
 *
 * Key security invariant (doc 02 §3.4):
 *   "Fetch by ID always uses WHERE id = ? AND agency_id = ?
 *    A miss returns 404, never 403, to avoid leaking existence."
 */
import { PrismaClient } from '@prisma/client';
import { prisma } from './prisma';
import { Errors } from './errors';

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaginationInput {
  page?: number;
  limit?: number;
}

export abstract class BaseRepository {
  protected readonly db: PrismaClient;
  protected readonly agencyId: string;
  protected readonly clientId: string | null;

  constructor(agencyId: string, clientId: string | null = null) {
    this.db = prisma;
    this.agencyId = agencyId;
    this.clientId = clientId;
  }

  /**
   * Build standard WHERE clause for this tenant.
   */
  protected tenantWhere(overrides?: Record<string, unknown>): Record<string, unknown> {
    return {
      agencyId: this.agencyId,
      ...overrides,
    };
  }

  /**
   * Build WHERE clause for a specific ID within this tenant.
   * Returns 404 on miss — never 403 (avoids leaking cross-tenant existence).
   */
  protected async findOrFail<T>(
    model: any,
    id: string,
    extraWhere?: Record<string, unknown>,
    resourceName = 'Resource',
  ): Promise<T> {
    const record = await model.findFirst({
      where: {
        id,
        agencyId: this.agencyId,
        ...extraWhere,
      },
    });

    if (!record) {
      throw Errors.NOT_FOUND(resourceName);
    }

    return record as T;
  }

  /**
   * Resolve pagination parameters with sensible defaults.
   */
  protected parsePagination(input: PaginationInput): { skip: number; take: number; page: number; limit: number } {
    const page = Math.max(1, Number(input.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(input.limit) || 20));
    const skip = (page - 1) * limit;

    return { skip, take: limit, page, limit };
  }

  /**
   * Wrap a paginated Prisma findMany+count pair into standard response shape.
   */
  protected async paginate<T>(
    model: any,
    where: Record<string, unknown>,
    pagination: PaginationInput,
    options?: {
      select?: Record<string, unknown>;
      include?: Record<string, unknown>;
      orderBy?: Record<string, unknown> | Record<string, unknown>[];
    },
  ): Promise<PaginatedResult<T>> {
    const { skip, take, page, limit } = this.parsePagination(pagination);

    const [data, total] = await Promise.all([
      model.findMany({
        where,
        skip,
        take,
        ...options,
      }),
      model.count({ where }),
    ]);

    return {
      data: data as T[],
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
