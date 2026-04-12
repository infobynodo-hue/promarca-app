// ─── CATEGORIES ───
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  display_order: number;
  is_active: boolean;
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
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  category?: Category;
  subcategory?: Subcategory;
  product_colors?: ProductColor[];
  product_images?: ProductImage[];
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
  // Joined
  product?: Product;
}
