import React, { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeftRight, Plus, RefreshCw, X, CheckCircle2, XCircle,
  Truck, PackageCheck, ArrowRight,
  ClipboardList, Shuffle, SlidersHorizontal
} from 'lucide-react'
import { api } from '../lib/api'
import { useOperations, useProducts, useWarehouses } from '../lib/queries'
import { useDialogFocus } from '../lib/useDialogFocus'
import { useAuth } from '../context/AuthContext'
import type {
  StockOperation, OperationType, OperationStatus, Product,
  Warehouse, ReasonCode
} from '../types'

/* ─── Types ─── */
/* ─── Helpers ─── */
const TYPE_LABELS: Record<OperationType, string> = {
  RECEIPT: 'Receipt', DELIVERY: 'Delivery', INTERNAL: 'Transfer', ADJUSTMENT: 'Adjustment',
}
const TYPE_COLORS: Record<OperationType, string> = {
  RECEIPT: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  DELIVERY: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  INTERNAL: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  ADJUSTMENT: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
}
const STATUS_COLORS: Record<OperationStatus, string> = {
  DRAFT: 'bg-slate-700/60 text-slate-300 border-slate-600',
  WAITING: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  READY: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  DONE: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  CANCELED: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
}

const StatusBadge: React.FC<{ status: OperationStatus }> = ({ status }) => (
  <span className={`status-badge border ${STATUS_COLORS[status]}`}>{status}</span>
)

const TypeBadge: React.FC<{ type: OperationType }> = ({ type }) => (
  <span className={`status-badge border ${TYPE_COLORS[type]}`}>{TYPE_LABELS[type]}</span>
)

/* ─── Kanban Card ─── */
const KanbanCard: React.FC<{
  op: StockOperation
  onAdvance: (id: string) => void
  onValidate: (id: string) => void
  onCancel: (id: string) => void
  isManager: boolean
  advancing: boolean
}> = ({ op, onAdvance, onValidate, onCancel, isManager, advancing }) => (
  <div className="glass-panel rounded-xl border border-slate-700/60 p-3.5 space-y-2.5 hover:border-slate-600 transition-colors">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="font-semibold text-sm text-white truncate">{op.reference}</p>
        <p className="text-xs text-slate-500 mt-0.5 truncate">{op.contact_name ?? 'No contact'}</p>
      </div>
      <TypeBadge type={op.operation_type} />
    </div>

    <div className="text-xs text-slate-400 space-y-1">
      <div className="flex gap-1">
        <span className="text-slate-600">From:</span>
        <span className="text-slate-300 truncate">{op.source_location_name ?? '—'}</span>
      </div>
      <div className="flex gap-1">
        <span className="text-slate-600">To:</span>
        <span className="text-slate-300 truncate">{op.destination_location_name ?? '—'}</span>
      </div>
      <div className="flex gap-1">
        <span className="text-slate-600">Lines:</span>
        <span className="text-slate-300">{op.lines.length} product(s)</span>
      </div>
    </div>

    {/* Actions */}
    <div className="flex gap-1.5 pt-1">
      {op.status !== 'DONE' && op.status !== 'CANCELED' && (
        <>
          {op.status === 'READY' ? (
            <button
              onClick={() => onValidate(op.id)}
              disabled={advancing}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 transition-colors disabled:opacity-60"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Validate
            </button>
          ) : (
            <button
              onClick={() => onAdvance(op.id)}
              disabled={advancing}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/40 transition-colors disabled:opacity-60"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Advance
            </button>
          )}
          {isManager && (
            <button
              onClick={() => onCancel(op.id)}
              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors"
              aria-label="Cancel operation"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </>
      )}
    </div>
  </div>
)

/* ─── Quick Transfer Modal ─── */
const TransferModal: React.FC<{ warehouses: Warehouse[]; products: Product[]; onClose: () => void }> = ({ warehouses, products, onClose }) => {
  const qc = useQueryClient()
  const dialogRef = useDialogFocus<HTMLDivElement>()
  const [productId, setProductId] = useState('')
  const [fromLocId, setFromLocId] = useState('')
  const [toLocId, setToLocId] = useState('')
  const [qty, setQty] = useState('')
  const [error, setError] = useState<string | null>(null)

  const allLocations = warehouses.flatMap((w) =>
    w.locations.filter((l) => l.type === 'INTERNAL').map((l) => ({ ...l, warehouseName: w.name }))
  )

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/operations/transfers/quick', {
        product_id: productId,
        source_location_id: fromLocId,
        destination_location_id: toLocId,
        quantity: Number(qty),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['operations'] }); onClose() },
    onError: (e: any) => setError(e.message),
  })

  const inputCls = 'w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all'

  return (
    <>
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50" onClick={onClose} aria-hidden="true" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Quick Transfer" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md glass-panel rounded-2xl border border-slate-700/80 shadow-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading font-bold text-white text-lg flex items-center gap-2">
              <Shuffle className="w-5 h-5 text-indigo-400" />
              Quick Transfer
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300">{error}</div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="space-y-3.5">
            <div>
              <label htmlFor="tf-product" className="block text-xs font-semibold text-slate-300 mb-1">Product *</label>
              <select id="tf-product" value={productId} onChange={(e) => setProductId(e.target.value)} required className={inputCls}>
                <option value="">Select product…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="tf-from" className="block text-xs font-semibold text-slate-300 mb-1">From Location *</label>
                <select id="tf-from" value={fromLocId} onChange={(e) => setFromLocId(e.target.value)} required className={inputCls}>
                  <option value="">From…</option>
                  {allLocations.filter((l) => l.id !== toLocId).map((l) => (
                    <option key={l.id} value={l.id}>{l.name} ({l.warehouseName})</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="tf-to" className="block text-xs font-semibold text-slate-300 mb-1">To Location *</label>
                <select id="tf-to" value={toLocId} onChange={(e) => setToLocId(e.target.value)} required className={inputCls}>
                  <option value="">To…</option>
                  {allLocations.filter((l) => l.id !== fromLocId).map((l) => (
                    <option key={l.id} value={l.id}>{l.name} ({l.warehouseName})</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="tf-qty" className="block text-xs font-semibold text-slate-300 mb-1">Quantity *</label>
              <input id="tf-qty" type="number" min="1" step="1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 10" required className={inputCls} />
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                disabled={mutation.isPending || !productId || !fromLocId || !toLocId || !qty}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-60"
              >
                {mutation.isPending ? <><RefreshCw className="w-4 h-4 animate-spin" /> Moving…</> : 'Execute Transfer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

/* ─── Quick Adjustment Modal ─── */
const AdjustmentModal: React.FC<{ warehouses: Warehouse[]; products: Product[]; onClose: () => void }> = ({ warehouses, products, onClose }) => {
  const qc = useQueryClient()
  const dialogRef = useDialogFocus<HTMLDivElement>()
  const [productId, setProductId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [countedQty, setCountedQty] = useState('')
  const [reasonCode, setReasonCode] = useState<ReasonCode>('MISCOUNT')
  const [error, setError] = useState<string | null>(null)

  const internalLocations = warehouses.flatMap((w) =>
    w.locations.filter((l) => l.type === 'INTERNAL').map((l) => ({ ...l, warehouseName: w.name }))
  )

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/operations/adjustments/quick', {
        product_id: productId,
        location_id: locationId,
        counted_quantity: Number(countedQty),
        reason_code: reasonCode,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['operations'] }); onClose() },
    onError: (e: any) => setError(e.message),
  })

  const inputCls = 'w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all'

  return (
    <>
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50" onClick={onClose} aria-hidden="true" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Quick Adjustment" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md glass-panel rounded-2xl border border-slate-700/80 shadow-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading font-bold text-white text-lg flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-amber-400" />
              Stock Adjustment
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
          {error && (
            <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300">{error}</div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="space-y-3.5">
            <div>
              <label htmlFor="adj-product" className="block text-xs font-semibold text-slate-300 mb-1">Product *</label>
              <select id="adj-product" value={productId} onChange={(e) => setProductId(e.target.value)} required className={inputCls}>
                <option value="">Select product…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="adj-loc" className="block text-xs font-semibold text-slate-300 mb-1">Location *</label>
              <select id="adj-loc" value={locationId} onChange={(e) => setLocationId(e.target.value)} required className={inputCls}>
                <option value="">Select location…</option>
                {internalLocations.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.warehouseName})</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="adj-qty" className="block text-xs font-semibold text-slate-300 mb-1">Physical Count (Counted Qty) *</label>
              <input id="adj-qty" type="number" min="0" step="1" value={countedQty} onChange={(e) => setCountedQty(e.target.value)} placeholder="Actual units counted" required className={inputCls} />
            </div>
            <div>
              <label htmlFor="adj-reason" className="block text-xs font-semibold text-slate-300 mb-1">Reason Code *</label>
              <select id="adj-reason" value={reasonCode} onChange={(e) => setReasonCode(e.target.value as ReasonCode)} className={inputCls}>
                <option value="MISCOUNT">Miscount</option>
                <option value="DAMAGED">Damaged</option>
                <option value="THEFT">Theft</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors">Cancel</button>
              <button
                type="submit"
                disabled={mutation.isPending || !productId || !locationId || countedQty === ''}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 transition-all disabled:opacity-60"
              >
                {mutation.isPending ? <><RefreshCw className="w-4 h-4 animate-spin" /> Posting…</> : 'Post Adjustment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

/* ─── Create Receipt Modal ─── */
const ReceiptModal: React.FC<{ warehouses: Warehouse[]; products: Product[]; onClose: () => void }> = ({ warehouses, products, onClose }) => {
  const qc = useQueryClient()
  const dialogRef = useDialogFocus<HTMLDivElement>()
  const [contactName, setContactName] = useState('')
  const [destLocId, setDestLocId] = useState('')
  const [lines, setLines] = useState([{ product_id: '', quantity_demanded: '' }])
  const [error, setError] = useState<string | null>(null)

  const internalLocations = warehouses.flatMap((w) =>
    w.locations.filter((l) => l.type === 'INTERNAL').map((l) => ({ ...l, warehouseName: w.name }))
  )

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/operations', {
        operation_type: 'RECEIPT',
        contact_name: contactName,
        destination_location_id: destLocId || null,
        lines: lines
          .filter((l) => l.product_id && l.quantity_demanded)
          .map((l) => ({ product_id: l.product_id, quantity_demanded: Number(l.quantity_demanded) })),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['operations'] }); onClose() },
    onError: (e: any) => setError(e.message),
  })

  const inputCls = 'bg-slate-900/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all'

  return (
    <>
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50" onClick={onClose} aria-hidden="true" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Create Receipt" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg glass-panel rounded-2xl border border-slate-700/80 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading font-bold text-white text-lg flex items-center gap-2">
              <Truck className="w-5 h-5 text-emerald-400" />
              New Receipt
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300">{error}</div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="rcpt-contact" className="block text-xs font-semibold text-slate-300 mb-1">Supplier / Contact</label>
                <input id="rcpt-contact" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Vendor name" className={`${inputCls} w-full`} />
              </div>
              <div>
                <label htmlFor="rcpt-dest" className="block text-xs font-semibold text-slate-300 mb-1">Destination Location</label>
                <select id="rcpt-dest" value={destLocId} onChange={(e) => setDestLocId(e.target.value)} className={`${inputCls} w-full`}>
                  <option value="">Any (auto)</option>
                  {internalLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>

            {/* Lines */}
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-2">Line Items *</p>
              <div className="space-y-2">
                {lines.map((line, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      value={line.product_id}
                      onChange={(e) => {
                        const updated = [...lines]; updated[idx].product_id = e.target.value; setLines(updated)
                      }}
                      className={`${inputCls} flex-1`}
                      aria-label={`Line ${idx + 1} product`}
                    >
                      <option value="">Select product…</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={line.quantity_demanded}
                      onChange={(e) => {
                        const updated = [...lines]; updated[idx].quantity_demanded = e.target.value; setLines(updated)
                      }}
                      placeholder="Qty"
                      aria-label={`Line ${idx + 1} quantity`}
                      className={`${inputCls} w-24 text-center`}
                    />
                    <button
                      type="button"
                      onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                      className="p-2 rounded-lg hover:bg-rose-500/20 text-rose-400 transition-colors"
                      aria-label="Remove line"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setLines([...lines, { product_id: '', quantity_demanded: '' }])}
                className="mt-2 flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Line
              </button>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors">Cancel</button>
              <button
                type="submit"
                disabled={mutation.isPending || lines.every((l) => !l.product_id || !l.quantity_demanded)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-60"
              >
                {mutation.isPending ? <><RefreshCw className="w-4 h-4 animate-spin" /> Creating…</> : <>Create Receipt</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

/* ─── Kanban Board ─── */
const KANBAN_COLUMNS: OperationStatus[] = ['DRAFT', 'WAITING', 'READY', 'DONE', 'CANCELED']

const KanbanBoard: React.FC<{ ops: StockOperation[]; isManager: boolean }> = ({ ops, isManager }) => {
  const qc = useQueryClient()
  const [advancing, setAdvancing] = useState<string | null>(null)

  const advance = async (id: string) => {
    setAdvancing(id)
    try {
      await api.put(`/operations/${id}/advance-status`)
      qc.invalidateQueries({ queryKey: ['operations'] })
    } catch (e: any) {
      alert(`Could not advance: ${e.message}`)
    } finally {
      setAdvancing(null)
    }
  }

  const validate = async (id: string) => {
    setAdvancing(id)
    try {
      await api.post(`/operations/${id}/validate`)
      qc.invalidateQueries({ queryKey: ['operations'] })
    } catch (e: any) {
      alert(`Validation failed: ${e.message}`)
    } finally {
      setAdvancing(null)
    }
  }

  const cancel = async (id: string) => {
    if (!confirm('Cancel this operation? This cannot be undone.')) return
    setAdvancing(id)
    try {
      await api.put(`/operations/${id}/advance-status?target_status=CANCELED`)
      qc.invalidateQueries({ queryKey: ['operations'] })
    } catch (e: any) {
      alert(`Cancel failed: ${e.message}`)
    } finally {
      setAdvancing(null)
    }
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[400px]">
      {KANBAN_COLUMNS.map((col) => {
        const colOps = ops.filter((o) => o.status === col)
        return (
          <div key={col} className="flex-shrink-0 w-[260px] space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <StatusBadge status={col} />
                <span className="text-xs text-slate-500">({colOps.length})</span>
              </div>
            </div>
            {colOps.length === 0 ? (
              <div className="h-24 flex items-center justify-center rounded-xl border border-dashed border-slate-800 text-slate-600 text-xs">
                No operations
              </div>
            ) : (
              colOps.map((op) => (
                <KanbanCard
                  key={op.id}
                  op={op}
                  isManager={isManager}
                  advancing={advancing === op.id}
                  onAdvance={advance}
                  onValidate={validate}
                  onCancel={cancel}
                />
              ))
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── Operations Table (Receipts, Adjustments) ─── */
const OpsTable: React.FC<{
  ops: StockOperation[]
  opType: OperationType
}> = ({ ops, opType }) => {
  const qc = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)

  const validate = async (id: string) => {
    setBusy(id)
    try {
      await api.post(`/operations/${id}/validate`)
      qc.invalidateQueries({ queryKey: ['operations'] })
    } catch (e: any) {
      alert(`Validation failed: ${e.message}`)
    } finally {
      setBusy(null)
    }
  }

  const advance = async (id: string) => {
    setBusy(id)
    try {
      await api.put(`/operations/${id}/advance-status`)
      qc.invalidateQueries({ queryKey: ['operations'] })
    } catch (e: any) {
      alert(e.message)
    } finally {
      setBusy(null)
    }
  }

  if (ops.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <ClipboardList className="w-10 h-10 mb-3 opacity-40" />
        <p className="font-medium">No {TYPE_LABELS[opType].toLowerCase()} operations</p>
        <p className="text-sm mt-1 text-slate-600">New operations will appear here.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-slate-800">
            <th scope="col" className="py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Reference</th>
            <th scope="col" className="py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Contact</th>
            <th scope="col" className="py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Locations</th>
            <th scope="col" className="py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 text-center">Lines</th>
            <th scope="col" className="py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 text-center">Status</th>
            <th scope="col" className="py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {ops.map((op) => (
            <tr key={op.id} className="border-b border-slate-800/60 hover:bg-slate-800/20 transition-colors group">
              <td className="py-3">
                <p className="font-mono text-sm text-slate-200">{op.reference}</p>
                <p className="text-xs text-slate-600">{new Date(op.created_at).toLocaleDateString()}</p>
              </td>
              <td className="py-3 text-sm text-slate-400">{op.contact_name ?? '—'}</td>
              <td className="py-3">
                <div className="text-xs text-slate-400 space-y-0.5">
                  {op.source_location_name && <p>From: {op.source_location_name}</p>}
                  {op.destination_location_name && <p>To: {op.destination_location_name}</p>}
                </div>
              </td>
              <td className="py-3 text-center text-sm text-slate-400">{op.lines.length}</td>
              <td className="py-3 text-center"><StatusBadge status={op.status} /></td>
              <td className="py-3 text-right">
                {op.status !== 'DONE' && op.status !== 'CANCELED' && (
                  <div className="flex items-center justify-end gap-1.5">
                    {op.status === 'READY' ? (
                      <button
                        onClick={() => validate(op.id)}
                        disabled={busy === op.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition-colors disabled:opacity-60"
                      >
                        {busy === op.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        Validate
                      </button>
                    ) : (
                      <button
                        onClick={() => advance(op.id)}
                        disabled={busy === op.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 transition-colors disabled:opacity-60"
                      >
                        {busy === op.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                        Advance
                      </button>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ─── Operations Page ─── */
type OpsTab = 'RECEIPT' | 'DELIVERY' | 'INTERNAL' | 'ADJUSTMENT'

interface OperationsPageProps {
  initialExtra?: { tab?: string } | null
  onExtraConsumed?: () => void
}

export const OperationsPage: React.FC<OperationsPageProps> = ({ initialExtra, onExtraConsumed }) => {
  const { isManager } = useAuth()
  const [activeTab, setActiveTab] = useState<OpsTab>(
    (initialExtra?.tab as OpsTab) ?? 'RECEIPT'
  )
  const [receiptModalOpen, setReceiptModalOpen] = useState(false)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)

  useEffect(() => {
    if (initialExtra?.tab) {
      setActiveTab(initialExtra.tab as OpsTab)
      onExtraConsumed?.()
    }
  }, [initialExtra])

  const { data: ops = [], isLoading, refetch } = useOperations(activeTab)
  const { data: products = [] } = useProducts()
  const { data: warehouses = [] } = useWarehouses()

  const TABS: { id: OpsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'RECEIPT', label: 'Receipts', icon: <Truck className="w-4 h-4" /> },
    { id: 'DELIVERY', label: 'Deliveries', icon: <PackageCheck className="w-4 h-4" /> },
    { id: 'INTERNAL', label: 'Transfers', icon: <Shuffle className="w-4 h-4" /> },
    { id: 'ADJUSTMENT', label: 'Adjustments', icon: <SlidersHorizontal className="w-4 h-4" /> },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold text-white flex items-center gap-2.5">
            <ArrowLeftRight className="w-6 h-6 text-indigo-400" />
            Operations
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">All stock movements — receipts, deliveries, transfers and adjustments</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isManager && (
            <button
              onClick={() => setReceiptModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-all"
            >
              <Truck className="w-4 h-4" /> New Receipt
            </button>
          )}
          <button
            onClick={() => setTransferModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all"
          >
            <Shuffle className="w-4 h-4" /> Transfer
          </button>
          {isManager && (
            <button
              onClick={() => setAdjustModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 transition-all"
            >
              <SlidersHorizontal className="w-4 h-4" /> Adjust
            </button>
          )}
          <button
            onClick={() => refetch()}
            className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-900/60 rounded-xl border border-slate-800 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
            aria-pressed={activeTab === tab.id}
          >
            {tab.icon}
            {tab.label}
            <span className="text-xs text-slate-500">
              ({activeTab === tab.id ? ops.length : '…'})
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="glass-panel rounded-2xl border border-slate-700/60 overflow-hidden">
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
            </div>
          ) : activeTab === 'DELIVERY' ? (
            <KanbanBoard ops={ops} isManager={isManager} />
          ) : (
            <OpsTable ops={ops} opType={activeTab} />
          )}
        </div>
      </div>

      {/* Modals */}
      {receiptModalOpen && (
        <ReceiptModal warehouses={warehouses} products={products} onClose={() => setReceiptModalOpen(false)} />
      )}
      {transferModalOpen && (
        <TransferModal warehouses={warehouses} products={products} onClose={() => setTransferModalOpen(false)} />
      )}
      {adjustModalOpen && (
        <AdjustmentModal warehouses={warehouses} products={products} onClose={() => setAdjustModalOpen(false)} />
      )}
    </div>
  )
}
