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
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80 px-4 lg:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo and Brand */}
        <div className="flex items-center gap-8">
          <div
            onClick={() => setCurrentTab('dashboard')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-[1.5px] shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Boxes className="w-5 h-5 text-indigo-400 group-hover:text-emerald-300 transition-colors" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-heading text-xl font-bold tracking-tight text-white">Stock<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">Sense</span></span>
                <span className="text-[10px] uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">IMS</span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Append-Only Inventory Ledger</p>
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
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm shadow-indigo-900/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
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
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${wsConnected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
            title={wsConnected ? 'Real-time updates connected' : 'Real-time updates disconnected'}
            aria-live="polite"
          >
            <span className="relative flex h-2 w-2">
              {wsConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${wsConnected ? 'bg-emerald-500' : 'bg-slate-500'}`}></span>
            </span>
            <span className="tracking-wide">{wsConnected ? 'Live Ledger' : 'Offline'}</span>
          </div>

          {/* Low Stock Alerts Bell */}
          <button
            onClick={onOpenAlerts}
            className="relative p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
            title="Stock alerts and reordering rules"
            aria-label="Stock Alerts"
          >
            <Bell className="w-5 h-5" />
            {reorderAlertsCount > 0 && (
              <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold text-white bg-amber-500 rounded-full px-1 shadow-md shadow-amber-500/40 animate-pulse">
                {reorderAlertsCount}
              </span>
            )}
          </button>

          {/* User Profile Menu */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-700/60 text-slate-200 text-sm font-medium transition-all"
              aria-expanded={profileOpen}
              aria-haspopup="true"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                {user?.name.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-semibold leading-tight text-slate-200">{user?.name}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Shield className="w-2.5 h-2.5 text-indigo-400" />
                  {user?.role === 'INVENTORY_MANAGER' ? 'Manager' : 'Staff'}
                </p>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-64 glass-panel rounded-xl shadow-2xl border border-slate-700/80 py-2 text-sm z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3.5 py-2.5 border-b border-slate-800">
                  <p className="font-semibold text-slate-200">{user?.name}</p>
                  <p className="text-xs text-slate-400">{user?.email}</p>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    <Shield className="w-3 h-3 text-indigo-400" />
                    {user?.role}
                  </div>
                </div>

                {/* Quick Account Switcher (For Pair-Programming / Testing / Grading) */}
                <div className="px-3.5 py-2 border-b border-slate-800 text-xs">
                  <p className="text-[11px] font-medium text-slate-400 mb-1.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" /> Quick Role Switcher
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => switchAccount('INVENTORY_MANAGER')}
                      className={`px-2 py-1.5 rounded text-[11px] font-medium text-center transition-all ${
                        isManager
                          ? 'bg-indigo-600 text-white font-semibold'
                          : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Manager
                    </button>
                    <button
                      onClick={() => switchAccount('WAREHOUSE_STAFF')}
                      className={`px-2 py-1.5 rounded text-[11px] font-medium text-center transition-all ${
                        !isManager
                          ? 'bg-indigo-600 text-white font-semibold'
                          : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
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
                  className="w-full flex items-center gap-2 px-3.5 py-2 text-rose-400 hover:bg-rose-500/10 text-left transition-colors"
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
      <div className="md:hidden flex items-center justify-around pt-3 mt-2 border-t border-slate-800/80 overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-lg text-xs font-medium ${
                isActive ? 'text-indigo-400 font-semibold' : 'text-slate-400'
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
