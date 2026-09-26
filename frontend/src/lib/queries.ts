import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { Category, DashboardKPIs, Product, StockOperation, Warehouse } from '../types'

export function useKPIs(warehouseId = '', categoryId = '') {
  const params = new URLSearchParams()
  if (warehouseId) params.set('warehouse_id', warehouseId)
  if (categoryId) params.set('category_id', categoryId)
  const query = params.toString()

  return useQuery<DashboardKPIs>({
    queryKey: ['dashboard-kpis', warehouseId, categoryId],
    queryFn: () => api.get(`/dashboard/kpis${query ? `?${query}` : ''}`),
  })
}

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/products/categories'),
  })
}

export function useProducts(search = '', categoryId = '') {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (categoryId) params.set('category_id', categoryId)
  const query = params.toString()

  return useQuery<Product[]>({
    queryKey: ['products', search, categoryId],
    queryFn: () => api.get(`/products${query ? `?${query}` : ''}`),
    placeholderData: (previous) => previous,
  })
}

export function useOperations(operationType = '') {
  const query = operationType ? `?operation_type=${encodeURIComponent(operationType)}` : ''

  return useQuery<StockOperation[]>({
    queryKey: ['operations', operationType],
    queryFn: () => api.get(`/operations${query}`),
    placeholderData: (previous) => previous,
  })
}

export function useWarehouses() {
  return useQuery<Warehouse[]>({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses'),
  })
}