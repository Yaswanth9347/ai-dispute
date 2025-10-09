'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  FileText,
  Gavel,
  Home,
  Settings,
  User,
  Sparkles,
  Zap,
  Bell,
  Menu,
  X,
} from 'lucide-react';
import NotificationCenter from '@/components/notifications/NotificationCenter';

export default function Navbar() {
  const pathname = usePathname();
  const [openMobile, setOpenMobile] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const isActive = (path: string) =>
    pathname === path || (path !== '/' && pathname?.startsWith(path));

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    window.location.href = '/auth/login';
  };

  // Determine auth state on client and listen for storage changes (login/logout from other tabs)
    const checkAuth = () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      setIsAuthenticated(!!token);
    };

    useEffect(() => {
      checkAuth();

      const onStorage = (e: StorageEvent) => {
        if (e.key === 'auth_token') checkAuth();
      };

      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    }, []);

    // Also re-check when the route changes (covers login happening in same tab)
    useEffect(() => {
      checkAuth();
    }, [pathname]);

  if (!isAuthenticated) return null;

  return (
    <>
      <header className="sticky top-0 z-50 backdrop-blur-sm bg-white/80 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left - logo + main nav */}
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold shadow">
                  AI
                </div>
                <div className="hidden sm:block">
                  <div className="text-base font-semibold text-gray-900">AI Dispute Resolver</div>
                  <div className="text-xs text-gray-500 -mt-0.5">Resolve disputes faster</div>
                </div>
              </Link>

              {/* Desktop nav */}
              <nav className="hidden md:flex items-center gap-1">
                {navItem('/dashboard', <Home className="w-4 h-4" />, 'Dashboard', isActive('/dashboard'))}
                {navItem('/cases', <FileText className="w-4 h-4" />, 'Cases', isActive('/cases'))}
                {navItem('/analytics', <BarChart3 className="w-4 h-4" />, 'Analytics', isActive('/analytics'))}
                {navItem('/ai-assistant', <Sparkles className="w-4 h-4" />, 'AI Assistant', isActive('/ai-assistant'))}
                {navItem('/workflow', <Settings className="w-4 h-4" />, 'Workflow', isActive('/workflow'))}
                {navItem('/automation', <Zap className="w-4 h-4" />, 'Automation', isActive('/automation'))}
              </nav>
            </div>

            {/* Right - actions */}
            <div className="flex items-center gap-3">
              {/* notifications */}
              <div className="relative">
                <NotificationCenter />
                {/* small badge (example) */}
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-medium rounded-full bg-red-600 text-white">3</span>
              </div>

              {/* profile */}
              <div className="relative">
                <button
                  onClick={() => setProfileOpen((s) => !s)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-white hover:shadow-sm transition"
                  aria-expanded={profileOpen}
                >
                  <User className="w-4 h-4 text-gray-700" />
                  <span className="hidden sm:inline text-sm text-gray-700">Profile</span>
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-44 bg-white border rounded-md shadow-lg py-2">
                    <Link href="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Account</Link>
                    <Link href="/settings" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Settings</Link>
                    <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Logout</button>
                  </div>
                )}
              </div>

              {/* Logout is available inside the Profile menu (and mobile menu). Standalone logout button removed to avoid duplication. */}

              {/* mobile menu toggle */}
              <button
                onClick={() => setOpenMobile((s) => !s)}
                className="md:hidden inline-flex items-center justify-center p-2 rounded-md border bg-white"
                aria-label="Toggle menu"
              >
                {openMobile ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile slide-out */}
      <div
        className={`fixed inset-0 z-40 transition-transform duration-200 ${openMobile ? 'translate-x-0' : 'translate-x-full'}`}
        aria-hidden={!openMobile}
      >
        <div className="absolute inset-0 bg-black/40" onClick={() => setOpenMobile(false)} />

        <aside className="absolute right-0 top-0 h-full w-80 bg-white border-l shadow-xl p-4 overflow-auto">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-gradient-to-br from-indigo-600 to-violet-500 flex items-center justify-center text-white">AI</div>
              <div>
                <div className="text-sm font-semibold text-gray-900">AI Dispute</div>
                <div className="text-xs text-gray-500">Quick links</div>
              </div>
            </div>
            <button onClick={() => setOpenMobile(false)} className="p-1 rounded-md border">
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="space-y-2">
            {mobileNavItem('/ai-assistant', <Sparkles className="w-5 h-5" />, 'AI Assistant', isActive('/ai-assistant'), () => setOpenMobile(false))}
            {mobileNavItem('/dashboard', <Home className="w-5 h-5" />, 'Dashboard', isActive('/dashboard'), () => setOpenMobile(false))}
            {mobileNavItem('/cases', <FileText className="w-5 h-5" />, 'Cases', isActive('/cases'), () => setOpenMobile(false))}
            {mobileNavItem('/analytics', <BarChart3 className="w-5 h-5" />, 'Analytics', isActive('/analytics'), () => setOpenMobile(false))}
            {mobileNavItem('/workflow', <Settings className="w-5 h-5" />, 'Workflow', isActive('/workflow'), () => setOpenMobile(false))}
            {mobileNavItem('/automation', <Zap className="w-5 h-5" />, 'Automation', isActive('/automation'), () => setOpenMobile(false))}
            <div className="border-t mt-3 pt-3 space-y-1">
              <Link href="/profile" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-50"><User className="w-5 h-5" /> Profile</Link>
              <button onClick={handleLogout} className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-50 text-red-600">Logout</button>
            </div>
          </nav>
        </aside>
      </div>
    </>
  );
}

/* ---------- small helpers ---------- */

function navItem(path: string, icon: React.ReactNode, label: string, active = false) {
  return (
    <Link
      href={path}
      className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition ${
        active ? 'bg-blue-600 text-white shadow' : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      <span className="text-inherit">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

function mobileNavItem(path: string, icon: React.ReactNode, label: string, active = false, onClick?: () => void) {
  return (
    <Link
      href={path}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
