import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Package, Plus, Search, Filter, Edit2, ChevronDown, ChevronRight,
  XCircle, CheckCircle2, Layers, X, RefreshCw
} from 'lucide-react'
import { api } from '../lib/api'
import { useCategories, useProducts } from '../lib/queries'
import { useDialogFocus } from '../lib/useDialogFocus'
import { useAuth } from '../context/AuthContext'
import type { Product, Category } from '../types'

interface ProductModalProps {
  product?: Product
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}

/* ─── Stock Status Badge ─── */
const StockBadge: React.FC<{ product: Product }> = ({ product }) => {
  if (product.total_on_hand === 0)
    return <span className="status-badge bg-rose-500/15 text-rose-400 border border-rose-500/30">Out of Stock</span>
  if (product.total_on_hand <= product.min_stock_level)
    return <span className="status-badge bg-amber-500/15 text-amber-400 border border-amber-500/30">Low Stock</span>
  return <span className="status-badge bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">In Stock</span>
}

/* ─── Product Modal ─── */
const ProductModal: React.FC<ProductModalProps> = ({ product, categories, onClose, onSaved }) => {
  const qc = useQueryClient()
  const dialogRef = useDialogFocus<HTMLDivElement>()
  const [sku, setSku] = useState(product?.sku ?? '')
  const [name, setName] = useState(product?.name ?? '')
  const [uom, setUom] = useState(product?.uom ?? 'Units')
  const [categoryId, setCategoryId] = useState(product?.category_id ?? '')
  const [minStock, setMinStock] = useState(String(product?.min_stock_level ?? 0))
  const [maxStock, setMaxStock] = useState(String(product?.max_stock_level ?? ''))
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        sku: sku.trim(),
        name: name.trim(),
        uom: uom.trim(),
        category_id: categoryId || null,
        min_stock_level: Number(minStock),
        max_stock_level: maxStock ? Number(maxStock) : null,
      }
      if (product) {
        return api.put(`/products/${product.id}`, payload)
      }
      return api.post('/products', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      onSaved()
    },
    onError: (err: any) => setError(err.message || 'Failed to save product.'),
  })

  const inputCls = 'w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/70 transition-all'

  return (
    <>
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={product ? 'Edit Product' : 'Create Product'}
        tabIndex={-1}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-md glass-panel rounded-2xl border border-slate-700/80 shadow-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading font-bold text-white text-lg">
              {product ? 'Edit Product' : 'New Product'}
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors" aria-label="Close modal">
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300 flex items-start gap-2">
              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => { e.preventDefault(); mutation.mutate() }}
            className="space-y-3.5"
            noValidate
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="prod-sku" className="block text-xs font-semibold text-slate-300 mb-1">SKU *</label>
                <input id="prod-sku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="STL-ROD-001" required className={inputCls} />
              </div>
              <div>
                <label htmlFor="prod-uom" className="block text-xs font-semibold text-slate-300 mb-1">Unit of Measure *</label>
                <input id="prod-uom" value={uom} onChange={(e) => setUom(e.target.value)} placeholder="Units" required className={inputCls} />
              </div>
            </div>

            <div>
              <label htmlFor="prod-name" className="block text-xs font-semibold text-slate-300 mb-1">Product Name *</label>
              <input id="prod-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Steel Rod 12mm" required className={inputCls} />
            </div>

            <div>
              <label htmlFor="prod-cat" className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
              <select id="prod-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="prod-min" className="block text-xs font-semibold text-slate-300 mb-1">Min Stock Level</label>
                <input id="prod-min" type="number" min="0" value={minStock} onChange={(e) => setMinStock(e.target.value)} placeholder="0" className={inputCls} />
              </div>
              <div>
                <label htmlFor="prod-max" className="block text-xs font-semibold text-slate-300 mb-1">Max Stock Level</label>
                <input id="prod-max" type="number" min="0" value={maxStock} onChange={(e) => setMaxStock(e.target.value)} placeholder="Optional" className={inputCls} />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                disabled={mutation.isPending || !sku || !name}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-60"
              >
                {mutation.isPending
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</>
                  : <><CheckCircle2 className="w-4 h-4" /> {product ? 'Save Changes' : 'Create Product'}</>
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

/* ─── Product Row ─── */
const ProductRow: React.FC<{ product: Product; onEdit: () => void; isManager: boolean }> = ({ product, onEdit, isManager }) => {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors group">
        <td className="py-3.5 pl-4 pr-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
            aria-label={expanded ? 'Collapse stock details' : 'Expand stock details'}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </td>
        <td className="py-3.5">
          <p className="font-semibold text-sm text-slate-200 group-hover:text-white transition-colors">{product.name}</p>
          <p className="text-xs text-slate-500 font-mono mt-0.5">{product.sku}</p>
        </td>
        <td className="py-3.5">
          <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
            {product.category_name ?? '—'}
          </span>
        </td>
        <td className="py-3.5 text-right">
          <p className="font-semibold text-sm text-slate-200">{product.total_on_hand.toLocaleString()}</p>
          <p className="text-xs text-slate-500">{product.uom}</p>
        </td>
        <td className="py-3.5 text-right text-slate-400 text-sm">{product.total_reserved.toLocaleString()}</td>
        <td className="py-3.5 text-right">
          <p className="text-sm font-semibold text-emerald-400">{product.total_available.toLocaleString()}</p>
        </td>
        <td className="py-3.5 text-center">
          <StockBadge product={product} />
        </td>
        <td className="py-3.5 pr-4 text-right">
          {isManager && (
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg hover:bg-indigo-500/20 text-slate-500 hover:text-indigo-400 transition-colors opacity-0 group-hover:opacity-100"
              aria-label={`Edit ${product.name}`}
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </td>
      </tr>

      {/* Expandable: per-location stock breakdown */}
      {expanded && (
        <tr className="bg-slate-900/40 border-b border-slate-800/60">
          <td colSpan={8} className="px-8 py-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Stock by Location — {product.name}
            </p>
            {product.stock_by_location.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No stock recorded in any location.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {product.stock_by_location.map((loc) => (
                  <div
                    key={loc.location_id}
                    className="px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs"
                  >
                    <p className="font-semibold text-slate-300">{loc.location_name}</p>
                    <p className="text-slate-500 text-[11px]">{loc.warehouse_name}</p>
                    <p className="mt-1 font-mono text-emerald-400 font-bold">{loc.on_hand.toLocaleString()} {product.uom}</p>
                    <p className="text-slate-600 text-[10px]">reserved: {loc.reserved} · avail: {loc.available}</p>
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

/* ─── Products Page ─── */
export const ProductsPage: React.FC = () => {
  const { isManager } = useAuth()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | undefined>()
  const pageSize = 20

  const { data: catData } = useCategories()
  const { data: allProducts = [], isLoading, refetch } = useProducts(search, categoryFilter)

  const total = allProducts.length
  const totalPages = Math.ceil(total / pageSize)
  const categories = catData ?? []
  const products = allProducts.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold text-white flex items-center gap-2.5">
            <Package className="w-6 h-6 text-indigo-400" />
            Products
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {total.toLocaleString()} product{total !== 1 ? 's' : ''} in catalogue
          </p>
        </div>
        {isManager && (
          <button
            onClick={() => { setEditProduct(undefined); setModalOpen(true) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-500/25 transition-all"
          >
            <Plus className="w-4 h-4" /> New Product
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search products"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by name or SKU…"
            className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/70 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500 flex-shrink-0" aria-hidden="true" />
          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
            className="bg-slate-900/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            onClick={() => refetch()}
            className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label="Refresh products"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-2xl border border-slate-700/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th scope="col" className="py-3 pl-4 pr-2 w-10" aria-label="Expand" />
                <th scope="col" className="py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Product</th>
                <th scope="col" className="py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Category</th>
                <th scope="col" className="py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 text-right">On-Hand</th>
                <th scope="col" className="py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 text-right">Reserved</th>
                <th scope="col" className="py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 text-right">Available</th>
                <th scope="col" className="py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 text-center">Status</th>
                <th scope="col" className="py-3 pr-4 w-12" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-800/60">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="py-4 px-3">
                        <div className="h-4 bg-slate-800 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <Layers className="w-10 h-10 mx-auto text-slate-600 mb-3" />
                    <p className="text-slate-400 font-medium">No products found</p>
                    <p className="text-slate-600 text-sm mt-1">
                      {search || categoryFilter ? 'Try clearing your filters.' : isManager ? 'Create your first product above.' : 'Products will appear here.'}
                    </p>
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    isManager={isManager}
                    onEdit={() => { setEditProduct(p); setModalOpen(true) }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Page {page} of {totalPages} · {total} total</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 transition-colors"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <ProductModal
          product={editProduct}
          categories={categories}
          onClose={() => setModalOpen(false)}
          onSaved={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}
