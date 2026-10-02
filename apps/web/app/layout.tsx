import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'AgencyHub',
    template: '%s | AgencyHub',
  },
  description: 'Multi-tenant agency project management platform by AppZex.',
  robots: { index: false }, // SaaS app — not for search indexing
};

import { AuthProvider } from '../lib/auth-context';
import { QueryProvider } from '../lib/query-provider';
import { SupportModeBanner } from '../components/SupportModeBanner';
import { Toaster } from '../components/ui/toaster';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className={inter.className}>
        <QueryProvider>
          <AuthProvider>
            <SupportModeBanner />
            {children}
            <Toaster />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
