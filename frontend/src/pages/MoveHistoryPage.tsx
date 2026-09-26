import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  History, Search, Filter, RefreshCw, ChevronLeft, ChevronRight,
  ArrowRightCircle, Package
} from 'lucide-react'
import { api } from '../lib/api'
import type { StockLedgerEntry } from '../types'
import { useWarehouses } from '../lib/queries'

interface LedgerResponse {
  entries: StockLedgerEntry[]
  total: number
  page: number
  page_size: number
}

const TYPE_COLORS: Record<string, string> = {
  RECEIPT: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  DELIVERY: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  INTERNAL: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  ADJUSTMENT: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
}

export const MoveHistoryPage: React.FC = () => {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [locationFilter, setLocationFilter] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 30

  const { data: warehouses = [] } = useWarehouses()

  const { data, isLoading, refetch } = useQuery<LedgerResponse>({
    queryKey: ['ledger', search, typeFilter, locationFilter, page],
    queryFn: () =>
      api.get(
        `/ledger?page=${page}&page_size=${pageSize}` +
        (search ? `&search=${encodeURIComponent(search)}` : '') +
        (typeFilter ? `&operation_type=${typeFilter}` : '') +
        (locationFilter ? `&location_id=${locationFilter}` : '')
      ),
    placeholderData: (prev) => prev,
  })

  const entries = data?.entries ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold text-white flex items-center gap-2.5">
            <History className="w-6 h-6 text-indigo-400" />
            Move History
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Append-only stock ledger — {total.toLocaleString()} movement{total !== 1 ? 's' : ''} recorded
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          aria-label="Refresh ledger"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search by product"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by product name or SKU…"
            className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/70 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500 flex-shrink-0" aria-hidden="true" />
          <select
            aria-label="Filter by operation type"
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
            className="bg-slate-900/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          >
            <option value="">All Types</option>
            <option value="RECEIPT">Receipt</option>
            <option value="DELIVERY">Delivery</option>
            <option value="INTERNAL">Internal Transfer</option>
            <option value="ADJUSTMENT">Adjustment</option>
          </select>
          <select
            aria-label="Filter by location"
            value={locationFilter}
            onChange={(e) => { setLocationFilter(e.target.value); setPage(1) }}
            className="bg-slate-900/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          >
            <option value="">All Locations</option>
            {warehouses.flatMap((warehouse) => warehouse.locations.map((location) => (
              <option key={location.id} value={location.id}>{warehouse.name} · {location.name}</option>
            )))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-2xl border border-slate-700/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th scope="col" className="py-3 pl-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Timestamp</th>
                <th scope="col" className="py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Type</th>
                <th scope="col" className="py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Product</th>
                <th scope="col" className="py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Movement</th>
                <th scope="col" className="py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 text-right">Quantity</th>
                <th scope="col" className="py-3 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Reference</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-800/60">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="py-4 px-4">
                        <div className="h-4 bg-slate-800 rounded animate-pulse" style={{ width: `${60 + j * 10}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <Package className="w-10 h-10 mx-auto text-slate-600 mb-3" />
                    <p className="text-slate-400 font-medium">No ledger entries found</p>
                    <p className="text-slate-600 text-sm mt-1">
                      {search || typeFilter ? 'Try clearing your filters.' : 'Stock movements will appear here once operations are validated.'}
                    </p>
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-800/60 hover:bg-slate-800/20 transition-colors group">
                    <td className="py-3.5 pl-4">
                      <p className="text-sm text-slate-200">
                        {new Date(entry.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-slate-600">
                        {new Date(entry.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>
                    <td className="py-3.5">
                      {entry.operation_type && (
                        <span className={`status-badge border text-[11px] ${TYPE_COLORS[entry.operation_type] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                          {entry.operation_type}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5">
                      <p className="text-sm text-slate-200 font-medium">{entry.product_name ?? '—'}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{entry.product_sku}</p>
                    </td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <span className="truncate max-w-[120px]">{entry.from_location_name ?? <span className="italic text-slate-600">External</span>}</span>
                        <ArrowRightCircle className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                        <span className="truncate max-w-[120px]">{entry.to_location_name ?? <span className="italic text-slate-600">External</span>}</span>
                      </div>
                    </td>
                    <td className="py-3.5 text-right">
                      <p className="font-mono font-bold text-sm text-emerald-400">
                        {entry.quantity.toLocaleString()} {entry.uom}
                      </p>
                    </td>
                    <td className="py-3.5 pr-4">
                      <p className="text-xs font-mono text-slate-400 truncate max-w-[160px]">{entry.operation_reference ?? entry.operation_id}</p>
                      <p className="text-xs text-slate-600 truncate">{entry.user_name}</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()} entries
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                        pageNum === page
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
