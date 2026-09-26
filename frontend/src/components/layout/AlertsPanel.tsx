import React, { useEffect } from 'react'
import { X, AlertTriangle, PackageSearch, ArrowRight, RefreshCw } from 'lucide-react'
import { api } from '../../lib/api'
import type { DashboardKPIs } from '../../types'
import { useAuth } from '../../context/AuthContext'
import { useDialogFocus } from '../../lib/useDialogFocus'

interface AlertsPanelProps {
  onClose: () => void
  onNavigate: (tab: string, extra?: any) => void
  onCountUpdate: (count: number) => void
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({
  onClose,
  onNavigate,
  onCountUpdate,
}) => {
  const { isManager } = useAuth()
  const dialogRef = useDialogFocus<HTMLElement>()
  const [kpis, setKpis] = React.useState<DashboardKPIs | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [generating, setGenerating] = React.useState(false)
  const [genMsg, setGenMsg] = React.useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.get<DashboardKPIs>('/dashboard/kpis')
        setKpis(data)
        onCountUpdate(data.reorder_alerts.length)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleAutoGenerate = async () => {
    setGenerating(true)
    try {
      const res = await api.get('/products/rules/reorder-check?auto_create_drafts=true')
      const count = res.auto_created_draft_receipts?.length || 0
      setGenMsg(
        count > 0
          ? `✅ Generated ${count} draft receipt(s). Check Operations → Receipts.`
          : '✅ All levels are within threshold. No action needed.'
      )
    } catch (err: any) {
      setGenMsg(`❌ ${err.message}`)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in Panel */}
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Stock Alerts Panel"
        tabIndex={-1}
        className="fixed right-0 top-0 h-full w-full sm:w-[420px] z-50 glass-panel border-l border-slate-700/80 shadow-2xl overflow-y-auto"
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-950/90 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h2 className="font-heading font-bold text-white text-base">Stock Alerts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Close alerts panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading alerts…
            </div>
          ) : (
            <>
              {/* Summary Banner */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-sm grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xl font-extrabold text-amber-400">{kpis?.low_stock_items ?? 0}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Low Stock</p>
                </div>
                <div>
                  <p className="text-xl font-extrabold text-rose-400">{kpis?.out_of_stock_items ?? 0}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Out of Stock</p>
                </div>
                <div>
                  <p className="text-xl font-extrabold text-indigo-400">{kpis?.reorder_alerts.length ?? 0}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Need Reorder</p>
                </div>
              </div>

              {/* Auto-Generate Button (Manager only) */}
              {isManager && (
                <button
                  onClick={handleAutoGenerate}
                  disabled={generating}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 transition-all disabled:opacity-60"
                >
                  {generating
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating…</>
                    : <><PackageSearch className="w-4 h-4" /> Auto-Generate Draft Receipts</>
                  }
                </button>
              )}
              {genMsg && (
                <p className="text-xs text-center text-slate-300 bg-slate-900 rounded-lg p-2.5 border border-slate-800">
                  {genMsg}
                </p>
              )}

              {/* Alert Items */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Items Requiring Attention ({kpis?.reorder_alerts.length ?? 0})
                </h3>
                {kpis?.reorder_alerts.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    <PackageSearch className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    All stock levels are healthy.
                  </div>
                ) : (
                  kpis?.reorder_alerts.map((alert) => (
                    <div
                      key={alert.product_id}
                      className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-white truncate">{alert.name}</p>
                          <p className="text-xs text-slate-500 font-mono">{alert.sku}</p>
                        </div>
                        <span
                          className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            alert.current_stock === 0
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {alert.current_stock === 0 ? 'OUT OF STOCK' : 'LOW STOCK'}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                        <span>
                          On-hand: <strong className="text-white">{alert.current_stock}</strong> {alert.uom}
                        </span>
                        <span>
                          Min: <strong className="text-amber-400">{alert.min_stock_level}</strong>
                        </span>
                        <span>
                          Restock: <strong className="text-indigo-400">+{alert.suggested_order_qty}</strong>
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Navigation Links */}
              <div className="border-t border-slate-800 pt-4 space-y-2">
                <button
                  onClick={() => { onNavigate('operations', { tab: 'RECEIPT' }); onClose() }}
                  className="w-full flex items-center justify-between p-3 rounded-xl text-sm bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
                >
                  <span>View Pending Receipts ({kpis?.pending_receipts ?? 0})</span>
                  <ArrowRight className="w-4 h-4 text-indigo-400" />
                </button>
                <button
                  onClick={() => { onNavigate('products'); onClose() }}
                  className="w-full flex items-center justify-between p-3 rounded-xl text-sm bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
                >
                  <span>View All Products</span>
                  <ArrowRight className="w-4 h-4 text-indigo-400" />
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  )
}
