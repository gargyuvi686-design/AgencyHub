'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../lib/auth-context';
import { ApiException } from '../../../lib/api';
import {
  Lock,
  Mail,
  ArrowRight,
  Shield,
  Building2,
  Users,
  UserCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

const DEMO_ACCOUNTS = [
  {
    role: 'Super Admin',
    desc: 'Full platform oversight & support mode',
    email: 'superadmin@agencyhub.test',
    password: 'Password123!',
    portal: '/admin',
    icon: Shield,
    badgeColor: 'border-purple-500/30 text-purple-300 bg-purple-500/10',
  },
  {
    role: 'Agency Admin',
    desc: 'Acme Digital Agency owner & projects',
    email: 'admin@acme.test',
    password: 'Password123!',
    portal: '/app',
    icon: Building2,
    badgeColor: 'border-indigo-500/30 text-indigo-300 bg-indigo-500/10',
  },
  {
    role: 'Agency Member',
    desc: 'Assigned project collaborator',
    email: 'member@acme.test',
    password: 'Password123!',
    portal: '/app',
    icon: Users,
    badgeColor: 'border-blue-500/30 text-blue-300 bg-blue-500/10',
  },
  {
    role: 'Client Portal',
    desc: 'Nike Innovation customer view',
    email: 'client@nike.test',
    password: 'Password123!',
    portal: '/portal',
    icon: UserCheck,
    badgeColor: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10',
  },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeAccountLabel, setActiveAccountLabel] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
    } catch (err: unknown) {
      if (err instanceof ApiException) {
        if (err.error.code === 'AGENCY_SUSPENDED') {
          setErrorMsg('This agency account is suspended. Please contact support.');
        } else if (err.status === 401) {
          setErrorMsg('Invalid email or password.');
        } else if (err.status === 429) {
          setErrorMsg('Too many failed attempts. Please wait 15 minutes.');
        } else {
          setErrorMsg(err.error.message || 'Authentication failed.');
        }
      } else {
        setErrorMsg('Unable to connect to the server. Please check your network.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectDemo = (account: typeof DEMO_ACCOUNTS[0]) => {
    setEmail(account.email);
    setPassword(account.password);
    setActiveAccountLabel(account.role);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[41%_59%]">
      <section className="login-panel flex min-h-[340px] flex-col justify-between bg-indigo-950 px-7 py-8 text-white sm:px-12 lg:min-h-screen lg:px-[11%] lg:py-10">
        <Link href="/login" className="flex w-fit items-center gap-3 font-bold text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500"><Building2 className="h-5 w-5" /></span>
          <span className="text-lg">AgencyHub</span>
        </Link>
        <div className="max-w-md py-10 lg:py-0">
          <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">Every project, client and deadline in one calm place.</h1>
          <p className="mt-5 max-w-sm text-base leading-7 text-indigo-100">A private workspace for your agency and a simple portal for your clients.</p>
          <ul className="mt-7 space-y-3 text-sm text-indigo-50">
            <li className="flex gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-indigo-300" />Private workspace per agency</li>
            <li className="flex gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-indigo-300" />Client portal with approvals</li>
            <li className="flex gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-indigo-300" />AI meeting summaries to tasks</li>
          </ul>
        </div>
        <p className="hidden text-xs text-indigo-200 lg:block">© AgencyHub</p>
      </section>

      <section className="flex min-h-[560px] items-center justify-center px-4 py-10 sm:px-8 lg:min-h-screen">
        <div className="auth-surface surface-card w-full max-w-[426px] p-6 sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h2>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your workspace</p>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {errorMsg && <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{errorMsg}</span></div>}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-foreground">Email</label>
              <div className="relative"><Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@agency.com" className="h-10 w-full rounded-lg border border-input bg-white pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-600" /></div>
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-foreground">Password</label>
              <div className="relative"><Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="h-10 w-full rounded-lg border border-input bg-white pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-600" /></div>
            </div>
            <button type="submit" disabled={isSubmitting} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
              {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />Signing in...</> : <>Sign in<ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>
          <div className="mt-5 text-center text-xs font-medium text-muted-foreground">Demo accounts</div>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {DEMO_ACCOUNTS.map((acc) => {
              const isSelected = activeAccountLabel === acc.role;
              return <button key={acc.role} type="button" onClick={() => handleSelectDemo(acc)} aria-pressed={isSelected} className={`rounded-full border px-3 py-2 text-xs font-medium transition-colors ${isSelected ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-input bg-white text-foreground hover:bg-muted'}`}>{acc.role === 'Agency Member' ? 'Member' : acc.role === 'Client Portal' ? 'Client' : acc.role}</button>;
            })}
          </div>
          <p className="mt-5 text-center text-xs text-muted-foreground">New here? <Link href="/register" className="font-semibold text-indigo-700 underline underline-offset-2">Register your agency</Link></p>
        </div>
      </section>
    </div>
  );
}
