import { redirect } from 'next/navigation';

/**
 * Root page — immediately redirects to login.
 * Role-based redirect after login is handled in (auth)/login/page.tsx
 * based on the role returned by GET /api/v1/auth/me.
 */
export default function RootPage() {
  redirect('/login');
}
