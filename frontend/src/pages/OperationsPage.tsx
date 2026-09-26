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
  RECEIPT: 'bg-sage-500/15 text-sage-700 border-sage-500/30',
  DELIVERY: 'bg-plum-500/15 text-plum-700 border-plum-500/30',
  INTERNAL: 'bg-brand-500/15 text-brand-700 border-brand-500/30',
  ADJUSTMENT: 'bg-brand-400/15 text-brand-700 border-brand-400/30',
}
const STATUS_COLORS: Record<OperationStatus, string> = {
  DRAFT: 'bg-brand-200/60 text-ink border-muted',
  WAITING: 'bg-brand-500/15 text-brand-700 border-brand-500/30',
  READY: 'bg-sage-500/15 text-sage-700 border-sage-500/30',
  DONE: 'bg-sage-500/15 text-sage-700 border-sage-500/30',
  CANCELED: 'bg-clay-500/15 text-clay-700 border-clay-500/30',
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
  <div className="glass-panel rounded-xl border border-brand-200/60 p-3.5 space-y-2.5 hover:border-muted transition-colors">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="font-semibold text-sm text-ink truncate">{op.reference}</p>
        <p className="text-xs text-muted mt-0.5 truncate">{op.contact_name ?? 'No contact'}</p>
      </div>
      <TypeBadge type={op.operation_type} />
    </div>

    <div className="text-xs text-muted space-y-1">
      <div className="flex gap-1">
        <span className="text-muted">From:</span>
        <span className="text-ink truncate">{op.source_location_name ?? '—'}</span>
      </div>
      <div className="flex gap-1">
        <span className="text-muted">To:</span>
        <span className="text-ink truncate">{op.destination_location_name ?? '—'}</span>
      </div>
      <div className="flex gap-1">
        <span className="text-muted">Lines:</span>
        <span className="text-ink">{op.lines.length} product(s)</span>
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
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold bg-sage-600/20 hover:bg-sage-600/30 text-sage-700 border border-sage-500/40 transition-colors disabled:opacity-60"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Validate
            </button>
          ) : (
            <button
              onClick={() => onAdvance(op.id)}
              disabled={advancing}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold bg-brand-600/20 hover:bg-brand-600/30 text-brand-700 border border-brand-500/40 transition-colors disabled:opacity-60"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Advance
            </button>
          )}
          {isManager && (
            <button
              onClick={() => onCancel(op.id)}
              className="p-1.5 rounded-lg bg-clay-500/10 hover:bg-clay-500/20 text-clay-700 border border-clay-500/30 transition-colors"
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

  const inputCls = 'w-full bg-surface/80 border border-brand-200/80 rounded-xl px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all'

  return (
    <>
      <div className="fixed inset-0 bg-brand-50/70 backdrop-blur-sm z-50" onClick={onClose} aria-hidden="true" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Quick Transfer" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md glass-panel rounded-2xl border border-brand-200/80 shadow-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading font-bold text-ink text-lg flex items-center gap-2">
              <Shuffle className="w-5 h-5 text-brand-700" />
              Quick Transfer
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-biscuit text-muted transition-colors" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div role="alert" className="mb-4 p-3 rounded-xl bg-clay-500/10 border border-clay-500/30 text-sm text-clay-700">{error}</div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="space-y-3.5">
            <div>
              <label htmlFor="tf-product" className="block text-xs font-semibold text-ink mb-1">Product *</label>
              <select id="tf-product" value={productId} onChange={(e) => setProductId(e.target.value)} required className={inputCls}>
                <option value="">Select product…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="tf-from" className="block text-xs font-semibold text-ink mb-1">From Location *</label>
                <select id="tf-from" value={fromLocId} onChange={(e) => setFromLocId(e.target.value)} required className={inputCls}>
                  <option value="">From…</option>
                  {allLocations.filter((l) => l.id !== toLocId).map((l) => (
                    <option key={l.id} value={l.id}>{l.name} ({l.warehouseName})</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="tf-to" className="block text-xs font-semibold text-ink mb-1">To Location *</label>
                <select id="tf-to" value={toLocId} onChange={(e) => setToLocId(e.target.value)} required className={inputCls}>
                  <option value="">To…</option>
                  {allLocations.filter((l) => l.id !== fromLocId).map((l) => (
                    <option key={l.id} value={l.id}>{l.name} ({l.warehouseName})</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="tf-qty" className="block text-xs font-semibold text-ink mb-1">Quantity *</label>
              <input id="tf-qty" type="number" min="1" step="1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 10" required className={inputCls} />
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-ink bg-biscuit hover:bg-brand-200 border border-brand-200 transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                disabled={mutation.isPending || !productId || !fromLocId || !toLocId || !qty}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-ink shadow-lg shadow-brand-500/25 transition-all disabled:opacity-60"
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

  const inputCls = 'w-full bg-surface/80 border border-brand-200/80 rounded-xl px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all'

  return (
    <>
      <div className="fixed inset-0 bg-brand-50/70 backdrop-blur-sm z-50" onClick={onClose} aria-hidden="true" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Quick Adjustment" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md glass-panel rounded-2xl border border-brand-200/80 shadow-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading font-bold text-ink text-lg flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-brand-700" />
              Stock Adjustment
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-biscuit text-muted transition-colors" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
          {error && (
            <div role="alert" className="mb-4 p-3 rounded-xl bg-clay-500/10 border border-clay-500/30 text-sm text-clay-700">{error}</div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="space-y-3.5">
            <div>
              <label htmlFor="adj-product" className="block text-xs font-semibold text-ink mb-1">Product *</label>
              <select id="adj-product" value={productId} onChange={(e) => setProductId(e.target.value)} required className={inputCls}>
                <option value="">Select product…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="adj-loc" className="block text-xs font-semibold text-ink mb-1">Location *</label>
              <select id="adj-loc" value={locationId} onChange={(e) => setLocationId(e.target.value)} required className={inputCls}>
                <option value="">Select location…</option>
                {internalLocations.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.warehouseName})</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="adj-qty" className="block text-xs font-semibold text-ink mb-1">Physical Count (Counted Qty) *</label>
              <input id="adj-qty" type="number" min="0" step="1" value={countedQty} onChange={(e) => setCountedQty(e.target.value)} placeholder="Actual units counted" required className={inputCls} />
            </div>
            <div>
              <label htmlFor="adj-reason" className="block text-xs font-semibold text-ink mb-1">Reason Code *</label>
              <select id="adj-reason" value={reasonCode} onChange={(e) => setReasonCode(e.target.value as ReasonCode)} className={inputCls}>
                <option value="MISCOUNT">Miscount</option>
                <option value="DAMAGED">Damaged</option>
                <option value="THEFT">Theft</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-ink bg-biscuit hover:bg-brand-200 border border-brand-200 transition-colors">Cancel</button>
              <button
                type="submit"
                disabled={mutation.isPending || !productId || !locationId || countedQty === ''}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-ink transition-all disabled:opacity-60"
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

  const inputCls = 'bg-surface/80 border border-brand-200/80 rounded-xl px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all'

  return (
    <>
      <div className="fixed inset-0 bg-brand-50/70 backdrop-blur-sm z-50" onClick={onClose} aria-hidden="true" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Create Receipt" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg glass-panel rounded-2xl border border-brand-200/80 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading font-bold text-ink text-lg flex items-center gap-2">
              <Truck className="w-5 h-5 text-sage-700" />
              New Receipt
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-biscuit text-muted transition-colors" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div role="alert" className="mb-4 p-3 rounded-xl bg-clay-500/10 border border-clay-500/30 text-sm text-clay-700">{error}</div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="rcpt-contact" className="block text-xs font-semibold text-ink mb-1">Supplier / Contact</label>
                <input id="rcpt-contact" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Vendor name" className={`${inputCls} w-full`} />
              </div>
              <div>
                <label htmlFor="rcpt-dest" className="block text-xs font-semibold text-ink mb-1">Destination Location</label>
                <select id="rcpt-dest" value={destLocId} onChange={(e) => setDestLocId(e.target.value)} className={`${inputCls} w-full`}>
                  <option value="">Any (auto)</option>
                  {internalLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>

            {/* Lines */}
            <div>
              <p className="text-xs font-semibold text-ink mb-2">Line Items *</p>
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
                      className="p-2 rounded-lg hover:bg-clay-500/20 text-clay-700 transition-colors"
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
                className="mt-2 flex items-center gap-1.5 text-xs text-brand-700 hover:text-brand-700 font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Line
              </button>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-ink bg-biscuit hover:bg-brand-200 border border-brand-200 transition-colors">Cancel</button>
              <button
                type="submit"
                disabled={mutation.isPending || lines.every((l) => !l.product_id || !l.quantity_demanded)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-sage-600 to-sage-500 hover:from-sage-500 hover:to-sage-400 text-ink shadow-lg shadow-sage-500/25 transition-all disabled:opacity-60"
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
                <span className="text-xs text-muted">({colOps.length})</span>
              </div>
            </div>
            {colOps.length === 0 ? (
              <div className="h-24 flex items-center justify-center rounded-xl border border-dashed border-biscuit text-muted text-xs">
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
      <div className="flex flex-col items-center justify-center py-16 text-muted">
        <ClipboardList className="w-10 h-10 mb-3 opacity-40" />
        <p className="font-medium">No {TYPE_LABELS[opType].toLowerCase()} operations</p>
        <p className="text-sm mt-1 text-muted">New operations will appear here.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-biscuit">
            <th scope="col" className="py-3 text-xs font-semibold uppercase tracking-wider text-muted">Reference</th>
            <th scope="col" className="py-3 text-xs font-semibold uppercase tracking-wider text-muted">Contact</th>
            <th scope="col" className="py-3 text-xs font-semibold uppercase tracking-wider text-muted">Locations</th>
            <th scope="col" className="py-3 text-xs font-semibold uppercase tracking-wider text-muted text-center">Lines</th>
            <th scope="col" className="py-3 text-xs font-semibold uppercase tracking-wider text-muted text-center">Status</th>
            <th scope="col" className="py-3 text-xs font-semibold uppercase tracking-wider text-muted text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {ops.map((op) => (
            <tr key={op.id} className="border-b border-biscuit/60 hover:bg-biscuit/20 transition-colors group">
              <td className="py-3">
                <p className="font-mono text-sm text-ink">{op.reference}</p>
                <p className="text-xs text-muted">{new Date(op.created_at).toLocaleDateString()}</p>
              </td>
              <td className="py-3 text-sm text-muted">{op.contact_name ?? '—'}</td>
              <td className="py-3">
                <div className="text-xs text-muted space-y-0.5">
                  {op.source_location_name && <p>From: {op.source_location_name}</p>}
                  {op.destination_location_name && <p>To: {op.destination_location_name}</p>}
                </div>
              </td>
              <td className="py-3 text-center text-sm text-muted">{op.lines.length}</td>
              <td className="py-3 text-center"><StatusBadge status={op.status} /></td>
              <td className="py-3 text-right">
                {op.status !== 'DONE' && op.status !== 'CANCELED' && (
                  <div className="flex items-center justify-end gap-1.5">
                    {op.status === 'READY' ? (
                      <button
                        onClick={() => validate(op.id)}
                        disabled={busy === op.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-sage-600/20 hover:bg-sage-600/30 text-sage-700 border border-sage-500/30 transition-colors disabled:opacity-60"
                      >
                        {busy === op.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        Validate
                      </button>
                    ) : (
                      <button
                        onClick={() => advance(op.id)}
                        disabled={busy === op.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-brand-600/20 hover:bg-brand-600/30 text-brand-700 border border-brand-500/30 transition-colors disabled:opacity-60"
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
          <h1 className="font-heading text-2xl font-extrabold text-ink flex items-center gap-2.5">
            <ArrowLeftRight className="w-6 h-6 text-brand-700" />
            Operations
          </h1>
          <p className="text-sm text-muted mt-0.5">All stock movements — receipts, deliveries, transfers and adjustments</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isManager && (
            <button
              onClick={() => setReceiptModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-sage-600/20 hover:bg-sage-600/30 text-sage-700 border border-sage-500/30 transition-all"
            >
              <Truck className="w-4 h-4" /> New Receipt
            </button>
          )}
          <button
            onClick={() => setTransferModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-brand-600/20 hover:bg-brand-600/30 text-brand-700 border border-brand-500/30 transition-all"
          >
            <Shuffle className="w-4 h-4" /> Transfer
          </button>
          {isManager && (
            <button
              onClick={() => setAdjustModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-brand-600/20 hover:bg-brand-600/30 text-brand-700 border border-brand-500/30 transition-all"
            >
              <SlidersHorizontal className="w-4 h-4" /> Adjust
            </button>
          )}
          <button
            onClick={() => refetch()}
            className="p-2 rounded-xl bg-surface/80 border border-brand-200/80 text-muted hover:text-ink hover:bg-biscuit transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface/60 rounded-xl border border-biscuit w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-brand-600/30 text-brand-700 border border-brand-500/40 shadow-sm'
                : 'text-muted hover:text-ink hover:bg-biscuit/50'
            }`}
            aria-pressed={activeTab === tab.id}
          >
            {tab.icon}
            {tab.label}
            <span className="text-xs text-muted">
              ({activeTab === tab.id ? ops.length : '…'})
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="glass-panel rounded-2xl border border-brand-200/60 overflow-hidden">
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-muted">
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
