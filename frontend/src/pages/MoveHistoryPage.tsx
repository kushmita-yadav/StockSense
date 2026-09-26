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
  RECEIPT: 'bg-sage-500/15 text-sage-700 border-sage-500/30',
  DELIVERY: 'bg-plum-500/15 text-plum-700 border-plum-500/30',
  INTERNAL: 'bg-brand-500/15 text-brand-700 border-brand-500/30',
  ADJUSTMENT: 'bg-brand-400/15 text-brand-700 border-brand-400/30',
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
          <h1 className="font-heading text-2xl font-extrabold text-ink flex items-center gap-2.5">
            <History className="w-6 h-6 text-brand-700" />
            Move History
          </h1>
          <p className="text-sm text-muted mt-0.5">
            Append-only stock ledger — {total.toLocaleString()} movement{total !== 1 ? 's' : ''} recorded
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2.5 rounded-xl bg-surface/80 border border-brand-200/80 text-muted hover:text-ink hover:bg-biscuit transition-colors"
          aria-label="Refresh ledger"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search by product"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by product name or SKU…"
            className="w-full bg-surface/80 border border-brand-200/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/70 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted flex-shrink-0" aria-hidden="true" />
          <select
            aria-label="Filter by operation type"
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
            className="bg-surface/80 border border-brand-200/80 rounded-xl px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
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
            className="bg-surface/80 border border-brand-200/80 rounded-xl px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
          >
            <option value="">All Locations</option>
            {warehouses.flatMap((warehouse) => warehouse.locations.map((location) => (
              <option key={location.id} value={location.id}>{warehouse.name} · {location.name}</option>
            )))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-2xl border border-brand-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-biscuit bg-surface/50">
                <th scope="col" className="py-3 pl-4 text-xs font-semibold uppercase tracking-wider text-muted">Timestamp</th>
                <th scope="col" className="py-3 text-xs font-semibold uppercase tracking-wider text-muted">Type</th>
                <th scope="col" className="py-3 text-xs font-semibold uppercase tracking-wider text-muted">Product</th>
                <th scope="col" className="py-3 text-xs font-semibold uppercase tracking-wider text-muted">Movement</th>
                <th scope="col" className="py-3 text-xs font-semibold uppercase tracking-wider text-muted text-right">Quantity</th>
                <th scope="col" className="py-3 pr-4 text-xs font-semibold uppercase tracking-wider text-muted">Reference</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-biscuit/60">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="py-4 px-4">
                        <div className="h-4 bg-biscuit rounded animate-pulse" style={{ width: `${60 + j * 10}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <Package className="w-10 h-10 mx-auto text-muted mb-3" />
                    <p className="text-muted font-medium">No ledger entries found</p>
                    <p className="text-muted text-sm mt-1">
                      {search || typeFilter ? 'Try clearing your filters.' : 'Stock movements will appear here once operations are validated.'}
                    </p>
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-biscuit/60 hover:bg-biscuit/20 transition-colors group">
                    <td className="py-3.5 pl-4">
                      <p className="text-sm text-ink">
                        {new Date(entry.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-muted">
                        {new Date(entry.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>
                    <td className="py-3.5">
                      {entry.operation_type && (
                        <span className={`status-badge border text-[11px] ${TYPE_COLORS[entry.operation_type] ?? 'bg-brand-200 text-ink border-muted'}`}>
                          {entry.operation_type}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5">
                      <p className="text-sm text-ink font-medium">{entry.product_name ?? '—'}</p>
                      <p className="text-xs text-muted font-mono mt-0.5">{entry.product_sku}</p>
                    </td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-1.5 text-xs text-muted">
                        <span className="truncate max-w-[120px]">{entry.from_location_name ?? <span className="italic text-muted">External</span>}</span>
                        <ArrowRightCircle className="w-3.5 h-3.5 text-muted flex-shrink-0" />
                        <span className="truncate max-w-[120px]">{entry.to_location_name ?? <span className="italic text-muted">External</span>}</span>
                      </div>
                    </td>
                    <td className="py-3.5 text-right">
                      <p className="font-mono font-bold text-sm text-sage-700">
                        {entry.quantity.toLocaleString()} {entry.uom}
                      </p>
                    </td>
                    <td className="py-3.5 pr-4">
                      <p className="text-xs font-mono text-muted truncate max-w-[160px]">{entry.operation_reference ?? entry.operation_id}</p>
                      <p className="text-xs text-muted truncate">{entry.user_name}</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-biscuit flex items-center justify-between">
            <p className="text-xs text-muted">
              Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()} entries
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-biscuit hover:bg-brand-200 text-ink disabled:opacity-40 transition-colors"
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
                          ? 'bg-brand-600 text-ink'
                          : 'bg-biscuit hover:bg-brand-200 text-ink'
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
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-biscuit hover:bg-brand-200 text-ink disabled:opacity-40 transition-colors"
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
