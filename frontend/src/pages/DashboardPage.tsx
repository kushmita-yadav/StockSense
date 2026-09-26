import React, { useState } from 'react';
import {
  PackageCheck,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  SlidersHorizontal,
  ArrowRight,
  Layers,
  Sparkles,
  Clock
} from 'lucide-react';
import { KPICard } from '../components/dashboard/KPICard';
import { StockSenseAssistant } from '../components/dashboard/StockSenseAssistant';
import { api } from '../lib/api';
import { useCategories, useKPIs, useWarehouses } from '../lib/queries';
import { useAuth } from '../context/AuthContext';

interface DashboardPageProps {
  onNavigate: (tab: string, extra?: any) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { isManager } = useAuth();
  // Real API dynamic filter parameters
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [reorderStatusMsg, setReorderStatusMsg] = useState<string | null>(null);
  const { data: kpis = null, isLoading: loading, refetch: fetchKPIs } = useKPIs(selectedWarehouse, selectedCategory);
  const { data: warehouses = [] } = useWarehouses();
  const { data: categories = [] } = useCategories();

  const handleTriggerReorders = async () => {
    try {
      setReorderStatusMsg('Evaluating inventory thresholds & generating receipts...');
      const res = await api.get('/products/rules/reorder-check?auto_create_drafts=true');
      const count = res.auto_created_draft_receipts?.length || 0;
      if (count > 0) {
        setReorderStatusMsg(`Successfully generated ${count} draft receipt(s) for replenishment!`);
        fetchKPIs();
      } else {
        setReorderStatusMsg('All stock levels are within normal limits. No replenishment needed.');
      }
      setTimeout(() => setReorderStatusMsg(null), 5000);
    } catch (err: any) {
      setReorderStatusMsg(`Error: ${err.message || 'Failed to trigger reorder rules'}`);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header and Dynamic Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink tracking-tight">
            Inventory Telemetry & Operations
          </h1>
          <p className="text-sm text-muted mt-1">
            Real-time balance derivation, pending fulfillment pipeline, and automated reorder triggers.
          </p>
        </div>

        {/* Dynamic Filters Bar */}
        <div className="flex flex-wrap items-center gap-2.5 glass-panel p-2 rounded-xl border border-biscuit">
          <div className="flex items-center gap-1.5 px-2 text-xs font-semibold text-muted">
            <SlidersHorizontal className="w-3.5 h-3.5 text-brand-700" />
            <span>Filters:</span>
          </div>

          {/* Warehouse Filter */}
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="bg-surface border border-brand-200/80 rounded-lg px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-brand-500 transition-colors"
            aria-label="Filter by Warehouse"
          >
            <option value="">All Warehouses</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.code} - {wh.name}
              </option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-surface border border-brand-200/80 rounded-lg px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-brand-500 transition-colors"
            aria-label="Filter by Category"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          {(selectedWarehouse || selectedCategory) && (
            <button
              onClick={() => {
                setSelectedWarehouse('');
                setSelectedCategory('');
              }}
              className="text-xs text-brand-700 hover:text-brand-700 font-medium px-2 py-1 transition-colors"
            >
              Reset
            </button>
          )}

          <button
            onClick={() => void fetchKPIs()}
            className="p-1.5 rounded-lg bg-biscuit hover:bg-brand-200 text-ink transition-colors"
            title="Refresh KPIs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-700' : ''}`} />
          </button>
        </div>
      </div>

      <StockSenseAssistant isManager={isManager} />

      {/* Reorder Notification Banner (if any) */}
      {reorderStatusMsg && (
        <div role="status" aria-live="polite" className="p-3.5 rounded-xl bg-brand-100/80 border border-brand-300/60 text-sm text-ink flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-700 flex-shrink-0" />
            <span>{reorderStatusMsg}</span>
          </div>
          <button
            onClick={() => setReorderStatusMsg(null)}
            className="text-xs font-semibold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title="Products In Stock"
          value={kpis?.total_products_in_stock ?? 0}
          subtitle={`${kpis?.total_products ?? 0} catalog products`}
          icon={PackageCheck}
          variant="emerald"
          onClick={() => onNavigate('products')}
        />
        <KPICard
          title="Low & Out of Stock"
          value={(kpis?.low_stock_items ?? 0) + (kpis?.out_of_stock_items ?? 0)}
          subtitle={`${kpis?.out_of_stock_items ?? 0} critical stockouts`}
          icon={AlertTriangle}
          variant={((kpis?.low_stock_items ?? 0) + (kpis?.out_of_stock_items ?? 0)) > 0 ? 'amber' : 'emerald'}
          onClick={() => onNavigate('products')}
        />
        <KPICard
          title="Pending Receipts"
          value={kpis?.pending_receipts ?? 0}
          subtitle="Vendor → Warehouse"
          icon={ArrowDownLeft}
          variant="indigo"
          onClick={() => onNavigate('operations', { tab: 'RECEIPT' })}
        />
        <KPICard
          title="Pending Deliveries"
          value={kpis?.pending_deliveries ?? 0}
          subtitle="Warehouse → Customer"
          icon={ArrowUpRight}
          variant="sky"
          onClick={() => onNavigate('operations', { tab: 'DELIVERY' })}
        />
        <KPICard
          title="Internal Transfers"
          value={kpis?.scheduled_transfers ?? 0}
          subtitle="Rack A → Rack B"
          icon={RefreshCw}
          variant="indigo"
          onClick={() => onNavigate('operations', { tab: 'INTERNAL' })}
        />
      </div>

      {/* Reorder Alerts & Replenishment Trigger */}
      {kpis && kpis.reorder_alerts.length > 0 && (
        <div className="glass-panel p-5 rounded-2xl border border-brand-500/30 bg-gradient-to-r from-brand-100/70 via-surface to-surface">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/30 text-brand-700">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-ink flex items-center gap-2">
                  Reorder Threshold Alerts ({kpis.reorder_alerts.length} items below minimum)
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Stock levels have dropped below defined safety thresholds. Generate automated replenishment receipts.
                </p>
              </div>
            </div>

            {isManager && (
              <button
                onClick={handleTriggerReorders}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-brand-400 to-brand-500 hover:from-brand-500 hover:to-brand-600 text-ink shadow-lg shadow-brand-500/20 transition-all font-sans"
              >
                <Sparkles className="w-4 h-4" />
                Auto-Generate Draft Receipts
              </button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {kpis.reorder_alerts.slice(0, 3).map((alert) => (
              <div
                key={alert.product_id}
                className="p-3 rounded-xl bg-surface/90 border border-biscuit text-xs flex items-center justify-between"
              >
                <div>
                  <p className="font-semibold text-ink">{alert.name}</p>
                  <p className="text-[11px] text-muted font-mono">{alert.sku}</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-brand-700">{alert.current_stock}</span>
                  <span className="text-muted"> / min {alert.min_stock_level} {alert.uom}</span>
                  <p className="text-[10px] text-brand-700">Restock +{alert.suggested_order_qty}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Operations Launchpad */}
      <div className="glass-panel p-5 rounded-2xl border border-biscuit">
        <h2 className="text-base font-bold text-ink mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-brand-700" /> Quick Operations Launchpad
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate('operations', { openModal: 'RECEIPT' })}
            className="flex items-center gap-3 p-3.5 rounded-xl bg-surface/80 hover:bg-biscuit border border-biscuit hover:border-brand-500/40 text-left transition-all group"
          >
            <div className="p-2.5 rounded-lg bg-sage-500/10 text-sage-700 border border-sage-500/20 group-hover:scale-105 transition-transform">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-xs text-ink">Receive Goods</p>
              <p className="text-[11px] text-muted">Vendor → Warehouse</p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('operations', { openModal: 'DELIVERY' })}
            className="flex items-center gap-3 p-3.5 rounded-xl bg-surface/80 hover:bg-biscuit border border-biscuit hover:border-brand-500/40 text-left transition-all group"
          >
            <div className="p-2.5 rounded-lg bg-plum-500/10 text-plum-700 border border-plum-500/20 group-hover:scale-105 transition-transform">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-xs text-ink">Dispatch Order</p>
              <p className="text-[11px] text-muted">Warehouse → Customer</p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('operations', { openModal: 'INTERNAL' })}
            className="flex items-center gap-3 p-3.5 rounded-xl bg-surface/80 hover:bg-biscuit border border-biscuit hover:border-brand-500/40 text-left transition-all group"
          >
            <div className="p-2.5 rounded-lg bg-brand-500/10 text-brand-700 border border-brand-500/20 group-hover:scale-105 transition-transform">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-xs text-ink">Internal Transfer</p>
              <p className="text-[11px] text-muted">Location A → Location B</p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('operations', { openModal: 'ADJUSTMENT' })}
            className="flex items-center gap-3 p-3.5 rounded-xl bg-surface/80 hover:bg-biscuit border border-biscuit hover:border-brand-500/40 text-left transition-all group"
          >
            <div className="p-2.5 rounded-lg bg-brand-500/10 text-brand-700 border border-brand-500/20 group-hover:scale-105 transition-transform">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-xs text-ink">Physical Count</p>
              <p className="text-[11px] text-muted">Stock Adjustment & Reasons</p>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Ledger Audit Telemetry Table */}
      <div className="glass-panel rounded-2xl border border-biscuit overflow-hidden">
        <div className="p-5 border-b border-biscuit flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <Clock className="w-4 h-4 text-sage-700" /> Recent Stock Ledger Movements
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Live audit trail directly recorded from the append-only stock ledger.
            </p>
          </div>
          <button
            onClick={() => onNavigate('history')}
            className="flex items-center gap-1.5 text-xs text-brand-700 hover:text-brand-700 font-semibold transition-colors"
          >
            View Full Ledger <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface/90 text-muted uppercase tracking-wider font-semibold border-b border-biscuit">
              <tr>
                <th scope="col" className="py-3 px-4">Timestamp</th>
                <th scope="col" className="py-3 px-4">Reference</th>
                <th scope="col" className="py-3 px-4">Product</th>
                <th scope="col" className="py-3 px-4">From Location</th>
                <th scope="col" className="py-3 px-4">To Location</th>
                <th scope="col" className="py-3 px-4 text-right">Quantity</th>
                <th scope="col" className="py-3 px-4">Logged By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-biscuit/60 font-medium">
              {kpis?.recent_activities && kpis.recent_activities.length > 0 ? (
                kpis.recent_activities.map((entry) => (
                  <tr key={entry.id} className="hover:bg-biscuit/40 transition-colors">
                    <td className="py-3 px-4 text-muted font-mono text-[11px]">
                      {new Date(entry.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-brand-700">
                      {entry.operation_reference || 'MANUAL-TX'}
                    </td>
                    <td className="py-3 px-4 text-ink">
                      <div className="font-semibold">{entry.product_name}</div>
                      <div className="text-[11px] text-muted font-mono">{entry.product_sku}</div>
                    </td>
                    <td className="py-3 px-4 text-ink">
                      <span className="px-2 py-0.5 rounded bg-biscuit border border-brand-200/60 text-[11px]">
                        {entry.from_location_name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-ink">
                      <span className="px-2 py-0.5 rounded bg-biscuit border border-brand-200/60 text-[11px]">
                        {entry.to_location_name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-ink font-mono">
                      {entry.quantity} <span className="text-[10px] font-normal text-muted">{entry.uom}</span>
                    </td>
                    <td className="py-3 px-4 text-muted">
                      {entry.user_name || 'System'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted">
                    No ledger transactions recorded yet. Run a receipt or transfer to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
