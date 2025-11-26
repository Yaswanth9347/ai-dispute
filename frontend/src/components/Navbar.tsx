'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  FileText,
  Home,
  Settings,
  Sparkles,
  Zap,
  Menu,
  X,
  MessageSquare,
  Users,
} from 'lucide-react';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import GlobalSearch from '@/components/navbar/GlobalSearch';
import DisputeSearch from '@/components/navbar/DisputeSearch';
import UserProfileDropdown from '@/components/navbar/UserProfileDropdown';
import ThemeToggle from '@/components/navbar/ThemeToggle';
import AIAssistantButton from '@/components/navbar/AIAssistantButton';

export default function Navbar() {
  const pathname = usePathname();
  const [openMobile, setOpenMobile] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const isActive = (path: string) =>
    pathname === path || (path !== '/' && pathname?.startsWith(path));

  // Determine auth state on client and listen for storage changes
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

  // Re-check when the route changes
  useEffect(() => {
    checkAuth();
  }, [pathname]);

  // Add shadow on scroll
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setOpenMobile(false);
  }, [pathname]);

  if (!isAuthenticated) return null;

  return (
    <>
      <header className={`sticky top-0 z-50 backdrop-blur-md bg-white/95 border-b transition-shadow duration-200 ${scrolled ? 'shadow-md' : ''}`}>
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Left - logo only */}
            <div className="flex items-center flex-shrink-0">
              <Link href="/dashboard" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="hidden sm:block">
                  <div className="text-base font-bold text-gray-900">AI Dispute Resolver</div>
                  <div className="text-xs text-gray-500 -mt-0.5">Smart Legal Solutions</div>
                </div>
              </Link>
            </div>

            {/* Right - nav + search & actions */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Desktop nav - moved to right */}
              <nav className="hidden lg:flex items-center gap-2">
                {navItem('/dashboard', <Home className="w-4 h-4" />, 'Dashboard', isActive('/dashboard'))}
                {navItem('/disputes', <FileText className="w-4 h-4" />, 'Disputes', isActive('/disputes'))}
                {navItem('/messages', <MessageSquare className="w-4 h-4" />, 'Messages', isActive('/messages'))}
                {navItem('/analytics', <BarChart3 className="w-4 h-4" />, 'Analytics', isActive('/analytics'))}
                {navItem('/workflow', <Zap className="w-4 h-4" />, 'Workflow', isActive('/workflow'))}
              </nav>

              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                {/* Dispute Search - Only on Disputes page */}
                {pathname?.startsWith('/disputes') && (
                  <div className="flex-shrink-0">
                    <DisputeSearch />
                  </div>
                )}

                {/* AI Assistant */}
                <div className="flex-shrink-0">
                  <AIAssistantButton />
                </div>

                {/* Theme Toggle */}
                <div className="flex-shrink-0">
                  <ThemeToggle />
                </div>

                {/* Notifications */}
                <div className="flex-shrink-0">
                  <NotificationCenter />
                </div>

                {/* User Profile Dropdown */}
                <div className="flex-shrink-0">
                  <UserProfileDropdown />
                </div>

                {/* Mobile menu toggle */}
                <button
                  onClick={() => setOpenMobile(!openMobile)}
                  className="lg:hidden inline-flex items-center justify-center p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
                  aria-label="Toggle menu"
                  aria-expanded={openMobile}
                >
                  {openMobile ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile slide-out menu */}
      {openMobile && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setOpenMobile(false)}
            aria-hidden="true"
          />

          <aside className="fixed right-0 top-0 h-full w-80 bg-white shadow-2xl z-50 lg:hidden transform transition-transform duration-300">
            <div className="flex flex-col h-full">
              {/* Mobile header */}
              <div className="px-4 py-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900">AI Dispute</div>
                      <div className="text-xs text-gray-500">Navigation</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setOpenMobile(false)}
                    className="p-2 rounded-lg hover:bg-gray-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Mobile navigation */}
              <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
                {mobileNavItem('/dashboard', <Home className="w-5 h-5" />, 'Dashboard', isActive('/dashboard'), () => setOpenMobile(false))}
                {mobileNavItem('/disputes', <FileText className="w-5 h-5" />, 'My Disputes', isActive('/disputes'), () => setOpenMobile(false))}
                {mobileNavItem('/messages', <MessageSquare className="w-5 h-5" />, 'Messages', isActive('/messages'), () => setOpenMobile(false))}
                {mobileNavItem('/analytics', <BarChart3 className="w-5 h-5" />, 'Analytics', isActive('/analytics'), () => setOpenMobile(false))}
                {mobileNavItem('/workflow', <Zap className="w-5 h-5" />, 'Workflow', isActive('/workflow'), () => setOpenMobile(false))}
                
                <div className="border-t my-4"></div>
                
                {mobileNavItem('/settings', <Settings className="w-5 h-5" />, 'Settings', isActive('/settings'), () => setOpenMobile(false))}
                {mobileNavItem('/help', <Users className="w-5 h-5" />, 'Help & Support', isActive('/help'), () => setOpenMobile(false))}
              </nav>

              {/* Mobile footer */}
              <div className="px-4 py-3 border-t bg-gray-50">
                <p className="text-xs text-gray-500 text-center">Version 1.0.0</p>
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
}

/* ---------- Helper Functions ---------- */

function navItem(path: string, icon: React.ReactNode, label: string, active = false) {
  return (
    <Link
      href={path}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
        active 
          ? 'bg-blue-600 text-white shadow-sm' 
          : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      <span className={active ? 'text-white' : 'text-gray-500'}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

function mobileNavItem(path: string, icon: React.ReactNode, label: string, active = false, onClick?: () => void) {
  return (
    <Link
      href={path}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
        active 
          ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600' 
          : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      <span className={active ? 'text-blue-600' : 'text-gray-500'}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
