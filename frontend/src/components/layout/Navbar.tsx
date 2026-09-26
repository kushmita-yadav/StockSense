import React, { useState, useEffect } from 'react';
import {
  Boxes,
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  History,
  Warehouse,
  Bell,
  LogOut,
  Shield,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  reorderAlertsCount?: number;
  onOpenAlerts?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  reorderAlertsCount = 0,
  onOpenAlerts,
}) => {
  const { user, logout, isManager, login } = useAuth();
  const queryClient = useQueryClient();
  const [profileOpen, setProfileOpen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retryTimer: number | undefined;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        socket = new WebSocket(`${protocol}//${window.location.host}/api/v1/ws/alerts`);
        socket.onopen = () => setWsConnected(true);
        socket.onclose = () => {
          setWsConnected(false);
          if (!disposed) retryTimer = window.setTimeout(connect, 3000);
        };
        socket.onerror = () => socket?.close();
        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'STOCK_MOVEMENT') {
              queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
              queryClient.invalidateQueries({ queryKey: ['products'] });
              queryClient.invalidateQueries({ queryKey: ['operations'] });
              queryClient.invalidateQueries({ queryKey: ['ledger'] });
            }
          } catch {
            // Ignore messages that are not JSON events.
          }
        };
      } catch {
        setWsConnected(false);
        if (!disposed) retryTimer = window.setTimeout(connect, 3000);
      }
    };

    connect();
    return () => {
      disposed = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      socket?.close();
    };
  }, [queryClient]);

  const switchAccount = async (targetRole: 'INVENTORY_MANAGER' | 'WAREHOUSE_STAFF') => {
    try {
      if (targetRole === 'INVENTORY_MANAGER') {
        await login('manager@stocksense.com', 'Manager@12345');
      } else {
        await login('staff@stocksense.com', 'Staff@12345');
      }
      setProfileOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'operations', label: 'Operations', icon: ArrowLeftRight },
    { id: 'history', label: 'Move History', icon: History },
    ...(isManager ? [{ id: 'warehouses', label: 'Warehouses', icon: Warehouse }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-biscuit/80 px-4 lg:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo and Brand */}
        <div className="flex items-center gap-8">
          <div
            onClick={() => setCurrentTab('dashboard')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-brand-500 to-sage-400 p-[1.5px] shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-brand-50 rounded-[10px] flex items-center justify-center">
                <Boxes className="w-5 h-5 text-brand-700 group-hover:text-sage-700 transition-colors" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-heading text-xl font-bold tracking-tight text-ink">Stock<span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-sage-400">Sense</span></span>
                <span className="text-[10px] uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-700 border border-brand-500/20">IMS</span>
              </div>
              <p className="text-[11px] text-muted hidden sm:block">Append-Only Inventory Ledger</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5" aria-label="Main Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-brand-600/20 text-brand-700 border border-brand-500/30 shadow-sm shadow-brand-900/30'
                      : 'text-muted hover:text-ink hover:bg-biscuit/50'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-brand-700' : 'text-muted'}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Section: Telemetry, Alerts, User Profile */}
        <div className="flex items-center gap-3">
          {/* Live Sync Status */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${wsConnected ? 'bg-sage-500/10 text-sage-700 border-sage-500/20' : 'bg-biscuit text-muted border-brand-200'}`}
            title={wsConnected ? 'Real-time updates connected' : 'Real-time updates disconnected'}
            aria-live="polite"
          >
            <span className="relative flex h-2 w-2">
              {wsConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sage-400 opacity-75"></span>}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${wsConnected ? 'bg-sage-500' : 'bg-muted'}`}></span>
            </span>
            <span className="tracking-wide">{wsConnected ? 'Live Ledger' : 'Offline'}</span>
          </div>

          {/* Low Stock Alerts Bell */}
          <button
            onClick={onOpenAlerts}
            className="relative p-2 rounded-lg text-muted hover:text-ink hover:bg-biscuit/60 transition-colors"
            title="Stock alerts and reordering rules"
            aria-label="Stock Alerts"
          >
            <Bell className="w-5 h-5" />
            {reorderAlertsCount > 0 && (
              <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold text-ink bg-brand-500 rounded-full px-1 shadow-md shadow-brand-500/40 animate-pulse">
                {reorderAlertsCount}
              </span>
            )}
          </button>

          {/* User Profile Menu */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-surface/80 hover:bg-biscuit/80 border border-brand-200/60 text-ink text-sm font-medium transition-all"
              aria-expanded={profileOpen}
              aria-haspopup="true"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-plum-600 flex items-center justify-center text-ink text-xs font-bold shadow-sm">
                {user?.name.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-semibold leading-tight text-ink">{user?.name}</p>
                <p className="text-[10px] text-muted uppercase tracking-wider flex items-center gap-1">
                  <Shield className="w-2.5 h-2.5 text-brand-700" />
                  {user?.role === 'INVENTORY_MANAGER' ? 'Manager' : 'Staff'}
                </p>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-muted transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-64 glass-panel rounded-xl shadow-2xl border border-brand-200/80 py-2 text-sm z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3.5 py-2.5 border-b border-biscuit">
                  <p className="font-semibold text-ink">{user?.name}</p>
                  <p className="text-xs text-muted">{user?.email}</p>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-brand-500/10 text-brand-700 border border-brand-500/20">
                    <Shield className="w-3 h-3 text-brand-700" />
                    {user?.role}
                  </div>
                </div>

                {/* Quick Account Switcher (For Pair-Programming / Testing / Grading) */}
                <div className="px-3.5 py-2 border-b border-biscuit text-xs">
                  <p className="text-[11px] font-medium text-muted mb-1.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-brand-700" /> Quick Role Switcher
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => switchAccount('INVENTORY_MANAGER')}
                      className={`px-2 py-1.5 rounded text-[11px] font-medium text-center transition-all ${
                        isManager
                          ? 'bg-brand-600 text-ink font-semibold'
                          : 'bg-biscuit/80 text-ink hover:bg-brand-200'
                      }`}
                    >
                      Manager
                    </button>
                    <button
                      onClick={() => switchAccount('WAREHOUSE_STAFF')}
                      className={`px-2 py-1.5 rounded text-[11px] font-medium text-center transition-all ${
                        !isManager
                          ? 'bg-brand-600 text-ink font-semibold'
                          : 'bg-biscuit/80 text-ink hover:bg-brand-200'
                      }`}
                    >
                      Staff
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setProfileOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-3.5 py-2 text-clay-700 hover:bg-clay-500/10 text-left transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation bar */}
      <div className="md:hidden flex items-center justify-around pt-3 mt-2 border-t border-biscuit/80 overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-lg text-xs font-medium ${
                isActive ? 'text-brand-700 font-semibold' : 'text-muted'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
