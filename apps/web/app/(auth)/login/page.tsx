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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden selection:bg-indigo-500 selection:text-white">
      {/* Dynamic ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-gradient-to-tr from-indigo-600/20 via-purple-600/15 to-pink-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-3 backdrop-blur-sm">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Multi-Tenant Agency OS</span>
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
          Sign in to AgencyHub
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Or{' '}
          <Link
            href="/register"
            className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors underline underline-offset-4"
          >
            register a new agency
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl relative z-10 px-4">
        {/* Demo Account Quick-Fill Palette */}
        <div className="mb-6 bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl rounded-xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Quick-Fill Demo Personas
            </span>
            <span className="text-[11px] text-slate-500">1-click credentials</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {DEMO_ACCOUNTS.map((acc) => {
              const Icon = acc.icon;
              const isSelected = activeAccountLabel === acc.role;
              return (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => handleSelectDemo(acc)}
                  className={`flex flex-col items-center text-center p-2.5 rounded-lg border text-xs font-medium transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-500/15 shadow-sm shadow-indigo-500/20 text-white'
                      : 'border-slate-800/80 bg-slate-950/40 text-slate-300 hover:border-slate-700 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 mb-1.5 ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`} />
                  <span className="font-semibold truncate w-full">{acc.role}</span>
                  <span className="text-[10px] text-slate-500 truncate w-full mt-0.5">{acc.portal}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Login Card */}
        <div className="bg-slate-900/80 border border-slate-800 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-2xl sm:px-10">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {errorMsg && (
              <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-start gap-2.5 animate-fade-in">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                Email address
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@acme.test"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-lg shadow-indigo-600/20 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign in to Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Tenant isolation enforced
            </span>
            <span>Password: Password123!</span>
          </div>
        </div>
      </div>
    </div>
  );
}
