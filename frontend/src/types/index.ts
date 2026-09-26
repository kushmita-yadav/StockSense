export type UserRole = 'INVENTORY_MANAGER' | 'WAREHOUSE_STAFF';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface StockPerLocation {
  location_id: string;
  location_name: string;
  warehouse_name: string;
  on_hand: number;
  reserved: number;
  available: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category_id?: string | null;
  category_name?: string | null;
  uom: string;
  min_stock_level: number;
  max_stock_level?: number | null;
  created_at: string;
  total_on_hand: number;
  total_reserved: number;
  total_available: number;
  stock_by_location: StockPerLocation[];
}

export type LocationType = 'INTERNAL' | 'VENDOR_VIRTUAL' | 'CUSTOMER_VIRTUAL' | 'LOSS_VIRTUAL';

export interface Location {
  id: string;
  warehouse_id: string;
  name: string;
  type: LocationType;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  locations: Location[];
}

export type OperationType = 'RECEIPT' | 'DELIVERY' | 'INTERNAL' | 'ADJUSTMENT';
export type OperationStatus = 'DRAFT' | 'WAITING' | 'READY' | 'DONE' | 'CANCELED';
export type ReasonCode = 'DAMAGED' | 'MISCOUNT' | 'THEFT' | 'OTHER';

export interface OperationLine {
  id: string;
  operation_id: string;
  product_id: string;
  product_name?: string;
  product_sku?: string;
  uom?: string;
  quantity_demanded: number;
  quantity_done: number;
}

export interface StockOperation {
  id: string;
  reference: string;
  operation_type: OperationType;
  source_location_id?: string | null;
  source_location_name?: string | null;
  destination_location_id?: string | null;
  destination_location_name?: string | null;
  contact_name?: string | null;
  reason_code?: ReasonCode | null;
  status: OperationStatus;
  scheduled_date?: string | null;
  created_by: string;
  creator_name?: string | null;
  created_at: string;
  lines: OperationLine[];
}

export interface StockLedgerEntry {
  id: string;
  operation_id: string;
  operation_reference?: string;
  operation_type?: string;
  product_id: string;
  product_name?: string;
  product_sku?: string;
  uom?: string;
  from_location_id?: string | null;
  from_location_name?: string;
  to_location_id?: string | null;
  to_location_name?: string;
  quantity: number;
  user_id: string;
  user_name?: string;
  timestamp: string;
}

export interface StockQuant {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  uom: string;
  location_id: string;
  location_name: string;
  warehouse_name: string;
  on_hand: number;
  reserved: number;
  available: number;
}

export interface ReorderAlert {
  product_id: string;
  sku: string;
  name: string;
  uom: string;
  current_stock: number;
  min_stock_level: number;
  suggested_order_qty: number;
}

export interface DashboardKPIs {
  total_products: number;
  total_products_in_stock: number;
  low_stock_items: number;
  out_of_stock_items: number;
  pending_receipts: number;
  pending_deliveries: number;
  scheduled_transfers: number;
  recent_activities: StockLedgerEntry[];
  reorder_alerts: ReorderAlert[];
}
