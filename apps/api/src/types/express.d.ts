import { UserRole, AgencyStatus } from '@prisma/client';

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  agencyId: string | null;
  clientId: string | null;
}

export interface SupportContext {
  superAdminId: string;
  supportAgencyId: string;
  supportAgencyName?: string;
  exp?: number;
}

export interface AgencyContext {
  id: string;
  name: string;
  slug: string;
  status: AgencyStatus;
  plan: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      agency?: AgencyContext;
      support?: SupportContext;
      /**
       * The effective agency ID for this request.
       * For regular agency/client users: user.agencyId.
       * For SUPER_ADMIN in support mode: support.supportAgencyId.
       */
      effectiveAgencyId?: string;
    }
  }
}
