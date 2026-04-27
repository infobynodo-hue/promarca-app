// ─── CATEGORIES ───
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  cover_image_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── PROMO CARDS (homepage featured grid) ───
export interface PromoCard {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string | null;
  catalog_slug: string | null;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
  is_dark: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  display_order: number;
}

// ─── PRODUCTS ───
export interface Product {
  id: string;
  category_id: string | null;
  subcategory_id: string | null;
  reference: string;
  name: string;
  description: string | null;
  price: number;
  price_label: string;
  has_variants: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  category?: Category;
  subcategory?: Subcategory;
  product_colors?: ProductColor[];
  product_images?: ProductImage[];
  product_variants?: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  product_id: string;
  label: string;
  price: number;
  reference: string | null;
  is_default: boolean;
  display_order: number;
  created_at: string;
}

export interface ProductColor {
  id: string;
  product_id: string;
  name: string;
  hex_color: string;
  display_order: number;
}

export interface ProductImage {
  id: string;
  product_id: string;
  storage_path: string;
  alt_text: string | null;
  is_primary: boolean;
  display_order: number;
}

// ─── CLIENTS ───
export interface Client {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  nit: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── QUOTES ───
export interface Quote {
  id: string;
  quote_number: string;
  client_id: string | null;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired";
  subtotal: number;
  discount_percent: number;
  iva_percent: number;
  total: number;
  notes: string | null;
  valid_until: string | null;
  pdf_storage_path: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  client?: Client;
  quote_items?: QuoteItem[];
}

export interface QuoteItem {
  id: string;
  quote_id: string;
  product_id: string | null;
  product_name: string;
  product_reference: string | null;
  quantity: number;
  unit_price: number;
  marking_type: string | null;
  marking_price: number;
  line_total: number;
  notes: string | null;
  display_order: number;
  // Order confirmation
  is_confirmed: boolean | null;
  confirmed_quantity: number | null;
  // Joined
  product?: Product;
}

// ─── PROVIDERS ───
export interface Provider {
  id: string;
  name: string;
  type: "marcacion" | "logistica" | "insumos" | "general";
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── ORDERS ───
export type OrderStatus =
  | "confirmado"
  | "en_almacen"
  | "en_marcacion"
  | "salida_marcacion"
  | "en_camino"
  | "entregado";

export interface Order {
  id: string;
  order_number: string;
  quote_id: string | null;
  client_id: string | null;
  order_date: string;
  estimated_delivery: string | null;
  total_billed: number;
  advance_payment: number;
  client_notification_email: string | null;
  current_status: OrderStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  client?: Client;
  quote?: Quote;
  order_status_history?: OrderStatusHistory[];
  order_costs?: OrderCost[];
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  status: OrderStatus;
  notes: string | null;
  email_sent: boolean;
  created_at: string;
}

export interface OrderCost {
  id: string;
  order_id: string;
  cost_type: "producto" | "marcacion" | "logistica" | "empaque" | "otro";
  provider_id: string | null;
  provider_name: string | null;
  description: string;
  amount: number;
  display_order: number;
  created_at: string;
  updated_at: string;
  // Joined
  provider?: Provider;
}
