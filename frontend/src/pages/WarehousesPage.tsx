import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Warehouse as WarehouseIcon, Plus, MapPin, Building2,
  RefreshCw, X, CheckCircle2, XCircle, ChevronDown, ChevronRight, Box
} from 'lucide-react'
import { api } from '../lib/api'
import { useWarehouses } from '../lib/queries'
import { useDialogFocus } from '../lib/useDialogFocus'
import type { LocationType, Warehouse } from '../types'

/* ─── Create Warehouse Modal ─── */
const CreateWarehouseModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const qc = useQueryClient()
  const dialogRef = useDialogFocus<HTMLDivElement>()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/warehouses', { code: code.trim(), name: name.trim(), address: address.trim() || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['warehouses'] }); onClose() },
    onError: (e: any) => setError(e.message),
  })

  const inputCls = 'w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all'

  return (
    <>
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50" onClick={onClose} aria-hidden="true" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Create Warehouse" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md glass-panel rounded-2xl border border-slate-700/80 shadow-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading font-bold text-white text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-400" />
              New Warehouse
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300 flex items-start gap-2">
              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
            </div>
          )}

          <div className="mb-4 p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
            <p className="font-semibold mb-1">Auto-provisioned locations:</p>
            <p className="text-slate-400">Creating a warehouse automatically generates <strong className="text-indigo-300">Stock</strong>, <strong className="text-indigo-300">Vendors</strong>, <strong className="text-indigo-300">Customers</strong>, and <strong className="text-indigo-300">Loss</strong> virtual locations.</p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="wh-code" className="block text-xs font-semibold text-slate-300 mb-1">Warehouse Code *</label>
                <input id="wh-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="WH-001" required className={inputCls} />
              </div>
              <div>
                <label htmlFor="wh-name" className="block text-xs font-semibold text-slate-300 mb-1">Warehouse Name *</label>
                <input id="wh-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Main Warehouse" required className={inputCls} />
              </div>
            </div>
            <div>
              <label htmlFor="wh-address" className="block text-xs font-semibold text-slate-300 mb-1">Address (optional)</label>
              <input id="wh-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Industrial Avenue, City" className={inputCls} />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors">Cancel</button>
              <button
                type="submit"
                disabled={mutation.isPending || !code || !name}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-60"
              >
                {mutation.isPending
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Creating…</>
                  : <><CheckCircle2 className="w-4 h-4" /> Create Warehouse</>
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

/* ─── Add Location Modal ─── */
const AddLocationModal: React.FC<{ warehouseId: string; warehouseName: string; onClose: () => void }> = ({ warehouseId, warehouseName, onClose }) => {
  const qc = useQueryClient()
  const dialogRef = useDialogFocus<HTMLDivElement>()
  const [name, setName] = useState('')
  const [locType, setLocType] = useState<LocationType>('INTERNAL')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/warehouses/locations', { warehouse_id: warehouseId, name: name.trim(), type: locType }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['warehouses'] }); onClose() },
    onError: (e: any) => setError(e.message),
  })

  const inputCls = 'w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all'

  return (
    <>
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50" onClick={onClose} aria-hidden="true" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Add Location" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm glass-panel rounded-2xl border border-slate-700/80 shadow-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading font-bold text-white text-lg">Add Location</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-slate-500 mb-4">Adding to: <strong className="text-slate-300">{warehouseName}</strong></p>

          {error && (
            <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300">{error}</div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="space-y-3.5">
            <div>
              <label htmlFor="loc-name" className="block text-xs font-semibold text-slate-300 mb-1">Location Name *</label>
              <input id="loc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Shelf A-01" required className={inputCls} />
            </div>
            <div>
              <label htmlFor="loc-type" className="block text-xs font-semibold text-slate-300 mb-1">Location Type *</label>
              <select id="loc-type" value={locType} onChange={(e) => setLocType(e.target.value as LocationType)} className={inputCls}>
                <option value="INTERNAL">Internal (Physical stock location)</option>
                <option value="VENDOR_VIRTUAL">Vendor (Virtual — incoming)</option>
                <option value="CUSTOMER_VIRTUAL">Customer (Virtual — outgoing)</option>
                <option value="LOSS_VIRTUAL">Loss (Virtual — damaged/shrinkage)</option>
              </select>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors">Cancel</button>
              <button
                type="submit"
                disabled={mutation.isPending || !name}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-60"
              >
                {mutation.isPending ? <><RefreshCw className="w-4 h-4 animate-spin" /> Adding…</> : 'Add Location'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

/* ─── Location Type Pill ─── */
const LOC_TYPE_STYLES: Record<LocationType, string> = {
  INTERNAL: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  VENDOR_VIRTUAL: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  CUSTOMER_VIRTUAL: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  LOSS_VIRTUAL: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
}

const LOC_TYPE_LABELS: Record<LocationType, string> = {
  INTERNAL: 'Internal',
  VENDOR_VIRTUAL: 'Vendor',
  CUSTOMER_VIRTUAL: 'Customer',
  LOSS_VIRTUAL: 'Loss',
}

/* ─── Warehouse Card ─── */
const WarehouseCard: React.FC<{ warehouse: Warehouse }> = ({ warehouse }) => {
  const [expanded, setExpanded] = useState(true)
  const [addLocOpen, setAddLocOpen] = useState(false)

  const internalCount = warehouse.locations.filter((l) => l.type === 'INTERNAL').length

  return (
    <div className="glass-panel rounded-2xl border border-slate-700/60 overflow-hidden">
      {/* Warehouse Header */}
      <div className="flex items-center justify-between p-5 border-b border-slate-800/80">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600/30 to-purple-600/30 border border-indigo-500/30 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-bold text-white text-base">{warehouse.name}</h3>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">
                {warehouse.code}
              </span>
            </div>
            {warehouse.address && (
              <p className="text-sm text-slate-400 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {warehouse.address}
              </p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              {internalCount} internal location{internalCount !== 1 ? 's' : ''} · {warehouse.locations.length} total
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAddLocOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-indigo-300 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Location
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            aria-label={expanded ? 'Collapse locations' : 'Expand locations'}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Locations Grid */}
      {expanded && (
        <div className="p-5">
          {warehouse.locations.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No locations yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
              {warehouse.locations.map((loc) => (
                <div
                  key={loc.id}
                  className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <Box className="w-4 h-4 text-slate-500 flex-shrink-0" aria-hidden="true" />
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${LOC_TYPE_STYLES[loc.type]}`}>
                      {LOC_TYPE_LABELS[loc.type]}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-200 leading-tight truncate" title={loc.name}>
                    {loc.name}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {addLocOpen && (
        <AddLocationModal
          warehouseId={warehouse.id}
          warehouseName={warehouse.name}
          onClose={() => setAddLocOpen(false)}
        />
      )}
    </div>
  )
}

/* ─── Warehouses Page ─── */
export const WarehousesPage: React.FC = () => {
  const [createOpen, setCreateOpen] = useState(false)

  const { data: warehouses = [], isLoading, refetch } = useWarehouses()

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold text-white flex items-center gap-2.5">
            <WarehouseIcon className="w-6 h-6 text-indigo-400" />
            Warehouses
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {warehouses.length} warehouse{warehouses.length !== 1 ? 's' : ''} configured · Manager access only
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label="Refresh warehouses"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-500/25 transition-all"
          >
            <Plus className="w-4 h-4" /> New Warehouse
          </button>
        </div>
      </div>

      {/* Warehouse Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading warehouses…
        </div>
      ) : warehouses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <WarehouseIcon className="w-12 h-12 mb-4 opacity-30" />
          <p className="font-semibold text-lg">No warehouses configured</p>
          <p className="text-sm mt-1 text-slate-600">Create your first warehouse to start managing stock locations.</p>
          <button
            onClick={() => setCreateOpen(true)}
            className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            <Plus className="w-4 h-4" /> Create Warehouse
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {warehouses.map((wh) => (
            <WarehouseCard key={wh.id} warehouse={wh} />
          ))}
        </div>
      )}

      {createOpen && <CreateWarehouseModal onClose={() => setCreateOpen(false)} />}
    </div>
  )
}
