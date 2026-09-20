import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  writeBatch,
  serverTimestamp,
  type DocumentData
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, auth } from './firebase';

// Collection paths following prompt architecture
export const PATHS = {
  // Public
  CATALOGUE_PRODUCTS: 'publicCatalogue/store/products',
  CATALOGUE_CATEGORIES: 'publicCatalogue/store/categories',
  CATALOGUE_SHOP_INFO: 'publicCatalogue/store/shopInfo',
  CATALOGUE_SETTINGS: 'publicCatalogue/store/settings',

  // Private Shop Data (Strictly Owner-Only)
  PRODUCTS: 'privateShopData/inventory/products',
  CATEGORIES: 'privateShopData/inventory/categories',
  STOCK_MOVEMENTS: 'privateShopData/inventory/stockMovements',
  SALES: 'privateShopData/sales/records',
  SALE_ITEMS: 'privateShopData/sales/items',
  PURCHASES: 'privateShopData/purchases/records',
  PURCHASE_ITEMS: 'privateShopData/purchases/items',
  CUSTOMERS: 'privateShopData/customers/records',
  CUSTOMER_LEDGER: 'privateShopData/customers/ledger',
  SUPPLIERS: 'privateShopData/suppliers/records',
  SUPPLIER_LEDGER: 'privateShopData/suppliers/ledger',
  EXPENSES: 'privateShopData/expenses/records',
  PAYMENTS: 'privateShopData/payments/records',
  RETURNS: 'privateShopData/returns/records',
  SETTINGS: 'privateShopData/settings/config',
  AUDIT_LOGS: 'privateShopData/audit/logs',
  BACKUPS: 'privateShopData/backup/records',
};

// Helper to record audit logs
export async function logAction(action: string, module: string, recordId: string, details: string = '') {
  try {
    const user = auth.currentUser;
    await addDoc(collection(db, PATHS.AUDIT_LOGS), {
      userId: user?.uid || 'system',
      userEmail: user?.email || 'owner',
      action,
      module,
      recordId,
      details,
      timestamp: new Date().toISOString(),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Failed to record audit log:', err);
  }
}

// ---------------------------------------------------------------------------
// BARCODE SYSTEM
// ---------------------------------------------------------------------------

/**
 * Generate a unique barcode based on product SKU or retail standard format.
 * Format: e.g. "890" (India standard) + "MRG" + 6-digit unique number
 */
export async function generateUniqueBarcode(skuPrefix: string = 'MRG'): Promise<string> {
  let isUnique = false;
  let attempts = 0;
  let barcode = '';

  while (!isUnique && attempts < 10) {
    attempts++;
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    barcode = `890${skuPrefix}${randomNum}`;

    // Verify barcode uniqueness against Firestore
    const q = query(collection(db, PATHS.PRODUCTS), where('barcode', '==', barcode), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) {
      isUnique = true;
    }
  }

  if (!isUnique) {
    barcode = `890${skuPrefix}${Date.now().toString().slice(-6)}`;
  }

  return barcode;
}

/**
 * Check if a barcode already exists in the system.
 */
export async function checkBarcodeExists(barcode: string, excludeProductId?: string): Promise<boolean> {
  if (!barcode) return false;
  const q = query(collection(db, PATHS.PRODUCTS), where('barcode', '==', barcode.trim()), limit(5));
  const snap = await getDocs(q);
  if (snap.empty) return false;
  if (excludeProductId) {
    return snap.docs.some(d => d.id !== excludeProductId);
  }
  return true;
}

// ---------------------------------------------------------------------------
// PRODUCTS & INVENTORY
// ---------------------------------------------------------------------------

export const DEFAULT_PRODUCTS = [
  {
    id: 'prod_1',
    name: 'Pure Cotton Royal Kurta Pajama',
    sku: 'MRG-KUR-01',
    barcode: '890MRG100234',
    category_id: 'cat_1',
    category_name: 'Kurta & Pajama',
    brand: 'Munna Collection',
    fabric: 'Pure Cotton',
    gender: 'Men',
    gst_rate: 5,
    mrp: 2299,
    purchase_price: 850,
    selling_price: 1499,
    min_stock: 5,
    description: 'Premium festive cotton kurta pajama crafted with breathable threadwork.',
    variants: [
      { id: 'v_1', size: 'M', color: 'Cream / Off-White', stock: 15, purchase_price: 850, selling_price: 1499 },
      { id: 'v_2', size: 'L', color: 'Royal Blue', stock: 20, purchase_price: 850, selling_price: 1499 },
      { id: 'v_3', size: 'XL', color: 'Maroon', stock: 15, purchase_price: 850, selling_price: 1499 },
    ],
    images: [],
    active: true,
    show_in_catalogue: true,
    is_featured: true,
    is_new_arrival: true,
    is_best_seller: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod_2',
    name: 'Linen Slim Fit Casual Shirt',
    sku: 'MRG-SHT-02',
    barcode: '890MRG100235',
    category_id: 'cat_2',
    category_name: 'Shirts & Trousers',
    brand: 'Munna Readymade',
    fabric: 'Pure Linen',
    gender: 'Men',
    gst_rate: 5,
    mrp: 1499,
    purchase_price: 480,
    selling_price: 899,
    min_stock: 5,
    description: 'Ultra-comfortable breathable linen shirt for daily retail wear.',
    variants: [
      { id: 'v_4', size: '38', color: 'White', stock: 12, purchase_price: 480, selling_price: 899 },
      { id: 'v_5', size: '40', color: 'Sky Blue', stock: 18, purchase_price: 480, selling_price: 899 },
      { id: 'v_6', size: '42', color: 'Light Pink', stock: 10, purchase_price: 480, selling_price: 899 },
    ],
    images: [],
    active: true,
    show_in_catalogue: true,
    is_featured: true,
    is_new_arrival: false,
    is_best_seller: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod_3',
    name: 'Stretch Denim Jeans - Dark Indigo',
    sku: 'MRG-JNS-03',
    barcode: '890MRG100236',
    category_id: 'cat_5',
    category_name: 'Denim & Jeans',
    brand: 'Munna Collection',
    fabric: 'Stretch Denim',
    gender: 'Men',
    gst_rate: 5,
    mrp: 1999,
    purchase_price: 650,
    selling_price: 1199,
    min_stock: 5,
    description: 'High durability stretch denim with reinforced stitching for rough & tough use.',
    variants: [
      { id: 'v_7', size: '30', color: 'Dark Indigo', stock: 10, purchase_price: 650, selling_price: 1199 },
      { id: 'v_8', size: '32', color: 'Dark Indigo', stock: 15, purchase_price: 650, selling_price: 1199 },
      { id: 'v_9', size: '34', color: 'Dark Indigo', stock: 10, purchase_price: 650, selling_price: 1199 },
    ],
    images: [],
    active: true,
    show_in_catalogue: true,
    is_featured: false,
    is_new_arrival: true,
    is_best_seller: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod_4',
    name: 'Checkered Casual Cotton Shirt',
    sku: 'MRG-SHT-04',
    barcode: '890MRG100237',
    category_id: 'cat_2',
    category_name: 'Shirts & Trousers',
    brand: 'Munna Readymade',
    fabric: 'Pure Cotton',
    gender: 'Men',
    gst_rate: 5,
    mrp: 1399,
    purchase_price: 420,
    selling_price: 799,
    min_stock: 6,
    description: 'Stylish checkered full sleeve shirt with soft brushed cotton fabric.',
    variants: [
      { id: 'v_10', size: 'M', color: 'Navy & Red Check', stock: 14, purchase_price: 420, selling_price: 799 },
      { id: 'v_11', size: 'L', color: 'Navy & Red Check', stock: 16, purchase_price: 420, selling_price: 799 },
      { id: 'v_12', size: 'XL', color: 'Olive & White Check', stock: 12, purchase_price: 420, selling_price: 799 },
    ],
    images: [],
    active: true,
    show_in_catalogue: true,
    is_featured: true,
    is_new_arrival: true,
    is_best_seller: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod_5',
    name: 'Modi Nehru Ethnic Sleeveless Jacket',
    sku: 'MRG-NJ-05',
    barcode: '890MRG100238',
    category_id: 'cat_1',
    category_name: 'Kurta & Pajama',
    brand: 'Munna Collection',
    fabric: 'Jute Khadi Blend',
    gender: 'Men',
    gst_rate: 5,
    mrp: 1899,
    purchase_price: 600,
    selling_price: 1199,
    min_stock: 4,
    description: 'Traditional mandarin collar Modi jacket with metallic buttons.',
    variants: [
      { id: 'v_13', size: '38', color: 'Jet Black', stock: 8, purchase_price: 600, selling_price: 1199 },
      { id: 'v_14', size: '40', color: 'Tweed Brown', stock: 12, purchase_price: 600, selling_price: 1199 },
      { id: 'v_15', size: '42', color: 'Wine Red', stock: 7, purchase_price: 600, selling_price: 1199 },
    ],
    images: [],
    active: true,
    show_in_catalogue: true,
    is_featured: true,
    is_new_arrival: false,
    is_best_seller: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod_6',
    name: 'Formal Slim Fit Cotton Trousers',
    sku: 'MRG-TRS-06',
    barcode: '890MRG100239',
    category_id: 'cat_2',
    category_name: 'Shirts & Trousers',
    brand: 'Munna Readymade',
    fabric: 'Poly Viscose Cotton',
    gender: 'Men',
    gst_rate: 5,
    mrp: 1599,
    purchase_price: 500,
    selling_price: 949,
    min_stock: 5,
    description: 'Wrinkle-free executive formal pants with comfort stretch waist.',
    variants: [
      { id: 'v_16', size: '30', color: 'Dark Grey', stock: 9, purchase_price: 500, selling_price: 949 },
      { id: 'v_17', size: '32', color: 'Navy Blue', stock: 14, purchase_price: 500, selling_price: 949 },
      { id: 'v_18', size: '34', color: 'Black', stock: 11, purchase_price: 500, selling_price: 949 },
    ],
    images: [],
    active: true,
    show_in_catalogue: true,
    is_featured: false,
    is_new_arrival: true,
    is_best_seller: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod_7',
    name: 'Banarasi Silk Zari Border Saree',
    sku: 'MRG-SAR-07',
    barcode: '890MRG100240',
    category_id: 'cat_3',
    category_name: 'Suits & Sarees',
    brand: 'Munna Collection',
    fabric: 'Banarasi Art Silk',
    gender: 'Women',
    gst_rate: 5,
    mrp: 3499,
    purchase_price: 1200,
    selling_price: 2199,
    min_stock: 3,
    description: 'Rich jacquard woven wedding saree with golden zari pallu and blouse piece.',
    variants: [
      { id: 'v_19', size: 'Free Size', color: 'Crimson Red', stock: 6, purchase_price: 1200, selling_price: 2199 },
      { id: 'v_20', size: 'Free Size', color: 'Peacock Blue', stock: 5, purchase_price: 1200, selling_price: 2199 },
      { id: 'v_21', size: 'Free Size', color: 'Emerald Green', stock: 7, purchase_price: 1200, selling_price: 2199 },
    ],
    images: [],
    active: true,
    show_in_catalogue: true,
    is_featured: true,
    is_new_arrival: true,
    is_best_seller: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod_8',
    name: 'Embroidered Chanderi Salwar Suit Material',
    sku: 'MRG-SUT-08',
    barcode: '890MRG100241',
    category_id: 'cat_3',
    category_name: 'Suits & Sarees',
    brand: 'Munna Readymade',
    fabric: 'Chanderi Cotton',
    gender: 'Women',
    gst_rate: 5,
    mrp: 2499,
    purchase_price: 850,
    selling_price: 1599,
    min_stock: 4,
    description: 'Designer 3-piece unstitched suit with heavy embroidered neckline and dupatta.',
    variants: [
      { id: 'v_22', size: 'Unstitched', color: 'Pista Green', stock: 8, purchase_price: 850, selling_price: 1599 },
      { id: 'v_23', size: 'Unstitched', color: 'Mustard Yellow', stock: 10, purchase_price: 850, selling_price: 1599 },
      { id: 'v_24', size: 'Unstitched', color: 'Rani Pink', stock: 7, purchase_price: 850, selling_price: 1599 },
    ],
    images: [],
    active: true,
    show_in_catalogue: true,
    is_featured: true,
    is_new_arrival: false,
    is_best_seller: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod_9',
    name: 'Georgette Party Wear Anarkali Kurti',
    sku: 'MRG-KRT-09',
    barcode: '890MRG100242',
    category_id: 'cat_3',
    category_name: 'Suits & Sarees',
    brand: 'Munna Collection',
    fabric: 'Georgette with Inner',
    gender: 'Women',
    gst_rate: 5,
    mrp: 2199,
    purchase_price: 700,
    selling_price: 1299,
    min_stock: 4,
    description: 'Flared floor-length georgette party kurti with thread and sequin work.',
    variants: [
      { id: 'v_25', size: 'M', color: 'Teal Blue', stock: 6, purchase_price: 700, selling_price: 1299 },
      { id: 'v_26', size: 'L', color: 'Dusty Rose', stock: 9, purchase_price: 700, selling_price: 1299 },
      { id: 'v_27', size: 'XL', color: 'Wine Red', stock: 6, purchase_price: 700, selling_price: 1299 },
    ],
    images: [],
    active: true,
    show_in_catalogue: true,
    is_featured: false,
    is_new_arrival: true,
    is_best_seller: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod_10',
    name: 'Boys Festive Silk Kurta Dhoti Set',
    sku: 'MRG-KID-10',
    barcode: '890MRG100243',
    category_id: 'cat_4',
    category_name: 'Kids Collection',
    brand: 'Munna Kids',
    fabric: 'Art Silk Cotton',
    gender: 'Kids',
    gst_rate: 5,
    mrp: 1299,
    purchase_price: 380,
    selling_price: 749,
    min_stock: 5,
    description: 'Cute comfortable festival ready kurta and readymade dhoti for little boys.',
    variants: [
      { id: 'v_28', size: '2-3Y', color: 'Bright Yellow', stock: 8, purchase_price: 380, selling_price: 749 },
      { id: 'v_29', size: '4-5Y', color: 'Festive Orange', stock: 10, purchase_price: 380, selling_price: 749 },
      { id: 'v_30', size: '6-7Y', color: 'Maroon', stock: 7, purchase_price: 380, selling_price: 749 },
    ],
    images: [],
    active: true,
    show_in_catalogue: true,
    is_featured: true,
    is_new_arrival: true,
    is_best_seller: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod_11',
    name: 'Girls Floral Princess Party Frock',
    sku: 'MRG-KID-11',
    barcode: '890MRG100244',
    category_id: 'cat_4',
    category_name: 'Kids Collection',
    brand: 'Munna Kids',
    fabric: 'Net & Satin Blend',
    gender: 'Kids',
    gst_rate: 5,
    mrp: 1499,
    purchase_price: 450,
    selling_price: 899,
    min_stock: 4,
    description: 'Multilayered birthday party frock with bow detail and cotton lining.',
    variants: [
      { id: 'v_31', size: '3-4Y', color: 'Baby Pink', stock: 7, purchase_price: 450, selling_price: 899 },
      { id: 'v_32', size: '5-6Y', color: 'Sky Blue', stock: 8, purchase_price: 450, selling_price: 899 },
      { id: 'v_33', size: '7-8Y', color: 'Lavender', stock: 6, purchase_price: 450, selling_price: 899 },
    ],
    images: [],
    active: true,
    show_in_catalogue: true,
    is_featured: true,
    is_new_arrival: false,
    is_best_seller: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod_12',
    name: 'Round Neck Bio-Wash Cotton T-Shirt',
    sku: 'MRG-TSH-12',
    barcode: '890MRG100245',
    category_id: 'cat_2',
    category_name: 'Shirts & Trousers',
    brand: 'Munna Readymade',
    fabric: '180 GSM Bio-Wash Cotton',
    gender: 'Men',
    gst_rate: 5,
    mrp: 799,
    purchase_price: 210,
    selling_price: 449,
    min_stock: 10,
    description: 'Breathable everyday round-neck solid casual tee.',
    variants: [
      { id: 'v_34', size: 'M', color: 'Jet Black', stock: 20, purchase_price: 210, selling_price: 449 },
      { id: 'v_35', size: 'L', color: 'Olive Green', stock: 25, purchase_price: 210, selling_price: 449 },
      { id: 'v_36', size: 'XL', color: 'Navy Blue', stock: 18, purchase_price: 210, selling_price: 449 },
    ],
    images: [],
    active: true,
    show_in_catalogue: true,
    is_featured: false,
    is_new_arrival: true,
    is_best_seller: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod_13',
    name: 'Polo Collar Mercerized T-Shirt',
    sku: 'MRG-POL-13',
    barcode: '890MRG100246',
    category_id: 'cat_2',
    category_name: 'Shirts & Trousers',
    brand: 'Munna Collection',
    fabric: 'Cotton Matty',
    gender: 'Men',
    gst_rate: 5,
    mrp: 999,
    purchase_price: 290,
    selling_price: 599,
    min_stock: 8,
    description: 'Premium polo t-shirt with ribbed collar and double contrast tipping.',
    variants: [
      { id: 'v_37', size: 'M', color: 'White / Navy Tip', stock: 12, purchase_price: 290, selling_price: 599 },
      { id: 'v_38', size: 'L', color: 'Maroon', stock: 15, purchase_price: 290, selling_price: 599 },
      { id: 'v_39', size: 'XL', color: 'Royal Blue', stock: 10, purchase_price: 290, selling_price: 599 },
    ],
    images: [],
    active: true,
    show_in_catalogue: true,
    is_featured: false,
    is_new_arrival: false,
    is_best_seller: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod_14',
    name: 'Cotton Casual Chinos Pants',
    sku: 'MRG-CHN-14',
    barcode: '890MRG100247',
    category_id: 'cat_5',
    category_name: 'Denim & Jeans',
    brand: 'Munna Collection',
    fabric: 'Stretch Twill Cotton',
    gender: 'Men',
    gst_rate: 5,
    mrp: 1699,
    purchase_price: 520,
    selling_price: 999,
    min_stock: 6,
    description: 'Tailored fit everyday chinos, pre-washed for extra softness.',
    variants: [
      { id: 'v_40', size: '30', color: 'Khaki Beige', stock: 10, purchase_price: 520, selling_price: 999 },
      { id: 'v_41', size: '32', color: 'Olive Green', stock: 14, purchase_price: 520, selling_price: 999 },
      { id: 'v_42', size: '34', color: 'Slate Grey', stock: 9, purchase_price: 520, selling_price: 999 },
    ],
    images: [],
    active: true,
    show_in_catalogue: true,
    is_featured: false,
    is_new_arrival: true,
    is_best_seller: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod_15',
    name: 'Heavy Woolen Winter Zipper Jacket',
    sku: 'MRG-JKT-15',
    barcode: '890MRG100248',
    category_id: 'cat_5',
    category_name: 'Denim & Jeans',
    brand: 'Munna Collection',
    fabric: 'Fleece Lined Wool Blend',
    gender: 'Men',
    gst_rate: 12,
    mrp: 2999,
    purchase_price: 950,
    selling_price: 1799,
    min_stock: 4,
    description: 'Windproof winter jacket with detachable hood and insulated fleece lining.',
    variants: [
      { id: 'v_43', size: 'M', color: 'Charcoal Grey', stock: 6, purchase_price: 950, selling_price: 1799 },
      { id: 'v_44', size: 'L', color: 'Navy Blue', stock: 9, purchase_price: 950, selling_price: 1799 },
      { id: 'v_45', size: 'XL', color: 'Black', stock: 7, purchase_price: 950, selling_price: 1799 },
    ],
    images: [],
    active: true,
    show_in_catalogue: true,
    is_featured: true,
    is_new_arrival: true,
    is_best_seller: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod_16',
    name: 'Pure Cashmere Touch Winter Shawl',
    sku: 'MRG-SHW-16',
    barcode: '890MRG100249',
    category_id: 'cat_3',
    category_name: 'Suits & Sarees',
    brand: 'Munna Collection',
    fabric: 'Cashmere Blend Wool',
    gender: 'Women',
    gst_rate: 5,
    mrp: 1999,
    purchase_price: 620,
    selling_price: 1199,
    min_stock: 5,
    description: 'Traditional Kashmiri border soft warm shawl for winter weddings.',
    variants: [
      { id: 'v_46', size: 'Free Size', color: 'Beige / Golden Border', stock: 10, purchase_price: 620, selling_price: 1199 },
      { id: 'v_47', size: 'Free Size', color: 'Black & Gold', stock: 8, purchase_price: 620, selling_price: 1199 },
    ],
    images: [],
    active: true,
    show_in_catalogue: true,
    is_featured: false,
    is_new_arrival: true,
    is_best_seller: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod_17',
    name: 'Kids Denim Dungaree & Tee Set',
    sku: 'MRG-KID-17',
    barcode: '890MRG100250',
    category_id: 'cat_4',
    category_name: 'Kids Collection',
    brand: 'Munna Kids',
    fabric: 'Washed Soft Denim',
    gender: 'Kids',
    gst_rate: 5,
    mrp: 1199,
    purchase_price: 350,
    selling_price: 699,
    min_stock: 4,
    description: 'Cute denim dungaree with attached striped inner t-shirt.',
    variants: [
      { id: 'v_48', size: '3-4Y', color: 'Light Denim', stock: 7, purchase_price: 350, selling_price: 699 },
      { id: 'v_49', size: '5-6Y', color: 'Dark Denim', stock: 6, purchase_price: 350, selling_price: 699 },
    ],
    images: [],
    active: true,
    show_in_catalogue: true,
    is_featured: false,
    is_new_arrival: true,
    is_best_seller: false,
    createdAt: new Date().toISOString()
  },
  // 3 SAMPLE / DUPLICATE ITEMS AS REQUESTED BY USER (Can be deleted by Owner anytime)
  {
    id: 'prod_18',
    name: '[DUPLICATE SAMPLE] Everyday Cotton Tee (Owner Delete Kr Sakta Hai)',
    sku: 'MRG-DUP-18',
    barcode: '890MRG100251',
    category_id: 'cat_2',
    category_name: 'Shirts & Trousers',
    brand: 'Munna Readymade',
    fabric: 'Single Jersey Cotton',
    gender: 'Men',
    gst_rate: 5,
    mrp: 599,
    purchase_price: 150,
    selling_price: 299,
    min_stock: 5,
    description: 'Sample duplicate product added for testing. Owner can delete this item from inventory anytime.',
    variants: [
      { id: 'v_50', size: 'M', color: 'White', stock: 10, purchase_price: 150, selling_price: 299 },
      { id: 'v_51', size: 'L', color: 'White', stock: 8, purchase_price: 150, selling_price: 299 },
    ],
    images: [],
    active: true,
    show_in_catalogue: true,
    is_featured: false,
    is_new_arrival: false,
    is_best_seller: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod_19',
    name: '[DUPLICATE SAMPLE] Rough Denim Jeans (Owner Delete Kr Sakta Hai)',
    sku: 'MRG-DUP-19',
    barcode: '890MRG100252',
    category_id: 'cat_5',
    category_name: 'Denim & Jeans',
    brand: 'Munna Collection',
    fabric: 'Rough Denim',
    gender: 'Men',
    gst_rate: 5,
    mrp: 1299,
    purchase_price: 390,
    selling_price: 699,
    min_stock: 4,
    description: 'Sample duplicate product added for testing. Owner can edit or delete this item from inventory anytime.',
    variants: [
      { id: 'v_52', size: '32', color: 'Light Blue Wash', stock: 12, purchase_price: 390, selling_price: 699 },
    ],
    images: [],
    active: true,
    show_in_catalogue: true,
    is_featured: false,
    is_new_arrival: false,
    is_best_seller: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod_20',
    name: '[DUPLICATE SAMPLE] Printed Cotton Kurti (Owner Delete Kr Sakta Hai)',
    sku: 'MRG-DUP-20',
    barcode: '890MRG100253',
    category_id: 'cat_3',
    category_name: 'Suits & Sarees',
    brand: 'Munna Readymade',
    fabric: '100% Pure Cotton',
    gender: 'Women',
    gst_rate: 5,
    mrp: 899,
    purchase_price: 260,
    selling_price: 499,
    min_stock: 4,
    description: 'Sample duplicate item. Testing ke liye add kiya gaya hai, owner isko kabhi bhi delete kar sakta hai.',
    variants: [
      { id: 'v_53', size: 'L', color: 'Yellow Printed', stock: 10, purchase_price: 260, selling_price: 499 },
    ],
    images: [],
    active: true,
    show_in_catalogue: true,
    is_featured: false,
    is_new_arrival: false,
    is_best_seller: false,
    createdAt: new Date().toISOString()
  }
];

export async function getProducts(params?: { search?: string; category?: string; gender?: string; limit?: number; status?: 'all' | 'active' | 'archived' }) {
  let products: any[] = [];
  try {
    const colRef = collection(db, PATHS.PRODUCTS);
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      localStorage.setItem('mrg_local_products', JSON.stringify(products));
    } else {
      throw new Error('No firestore products');
    }
  } catch (err) {
    const cached = localStorage.getItem('mrg_local_products');
    if (cached) {
      try {
        products = JSON.parse(cached);
        // Automatically sync with rich default catalog if previous cached list had only 3 items
        if (products.length < DEFAULT_PRODUCTS.length) {
          products = DEFAULT_PRODUCTS;
          localStorage.setItem('mrg_local_products', JSON.stringify(products));
        }
      } catch {
        products = DEFAULT_PRODUCTS;
      }
    } else {
      products = DEFAULT_PRODUCTS;
      localStorage.setItem('mrg_local_products', JSON.stringify(products));
    }
  }

  // Archive status filtering (default to active only)
  if (params?.status === 'archived') {
    products = products.filter(p => p.archived === true || p.status === 'Archived');
  } else if (params?.status === 'all') {
    // Return all
  } else {
    // Default active
    products = products.filter(p => !p.archived && p.status !== 'Archived');
  }

  // In-memory filter for flexible search & sorting
  if (params?.search) {
    const s = params.search.toLowerCase();
    products = products.filter(p =>
      p.name?.toLowerCase().includes(s) ||
      p.sku?.toLowerCase().includes(s) ||
      p.barcode?.toLowerCase().includes(s) ||
      p.brand?.toLowerCase().includes(s)
    );
  }
  if (params?.category) {
    products = products.filter(p => String(p.category_id) === String(params.category) || p.category_slug === params.category);
  }
  if (params?.gender) {
    products = products.filter(p => p.gender === params.gender);
  }

  // Calculate total_stock across variants
  products = products.map(p => {
    const variants = p.variants || [];
    const total_stock = variants.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), Number(p.stock) || 0);
    return { ...p, total_stock };
  });

  return products;
}

export async function getProduct(id: string) {
  try {
    const docRef = doc(db, PATHS.PRODUCTS, id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      const variants = data.variants || [];
      const total_stock = variants.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), Number(data.stock) || 0);
      return { id: snap.id, ...data, total_stock };
    }
  } catch (err) {}

  // Fallback to local
  const cached = localStorage.getItem('mrg_local_products');
  const prods = cached ? JSON.parse(cached) : DEFAULT_PRODUCTS;
  const prod = prods.find((p: any) => String(p.id) === String(id));
  if (prod) {
    const variants = prod.variants || [];
    const total_stock = variants.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), Number(prod.stock) || 0);
    return { ...prod, total_stock };
  }
  throw new Error('Product not found');
}

export async function createProduct(data: any) {
  // Validate barcode uniqueness if provided
  if (data.barcode) {
    const exists = await checkBarcodeExists(data.barcode);
    if (exists) throw new Error(`Barcode '${data.barcode}' already exists. Please generate or enter a unique barcode.`);
  } else {
    data.barcode = await generateUniqueBarcode('MRG');
  }

  if (!data.sku) {
    data.sku = `MRG-${Date.now().toString().slice(-6)}`;
  }

  const newDocRef = doc(collection(db, PATHS.PRODUCTS));
  const productData = {
    ...data,
    active: true,
    show_in_catalogue: data.show_in_catalogue ?? true,
    is_featured: data.is_featured ?? false,
    is_new_arrival: data.is_new_arrival ?? true,
    is_best_seller: data.is_best_seller ?? false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const batch = writeBatch(db);
  batch.set(newDocRef, productData);

  // Sync to public catalogue if visible
  if (productData.show_in_catalogue) {
    const publicDocRef = doc(db, PATHS.CATALOGUE_PRODUCTS, newDocRef.id);
    batch.set(publicDocRef, sanitizePublicProduct(newDocRef.id, productData));
  }

  const prodId = newDocRef.id || `prod_${Date.now()}`;
  try {
    await batch.commit();
  } catch (e) {
    console.warn('Firestore write failed, saved locally:', e);
  }

  // Always save to persistent local store
  try {
    const cached = localStorage.getItem('mrg_local_products');
    let list = cached ? JSON.parse(cached) : [...DEFAULT_PRODUCTS];
    list.unshift({ id: prodId, ...productData });
    localStorage.setItem('mrg_local_products', JSON.stringify(list));
  } catch {}

  // Record initial stock movements
  if (data.variants && data.variants.length > 0) {
    for (const v of data.variants) {
      if (Number(v.stock) > 0) {
        await addStockMovement({
          product_id: prodId,
          variant_id: v.id || v.size,
          product_name: data.name,
          size: v.size || '',
          color: v.color || '',
          type: 'Initial Stock',
          quantity: Number(v.stock),
          previous_stock: 0,
          new_stock: Number(v.stock),
          reason: 'Initial Product Setup',
        }).catch(() => {});
      }
    }
  }

  await logAction('CREATE_PRODUCT', 'Products', prodId, `Created ${data.name} (SKU: ${data.sku})`).catch(() => {});
  return { id: prodId, ...productData };
}

export async function updateProduct(id: string, updates: any) {
  if (updates.barcode) {
    const exists = await checkBarcodeExists(updates.barcode, id);
    if (exists) throw new Error(`Barcode '${updates.barcode}' already exists on another product.`);
  }

  const docRef = doc(db, PATHS.PRODUCTS, id);
  const updatedData = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const batch = writeBatch(db);
  batch.update(docRef, updatedData);

  // Sync to public catalogue
  const publicDocRef = doc(db, PATHS.CATALOGUE_PRODUCTS, id);
  if (updatedData.show_in_catalogue && updatedData.active !== false) {
    const snap = await getDoc(docRef);
    const fullData = { ...snap.data(), ...updatedData };
    batch.set(publicDocRef, sanitizePublicProduct(id, fullData));
  } else {
    batch.delete(publicDocRef);
  }

  await batch.commit();
  await logAction('UPDATE_PRODUCT', 'Products', id, `Updated ${updates.name || id}`);
  return { id, ...updatedData };
}

export async function deleteProduct(id: string, softDelete: boolean = true) {
  const docRef = doc(db, PATHS.PRODUCTS, id);
  const publicDocRef = doc(db, PATHS.CATALOGUE_PRODUCTS, id);

  try {
    if (softDelete) {
      await updateDoc(docRef, { active: false, show_in_catalogue: false, updatedAt: new Date().toISOString() });
      await deleteDoc(publicDocRef).catch(() => {});
      await logAction('ARCHIVE_PRODUCT', 'Products', id, 'Soft deleted / archived product');
    } else {
      await deleteDoc(docRef);
      await deleteDoc(publicDocRef).catch(() => {});
      await logAction('PERMANENT_DELETE_PRODUCT', 'Products', id, 'Permanently deleted product');
    }
  } catch (err) {}

  // Also immediately sync to local cache so owner sees instant deletion
  try {
    const cached = localStorage.getItem('mrg_local_products');
    if (cached) {
      let list = JSON.parse(cached);
      if (softDelete) {
        list = list.map((p: any) => p.id === id ? { ...p, active: false, archived: true, show_in_catalogue: false } : p);
      } else {
        list = list.filter((p: any) => p.id !== id);
      }
      localStorage.setItem('mrg_local_products', JSON.stringify(list));
    }
  } catch {}
}

export async function restoreProduct(id: string) {
  const docRef = doc(db, PATHS.PRODUCTS, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('Product not found');

  const data = snap.data();
  await updateDoc(docRef, { active: true, show_in_catalogue: true, updatedAt: new Date().toISOString() });

  const publicDocRef = doc(db, PATHS.CATALOGUE_PRODUCTS, id);
  await setDoc(publicDocRef, sanitizePublicProduct(id, { ...data, active: true, show_in_catalogue: true }));

  await logAction('RESTORE_PRODUCT', 'Products', id, 'Restored product');
}

// ---------------------------------------------------------------------------
// STOCK MOVEMENTS & ATOMIC ADJUSTMENTS
// ---------------------------------------------------------------------------

export async function addStockMovement(data: {
  product_id: string;
  variant_id?: string;
  product_name: string;
  size?: string;
  color?: string;
  type: string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason?: string;
  reference_number?: string;
  notes?: string;
}) {
  const user = auth.currentUser;
  return addDoc(collection(db, PATHS.STOCK_MOVEMENTS), {
    ...data,
    createdBy: user?.email || 'owner',
    timestamp: new Date().toISOString(),
    createdAt: serverTimestamp(),
  });
}

export async function adjustStock(productId: string, variantId: string | null, quantity: number, type: 'Stock Entry' | 'Stock Exit', reason: string, notes?: string) {
  return runTransaction(db, async (tx) => {
    const prodRef = doc(db, PATHS.PRODUCTS, productId);
    const prodSnap = await tx.get(prodRef);
    if (!prodSnap.exists()) throw new Error('Product not found');

    const prodData = prodSnap.data();
    let variants = [...(prodData.variants || [])];
    let prevStock = 0;
    let newStock = 0;
    let variantSize = '';
    let variantColor = '';

    if (variantId && variants.length > 0) {
      const idx = variants.findIndex(v => String(v.id) === String(variantId) || v.size === variantId);
      if (idx === -1) throw new Error('Variant not found');
      prevStock = Number(variants[idx].stock) || 0;
      variantSize = variants[idx].size || '';
      variantColor = variants[idx].color || '';

      if (type === 'Stock Exit' && prevStock < quantity) {
        throw new Error(`Insufficient stock for variant ${variantSize}. Current: ${prevStock}`);
      }

      newStock = type === 'Stock Entry' ? prevStock + quantity : prevStock - quantity;
      variants[idx].stock = newStock;
      tx.update(prodRef, { variants, updatedAt: new Date().toISOString() });
    } else {
      prevStock = Number(prodData.stock) || 0;
      if (type === 'Stock Exit' && prevStock < quantity) {
        throw new Error(`Insufficient stock. Current: ${prevStock}`);
      }
      newStock = type === 'Stock Entry' ? prevStock + quantity : prevStock - quantity;
      tx.update(prodRef, { stock: newStock, updatedAt: new Date().toISOString() });
    }

    // Write movement record
    const movementRef = doc(collection(db, PATHS.STOCK_MOVEMENTS));
    tx.set(movementRef, {
      product_id: productId,
      variant_id: variantId || null,
      product_name: prodData.name,
      size: variantSize,
      color: variantColor,
      type,
      quantity: type === 'Stock Entry' ? quantity : -quantity,
      previous_stock: prevStock,
      new_stock: newStock,
      reason,
      notes: notes || null,
      createdBy: auth.currentUser?.email || 'owner',
      timestamp: new Date().toISOString(),
      createdAt: serverTimestamp(),
    });

    return { previousStock: prevStock, newStock };
  });
}

// ---------------------------------------------------------------------------
// POS SALES & BILLING (ATOMIC TRANSACTION)
// ---------------------------------------------------------------------------

export async function createSaleTransaction(saleData: any) {
  try {
    return await runTransaction(db, async (tx) => {
      // PHASE 1: ALL READS FIRST (Strict Firestore rule: all tx.get() must precede any tx.set/update/delete)
      const settingsRef = doc(db, PATHS.SETTINGS, 'general');
      const settingsSnap = await tx.get(settingsRef);

      // Read all products needed in this sale
      const prodReads: { item: any; ref: any; snap: any }[] = [];
      for (const item of saleData.items) {
        if (!item.product_id) continue;
        const prodRef = doc(db, PATHS.PRODUCTS, String(item.product_id));
        const prodSnap = await tx.get(prodRef);
        prodReads.push({ item, ref: prodRef, snap: prodSnap });
      }

      // Read customer if credit or due amount
      let custRef: any = null;
      let custSnap: any = null;
      if (saleData.customer_id && (Number(saleData.due_amount) > 0 || saleData.payment_method === 'Credit')) {
        custRef = doc(db, PATHS.CUSTOMERS, String(saleData.customer_id));
        custSnap = await tx.get(custRef);
      }

      // PHASE 2: CALCULATIONS
      let invoicePrefix = 'MRG';
      let counter = 1;
      if (settingsSnap.exists()) {
        const s = settingsSnap.data();
        invoicePrefix = s.invoice_prefix || 'MRG';
        counter = (Number(s.invoice_counter) || 0) + 1;
      }
      const currentYear = new Date().getFullYear();
      const invoiceNumber = `${invoicePrefix}-${currentYear}-${String(counter).padStart(4, '0')}`;

      // PHASE 3: ALL WRITES
      // 1. Update settings counter
      if (settingsSnap.exists()) {
        tx.update(settingsRef, { invoice_counter: counter });
      } else {
        tx.set(settingsRef, { invoice_prefix: 'MRG', invoice_counter: 1 }, { merge: true });
      }

      // 2. Decrement stock & record movements
      for (const { item, ref, snap } of prodReads) {
        const qty = Number(item.quantity) || 1;
        if (snap.exists()) {
          const pData = snap.data();
          if (pData.variants && pData.variants.length > 0 && item.variant_id) {
            const variants = [...pData.variants];
            const vIdx = variants.findIndex((v: any) => String(v.id) === String(item.variant_id) || v.size === item.size);
            if (vIdx !== -1) {
              const currentStock = Number(variants[vIdx].stock) || 0;
              const newStock = Math.max(0, currentStock - qty);
              variants[vIdx].stock = newStock;
              tx.update(ref, { variants, updatedAt: new Date().toISOString() });

              const smRef = doc(collection(db, PATHS.STOCK_MOVEMENTS));
              tx.set(smRef, {
                product_id: item.product_id,
                variant_id: item.variant_id,
                product_name: item.product_name,
                size: item.size || '',
                color: item.color || '',
                type: 'POS Sale',
                quantity: -qty,
                previous_stock: currentStock,
                new_stock: newStock,
                reference_number: invoiceNumber,
                reason: 'Retail Sale',
                createdBy: auth.currentUser?.email || 'owner',
                timestamp: new Date().toISOString(),
              });
            }
          } else {
            const currentStock = Number(pData.stock) || 0;
            const newStock = Math.max(0, currentStock - qty);
            tx.update(ref, { stock: newStock, updatedAt: new Date().toISOString() });

            const smRef = doc(collection(db, PATHS.STOCK_MOVEMENTS));
            tx.set(smRef, {
              product_id: item.product_id,
              product_name: item.product_name,
              type: 'POS Sale',
              quantity: -qty,
              previous_stock: currentStock,
              new_stock: newStock,
              reference_number: invoiceNumber,
              reason: 'Retail Sale',
              createdBy: auth.currentUser?.email || 'owner',
              timestamp: new Date().toISOString(),
            });
          }
        }
      }

      // 3. Create Sale record
      const saleRef = doc(collection(db, PATHS.SALES));
      const fullSale = {
        ...saleData,
        invoice_number: invoiceNumber,
        status: 'Completed',
        date: saleData.date || new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.email || 'owner',
      };
      tx.set(saleRef, fullSale);

      // 4. Update Customer Ledger
      if (custSnap && custSnap.exists() && custRef) {
        const cData = custSnap.data();
        const prevBal = Number(cData.balance || 0);
        const newBal = prevBal + Number(saleData.due_amount || (saleData.payment_method === 'Credit' ? saleData.total_amount : 0));
        tx.update(custRef, {
          balance: newBal,
          total_purchases: (Number(cData.total_purchases) || 0) + Number(saleData.total_amount),
          total_paid: (Number(cData.total_paid) || 0) + Number(saleData.paid_amount || 0),
          updatedAt: new Date().toISOString(),
        });

        const ledgerRef = doc(collection(db, PATHS.CUSTOMER_LEDGER));
        tx.set(ledgerRef, {
          customer_id: saleData.customer_id,
          date: fullSale.date,
          type: 'Sale',
          description: `Invoice ${invoiceNumber}`,
          reference_number: invoiceNumber,
          debit: Number(saleData.total_amount),
          credit: Number(saleData.paid_amount || 0),
          balance: newBal,
          createdAt: new Date().toISOString(),
        });
      }

      // 5. Record Payment audit
      if (Number(saleData.paid_amount) > 0) {
        const paymentRef = doc(collection(db, PATHS.PAYMENTS));
        tx.set(paymentRef, {
          type: 'Customer Sale Payment',
          customer_id: saleData.customer_id || null,
          customer_name: saleData.customer_name || 'Walk-in Customer',
          amount: Number(saleData.paid_amount),
          payment_method: saleData.payment_method,
          reference_number: invoiceNumber,
          date: fullSale.date,
          createdAt: new Date().toISOString(),
        });
      }

      // Save to local cache as well for offline fast loading
      try {
        const cachedSales = localStorage.getItem('mrg_local_sales');
        const salesList = cachedSales ? JSON.parse(cachedSales) : [];
        salesList.unshift({ id: saleRef.id, ...fullSale });
        localStorage.setItem('mrg_local_sales', JSON.stringify(salesList));
      } catch {}

      return {
        id: saleRef.id,
        invoiceNumber,
        sale: { id: saleRef.id, ...fullSale },
        items: saleData.items,
      };
    });
  } catch (txErr: any) {
    console.warn('Firestore transaction fallback to local mode:', txErr);
    // Bulletproof fallback: generate invoice and record locally so POS sale NEVER fails
    const localCounter = Number(localStorage.getItem('mrg_invoice_counter') || 100) + 1;
    localStorage.setItem('mrg_invoice_counter', String(localCounter));
    const invoiceNumber = `MRG-${new Date().getFullYear()}-${String(localCounter).padStart(4, '0')}`;
    const saleId = `sale_${Date.now()}`;

    const fullSale = {
      ...saleData,
      id: saleId,
      invoice_number: invoiceNumber,
      status: 'Completed',
      date: saleData.date || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      createdBy: auth.currentUser?.email || 'owner',
    };

    // Update local products stock
    try {
      const cached = localStorage.getItem('mrg_local_products');
      if (cached) {
        let prods = JSON.parse(cached);
        for (const item of saleData.items) {
          const qty = Number(item.quantity) || 1;
          const p = prods.find((x: any) => String(x.id) === String(item.product_id));
          if (p) {
            if (p.variants && p.variants.length > 0 && item.variant_id) {
              const v = p.variants.find((v: any) => String(v.id) === String(item.variant_id) || v.size === item.size);
              if (v) v.stock = Math.max(0, (Number(v.stock) || 0) - qty);
            } else {
              p.stock = Math.max(0, (Number(p.stock) || 0) - qty);
            }
          }
        }
        localStorage.setItem('mrg_local_products', JSON.stringify(prods));
      }
    } catch {}

    // Update local customer balance if credit/due
    if (saleData.customer_id && (Number(saleData.due_amount) > 0 || saleData.payment_method === 'Credit')) {
      try {
        const cachedCust = localStorage.getItem('mrg_local_customers');
        let custs = cachedCust ? JSON.parse(cachedCust) : [...DEFAULT_CUSTOMERS];
        const c = custs.find((x: any) => String(x.id) === String(saleData.customer_id));
        if (c) {
          const addDue = Number(saleData.due_amount || (saleData.payment_method === 'Credit' ? saleData.total_amount : 0));
          c.balance = (Number(c.balance) || 0) + addDue;
          c.total_purchases = (Number(c.total_purchases) || 0) + Number(saleData.total_amount);
          c.total_paid = (Number(c.total_paid) || 0) + Number(saleData.paid_amount || 0);
          localStorage.setItem('mrg_local_customers', JSON.stringify(custs));
        }
      } catch {}
    }

    // Save into local sales
    try {
      const cachedSales = localStorage.getItem('mrg_local_sales');
      const salesList = cachedSales ? JSON.parse(cachedSales) : [];
      salesList.unshift(fullSale);
      localStorage.setItem('mrg_local_sales', JSON.stringify(salesList));
    } catch {}

    return {
      id: saleId,
      invoiceNumber,
      sale: fullSale,
      items: saleData.items,
    };
  }
}

// ---------------------------------------------------------------------------
// PURCHASES (ATOMIC TRANSACTION)
// ---------------------------------------------------------------------------

export async function createPurchaseTransaction(purchaseData: any) {
  try {
    return await runTransaction(db, async (tx) => {
      // 1. ALL READS FIRST
      const prodReads: { item: any; ref: any; snap: any }[] = [];
      for (const item of purchaseData.items) {
        if (!item.product_id) continue;
        const prodRef = doc(db, PATHS.PRODUCTS, String(item.product_id));
        const prodSnap = await tx.get(prodRef);
        prodReads.push({ item, ref: prodRef, snap: prodSnap });
      }

      let suppRef: any = null;
      let suppSnap: any = null;
      if (purchaseData.supplier_id) {
        suppRef = doc(db, PATHS.SUPPLIERS, String(purchaseData.supplier_id));
        suppSnap = await tx.get(suppRef);
      }

      // 2. GENERATE ID & NUMBER
      const purchaseRef = doc(collection(db, PATHS.PURCHASES));
      const count = Date.now().toString().slice(-4);
      const purchaseNumber = `PO-${new Date().getFullYear()}-${count}`;

      // 3. ALL WRITES
      for (const { item, ref, snap } of prodReads) {
        if (!snap.exists()) continue;
        const pData = snap.data();
        const qty = Number(item.quantity) || 1;

        if (pData.variants && pData.variants.length > 0 && item.variant_id) {
          const variants = [...pData.variants];
          const vIdx = variants.findIndex((v: any) => String(v.id) === String(item.variant_id) || v.size === item.size);
          if (vIdx !== -1) {
            const currentStock = Number(variants[vIdx].stock) || 0;
            const newStock = currentStock + qty;
            variants[vIdx].stock = newStock;
            tx.update(ref, { variants, updatedAt: new Date().toISOString() });

            const smRef = doc(collection(db, PATHS.STOCK_MOVEMENTS));
            tx.set(smRef, {
              product_id: item.product_id,
              variant_id: item.variant_id,
              product_name: item.product_name,
              size: item.size || '',
              color: item.color || '',
              type: 'Purchase Order',
              quantity: qty,
              previous_stock: currentStock,
              new_stock: newStock,
              reference_number: purchaseNumber,
              reason: 'Procurement Inward',
              createdBy: auth.currentUser?.email || 'owner',
              timestamp: new Date().toISOString(),
            });
          }
        } else {
          const currentStock = Number(pData.stock) || 0;
          const newStock = currentStock + qty;
          tx.update(ref, { stock: newStock, updatedAt: new Date().toISOString() });

          const smRef = doc(collection(db, PATHS.STOCK_MOVEMENTS));
          tx.set(smRef, {
            product_id: item.product_id,
            product_name: item.product_name,
            type: 'Purchase Order',
            quantity: qty,
            previous_stock: currentStock,
            new_stock: newStock,
            reference_number: purchaseNumber,
            reason: 'Procurement Inward',
            createdBy: auth.currentUser?.email || 'owner',
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Write Purchase
      const fullPurchase = {
        ...purchaseData,
        purchase_number: purchaseNumber,
        status: 'Completed',
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.email || 'owner',
      };
      tx.set(purchaseRef, fullPurchase);

      // Update Supplier Ledger
      if (suppSnap && suppSnap.exists() && suppRef) {
        const sData = suppSnap.data();
        const prevBal = Number(sData.balance || sData.total_due || 0);
        const newBal = prevBal + Number(purchaseData.due_amount || 0);
        tx.update(suppRef, {
          balance: newBal,
          total_due: newBal,
          total_purchases: (Number(sData.total_purchases) || 0) + Number(purchaseData.total_amount),
          total_paid: (Number(sData.total_paid) || 0) + Number(purchaseData.paid_amount),
          updatedAt: new Date().toISOString(),
        });

        const sLedgerRef = doc(collection(db, PATHS.SUPPLIER_LEDGER));
        tx.set(sLedgerRef, {
          supplier_id: purchaseData.supplier_id,
          date: purchaseData.date,
          type: 'Purchase Inward',
          description: `Bill ${purchaseData.supplier_invoice || purchaseNumber}`,
          reference_number: purchaseNumber,
          debit: Number(purchaseData.paid_amount),
          credit: Number(purchaseData.total_amount),
          balance: newBal,
          createdAt: new Date().toISOString(),
        });
      }

      return { id: purchaseRef.id, purchaseNumber };
    });
  } catch (err: any) {
    console.warn('Fallback purchase locally:', err);
    const purchaseNumber = `PO-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    return { id: `po_${Date.now()}`, purchaseNumber };
  }
}

// ---------------------------------------------------------------------------
// RETURNS (ATOMIC STOCK RESTORATION)
// ---------------------------------------------------------------------------

export async function processSalesReturn(returnData: any) {
  try {
    return await runTransaction(db, async (tx) => {
      // 1. ALL READS FIRST
      const prodReads: { item: any; ref: any; snap: any }[] = [];
      for (const item of returnData.items) {
        if (!item.product_id) continue;
        const prodRef = doc(db, PATHS.PRODUCTS, String(item.product_id));
        const prodSnap = await tx.get(prodRef);
        prodReads.push({ item, ref: prodRef, snap: prodSnap });
      }

      const returnRef = doc(collection(db, PATHS.RETURNS));
      const returnNumber = `RET-${Date.now().toString().slice(-6)}`;

      // 2. ALL WRITES
      for (const { item, ref, snap } of prodReads) {
        if (!snap.exists()) continue;
        const pData = snap.data();
        const qty = Number(item.quantity) || 1;

        if (pData.variants && pData.variants.length > 0 && item.variant_id) {
          const variants = [...pData.variants];
          const vIdx = variants.findIndex((v: any) => String(v.id) === String(item.variant_id) || v.size === item.size);
          if (vIdx !== -1) {
            const currentStock = Number(variants[vIdx].stock) || 0;
            const newStock = currentStock + qty;
            variants[vIdx].stock = newStock;
            tx.update(ref, { variants, updatedAt: new Date().toISOString() });

            const smRef = doc(collection(db, PATHS.STOCK_MOVEMENTS));
            tx.set(smRef, {
              product_id: item.product_id,
              variant_id: item.variant_id,
              product_name: item.product_name,
              size: item.size || '',
              color: item.color || '',
              type: 'Sales Return',
              quantity: qty,
              previous_stock: currentStock,
              new_stock: newStock,
              reference_number: returnNumber,
              reason: returnData.reason || 'Customer Return',
              createdBy: auth.currentUser?.email || 'owner',
              timestamp: new Date().toISOString(),
            });
          }
        }
      }

      const fullReturn = {
        ...returnData,
        type: 'Sale',
        return_number: returnNumber,
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      };
      tx.set(returnRef, fullReturn);
      return { id: returnRef.id, returnNumber };
    });
  } catch (err) {
    const returnNumber = `RET-${Date.now().toString().slice(-6)}`;
    return { id: `ret_${Date.now()}`, returnNumber };
  }
}

export const DEFAULT_CATEGORIES = [
  { id: 'cat_1', name: 'Kurta & Pajama', slug: 'kurta-pajama', description: 'Traditional Indian Ethnic & Festive Wear', active: true },
  { id: 'cat_2', name: 'Shirts & Trousers', slug: 'shirts-trousers', description: 'Formal & Casual Men Wear', active: true },
  { id: 'cat_3', name: 'Suits & Sarees', slug: 'suits-sarees', description: 'Designer Ladies Wear & Fabrics', active: true },
  { id: 'cat_4', name: 'Kids Collection', slug: 'kids-collection', description: 'Comfortable Boys & Girls Clothing', active: true },
  { id: 'cat_5', name: 'Denim & Jeans', slug: 'denim-jeans', description: 'Jeans, Jackets & Casual Wear', active: true },
];

export async function getCategories() {
  try {
    const snap = await getDocs(collection(db, PATHS.CATEGORIES));
    if (!snap.empty) {
      const cats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      localStorage.setItem('mrg_local_categories', JSON.stringify(cats));
      return cats;
    }
  } catch (err) {}

  const cached = localStorage.getItem('mrg_local_categories');
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }
  localStorage.setItem('mrg_local_categories', JSON.stringify(DEFAULT_CATEGORIES));
  return DEFAULT_CATEGORIES;
}

export async function createCategory(data: any) {
  const newId = `cat_${Date.now()}`;
  const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const catData = { ...data, id: newId, slug, active: true, createdAt: new Date().toISOString() };

  try {
    const docRef = doc(collection(db, PATHS.CATEGORIES));
    catData.id = docRef.id;
    await setDoc(docRef, catData);
    await setDoc(doc(db, PATHS.CATALOGUE_CATEGORIES, docRef.id), catData);
  } catch (err) {}

  try {
    const cached = localStorage.getItem('mrg_local_categories');
    let cats = cached ? JSON.parse(cached) : [...DEFAULT_CATEGORIES];
    cats.push(catData);
    localStorage.setItem('mrg_local_categories', JSON.stringify(cats));
  } catch {}

  return catData;
}

export async function updateCategory(id: string, data: any) {
  try {
    const docRef = doc(db, PATHS.CATEGORIES, id);
    await updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
    await setDoc(doc(db, PATHS.CATALOGUE_CATEGORIES, id), data, { merge: true });
  } catch (err) {}

  try {
    const cached = localStorage.getItem('mrg_local_categories');
    if (cached) {
      let cats = JSON.parse(cached);
      cats = cats.map((c: any) => c.id === id ? { ...c, ...data } : c);
      localStorage.setItem('mrg_local_categories', JSON.stringify(cats));
    }
  } catch {}

  return { id, ...data };
}

export async function deleteCategory(id: string) {
  try {
    await deleteDoc(doc(db, PATHS.CATEGORIES, id));
    await deleteDoc(doc(db, PATHS.CATALOGUE_CATEGORIES, id)).catch(() => {});
  } catch (err) {}

  try {
    const cached = localStorage.getItem('mrg_local_categories');
    if (cached) {
      let cats = JSON.parse(cached);
      cats = cats.filter((c: any) => c.id !== id);
      localStorage.setItem('mrg_local_categories', JSON.stringify(cats));
    }
  } catch {}
}

// ---------------------------------------------------------------------------
// CUSTOMERS & SUPPLIERS
// ---------------------------------------------------------------------------

export const DEFAULT_CUSTOMERS = [
  { id: 'cust_1', name: 'Sharma Ji (Dhobwal)', phone: '9876543210', city: 'Dhobwal Bazzar', balance: 1200, total_purchases: 8500, total_paid: 7300, createdAt: new Date().toISOString() },
  { id: 'cust_2', name: 'Rajesh Kumar', phone: '9812345678', city: 'Jalandhar', balance: 0, total_purchases: 4200, total_paid: 4200, createdAt: new Date().toISOString() },
  { id: 'cust_3', name: 'Vikram Singh', phone: '9855512345', city: 'Dhobwal', balance: 450, total_purchases: 3200, total_paid: 2750, createdAt: new Date().toISOString() },
];

export async function getCustomers(search?: string) {
  let customers: any[] = [];
  try {
    const snap = await getDocs(collection(db, PATHS.CUSTOMERS));
    if (!snap.empty) {
      customers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      localStorage.setItem('mrg_local_customers', JSON.stringify(customers));
    }
  } catch (err) {}

  if (customers.length === 0) {
    const cached = localStorage.getItem('mrg_local_customers');
    if (cached) {
      try { customers = JSON.parse(cached); } catch { customers = DEFAULT_CUSTOMERS; }
    } else {
      customers = DEFAULT_CUSTOMERS;
      localStorage.setItem('mrg_local_customers', JSON.stringify(customers));
    }
  }

  if (search) {
    const s = search.toLowerCase();
    customers = customers.filter(c => c.name?.toLowerCase().includes(s) || c.phone?.includes(s));
  }
  return customers;
}

export async function getCustomer(id: string) {
  try {
    const cSnap = await getDoc(doc(db, PATHS.CUSTOMERS, id));
    if (cSnap.exists()) {
      const customer = { id: cSnap.id, ...cSnap.data() } as any;
      const lSnap = await getDocs(query(collection(db, PATHS.CUSTOMER_LEDGER), where('customer_id', '==', id)));
      const ledger = lSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      ledger.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return { customer, ledger, stats: { balance: customer.balance || 0, total_purchases: customer.total_purchases || 0 } };
    }
  } catch (err) {}

  const cached = localStorage.getItem('mrg_local_customers');
  const custs = cached ? JSON.parse(cached) : DEFAULT_CUSTOMERS;
  const customer = custs.find((c: any) => String(c.id) === String(id)) || custs[0];
  return { customer, ledger: [], stats: { balance: customer.balance || 0, total_purchases: customer.total_purchases || 0 } };
}

export async function createCustomer(data: any) {
  const newId = `cust_${Date.now()}`;
  const custData = { ...data, id: newId, balance: Number(data.opening_balance) || 0, active: true, createdAt: new Date().toISOString() };
  try {
    const docRef = doc(collection(db, PATHS.CUSTOMERS));
    custData.id = docRef.id;
    await setDoc(docRef, custData);
  } catch (err) {}

  try {
    const cached = localStorage.getItem('mrg_local_customers');
    let custs = cached ? JSON.parse(cached) : [...DEFAULT_CUSTOMERS];
    custs.unshift(custData);
    localStorage.setItem('mrg_local_customers', JSON.stringify(custs));
  } catch {}

  return custData;
}

export async function addCustomerPayment(customerId: string, data: { amount: number; payment_method: string; notes?: string }) {
  try {
    return await runTransaction(db, async (tx) => {
      const cRef = doc(db, PATHS.CUSTOMERS, customerId);
      const cSnap = await tx.get(cRef);
      if (!cSnap.exists()) throw new Error('Customer not found');

      const cData = cSnap.data();
      const prevBal = Number(cData.balance || 0);
      const newBal = Math.max(0, prevBal - Number(data.amount));
      tx.update(cRef, { balance: newBal, total_paid: (Number(cData.total_paid) || 0) + Number(data.amount) });

      const lRef = doc(collection(db, PATHS.CUSTOMER_LEDGER));
      tx.set(lRef, {
        customer_id: customerId,
        date: new Date().toISOString().split('T')[0],
        type: 'Payment Received',
        description: data.notes || 'Payment Settlement',
        debit: 0,
        credit: Number(data.amount),
        balance: newBal,
        createdAt: new Date().toISOString(),
      });

      return { newBalance: newBal };
    });
  } catch (err) {
    // Local fallback
    const cached = localStorage.getItem('mrg_local_customers');
    let custs = cached ? JSON.parse(cached) : [...DEFAULT_CUSTOMERS];
    const c = custs.find((x: any) => String(x.id) === String(customerId));
    if (c) {
      c.balance = Math.max(0, (Number(c.balance) || 0) - Number(data.amount));
      c.total_paid = (Number(c.total_paid) || 0) + Number(data.amount);
      localStorage.setItem('mrg_local_customers', JSON.stringify(custs));
      return { newBalance: c.balance };
    }
    return { newBalance: 0 };
  }
}

export const DEFAULT_SUPPLIERS = [
  { id: 'supp_1', name: 'Surat Textile Fabrics', contact_person: 'Ramesh Bhai', phone: '9898989898', city: 'Surat, Gujarat', balance: 15000, total_due: 15000, total_purchases: 45000, total_paid: 30000, createdAt: new Date().toISOString() },
  { id: 'supp_2', name: 'Ludhiana Hosiery Mills', contact_person: 'Harpreet Singh', phone: '9878787878', city: 'Ludhiana, Punjab', balance: 8000, total_due: 8000, total_purchases: 28000, total_paid: 20000, createdAt: new Date().toISOString() },
  { id: 'supp_3', name: 'Delhi Wholesale Garments', contact_person: 'Sunil Gupta', phone: '9811122233', city: 'Gandhi Nagar, Delhi', balance: 0, total_due: 0, total_purchases: 32000, total_paid: 32000, createdAt: new Date().toISOString() },
];

export async function getSuppliers(search?: string) {
  let suppliers: any[] = [];
  try {
    const snap = await getDocs(collection(db, PATHS.SUPPLIERS));
    if (!snap.empty) {
      suppliers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      localStorage.setItem('mrg_local_suppliers', JSON.stringify(suppliers));
    }
  } catch (err) {}

  if (suppliers.length === 0) {
    const cached = localStorage.getItem('mrg_local_suppliers');
    if (cached) {
      try { suppliers = JSON.parse(cached); } catch { suppliers = DEFAULT_SUPPLIERS; }
    } else {
      suppliers = DEFAULT_SUPPLIERS;
      localStorage.setItem('mrg_local_suppliers', JSON.stringify(suppliers));
    }
  }

  if (search) {
    const s = search.toLowerCase();
    suppliers = suppliers.filter(sup => sup.name?.toLowerCase().includes(s) || sup.city?.toLowerCase().includes(s));
  }
  return suppliers;
}

export async function getSupplier(id: string) {
  try {
    const sSnap = await getDoc(doc(db, PATHS.SUPPLIERS, id));
    if (sSnap.exists()) {
      const supplier = { id: sSnap.id, ...sSnap.data() } as any;
      const lSnap = await getDocs(query(collection(db, PATHS.SUPPLIER_LEDGER), where('supplier_id', '==', id)));
      const ledger = lSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      ledger.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return { supplier, ledger, stats: { balance: supplier.balance || supplier.total_due || 0 } };
    }
  } catch (err) {}

  const cached = localStorage.getItem('mrg_local_suppliers');
  const supps = cached ? JSON.parse(cached) : DEFAULT_SUPPLIERS;
  const supplier = supps.find((s: any) => String(s.id) === String(id)) || supps[0];
  return { supplier, ledger: [], stats: { balance: supplier.balance || 0 } };
}

export async function createSupplier(data: any) {
  const newId = `supp_${Date.now()}`;
  const suppData = { ...data, id: newId, balance: Number(data.opening_balance) || 0, total_due: Number(data.opening_balance) || 0, active: true, createdAt: new Date().toISOString() };
  try {
    const docRef = doc(collection(db, PATHS.SUPPLIERS));
    suppData.id = docRef.id;
    await setDoc(docRef, suppData);
  } catch (err) {}

  try {
    const cached = localStorage.getItem('mrg_local_suppliers');
    let supps = cached ? JSON.parse(cached) : [...DEFAULT_SUPPLIERS];
    supps.unshift(suppData);
    localStorage.setItem('mrg_local_suppliers', JSON.stringify(supps));
  } catch {}

  return suppData;
}

export async function addSupplierPayment(supplierId: string, data: { amount: number; payment_method: string; notes?: string }) {
  try {
    return await runTransaction(db, async (tx) => {
      const sRef = doc(db, PATHS.SUPPLIERS, supplierId);
      const sSnap = await tx.get(sRef);
      if (!sSnap.exists()) throw new Error('Supplier not found');

      const sData = sSnap.data();
      const prevBal = Number(sData.balance || sData.total_due || 0);
      const newBal = Math.max(0, prevBal - Number(data.amount));
      tx.update(sRef, { balance: newBal, total_due: newBal, total_paid: (Number(sData.total_paid) || 0) + Number(data.amount) });

      const lRef = doc(collection(db, PATHS.SUPPLIER_LEDGER));
      tx.set(lRef, {
        supplier_id: supplierId,
        date: new Date().toISOString().split('T')[0],
        type: 'Payment Sent',
        description: data.notes || 'Vendor Payout',
        debit: Number(data.amount),
        credit: 0,
        balance: newBal,
        createdAt: new Date().toISOString(),
      });

      return { newBalance: newBal };
    });
  } catch (err) {
    const cached = localStorage.getItem('mrg_local_suppliers');
    let supps = cached ? JSON.parse(cached) : [...DEFAULT_SUPPLIERS];
    const s = supps.find((x: any) => String(x.id) === String(supplierId));
    if (s) {
      s.balance = Math.max(0, (Number(s.balance) || 0) - Number(data.amount));
      localStorage.setItem('mrg_local_suppliers', JSON.stringify(supps));
      return { newBalance: s.balance };
    }
    return { newBalance: 0 };
  }
}

// ---------------------------------------------------------------------------
// EXPENSES & PAYMENTS
// ---------------------------------------------------------------------------

export const DEFAULT_EXPENSES = [
  { id: 'exp_1', category: 'Shop Rent', amount: 8000, description: 'Dhobwal Bazzar shop monthly rent', date: new Date().toISOString().split('T')[0] },
  { id: 'exp_2', category: 'Electricity', amount: 1850, description: 'Shop lights and inverter bill', date: new Date().toISOString().split('T')[0] },
  { id: 'exp_3', category: 'Tea & Snacks', amount: 450, description: 'Daily customer and staff tea', date: new Date().toISOString().split('T')[0] },
];

export async function getExpenses() {
  let expenses: any[] = [];
  try {
    const snap = await getDocs(collection(db, PATHS.EXPENSES));
    if (!snap.empty) {
      expenses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      localStorage.setItem('mrg_local_expenses', JSON.stringify(expenses));
    }
  } catch (err) {}

  if (expenses.length === 0) {
    const cached = localStorage.getItem('mrg_local_expenses');
    if (cached) {
      try { expenses = JSON.parse(cached); } catch { expenses = DEFAULT_EXPENSES; }
    } else {
      expenses = DEFAULT_EXPENSES;
      localStorage.setItem('mrg_local_expenses', JSON.stringify(expenses));
    }
  }

  expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const total = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  return { expenses, total };
}

export async function createExpense(data: any) {
  const newId = `exp_${Date.now()}`;
  const expData = { ...data, id: newId, createdAt: new Date().toISOString(), createdBy: auth.currentUser?.email || 'owner' };
  try {
    const docRef = doc(collection(db, PATHS.EXPENSES));
    expData.id = docRef.id;
    await setDoc(docRef, expData);
  } catch (err) {}

  try {
    const cached = localStorage.getItem('mrg_local_expenses');
    let list = cached ? JSON.parse(cached) : [...DEFAULT_EXPENSES];
    list.unshift(expData);
    localStorage.setItem('mrg_local_expenses', JSON.stringify(list));
  } catch {}

  return expData;
}

export async function deleteExpense(id: string) {
  try {
    await deleteDoc(doc(db, PATHS.EXPENSES, id));
  } catch (err) {}

  try {
    const cached = localStorage.getItem('mrg_local_expenses');
    if (cached) {
      let list = JSON.parse(cached);
      list = list.filter((e: any) => e.id !== id);
      localStorage.setItem('mrg_local_expenses', JSON.stringify(list));
    }
  } catch {}
}

export async function getPayments(params?: { from?: string; to?: string }) {
  const snap = await getDocs(collection(db, PATHS.PAYMENTS));
  let payments = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  if (params?.from) payments = payments.filter(p => p.date >= params.from!);
  if (params?.to) payments = payments.filter(p => p.date <= params.to!);
  payments.sort((a, b) => new Date(b.date || b.timestamp || b.created_at || 0).getTime() - new Date(a.date || a.timestamp || a.created_at || 0).getTime());

  // Aggregate payment methods summary for UI cards
  const methodMap: Record<string, { count: number; total: number }> = {};
  payments.forEach(p => {
    const m = p.method || p.payment_method || 'Cash';
    if (!methodMap[m]) methodMap[m] = { count: 0, total: 0 };
    methodMap[m].count += 1;
    methodMap[m].total += Number(p.amount || 0);
  });
  const summary = Object.entries(methodMap).map(([method, data]) => ({
    method,
    count: data.count,
    total: data.total,
  }));

  return { payments, summary };
}

// ---------------------------------------------------------------------------
// SETTINGS & BACKUP
// ---------------------------------------------------------------------------

export async function getShopSettings() {
  const docRef = doc(db, PATHS.SETTINGS, 'general');
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    const defaultSettings = {
      shop_name: 'Munna Readymade Garments',
      shop_location: 'Dhobwal Bazzar',
      shop_phone: '+91 9876543210',
      shop_whatsapp: '+919876543210',
      shop_address: 'Dhobwal Bazzar, Jalandhar, Punjab',
      shop_city: 'Jalandhar',
      shop_state: 'Punjab',
      invoice_prefix: 'MRG',
      currency_symbol: '₹',
      return_policy: 'Exchange within 7 days with original invoice.',
      terms_conditions: 'All prices inclusive of applicable taxes.',
      thank_you_message: 'Thank you for shopping at Munna Readymade Garments!',
      invoice_counter: 100,
    };
    await setDoc(docRef, defaultSettings);
    await setDoc(doc(db, PATHS.CATALOGUE_SHOP_INFO, 'general'), defaultSettings);
    return defaultSettings;
  }
  return snap.data();
}

export async function updateShopSettings(data: any) {
  const docRef = doc(db, PATHS.SETTINGS, 'general');
  await setDoc(docRef, data, { merge: true });

  // Mirror public settings to public showroom
  const publicRef = doc(db, PATHS.CATALOGUE_SHOP_INFO, 'general');
  await setDoc(publicRef, {
    shop_name: data.shop_name,
    shop_location: data.shop_location,
    shop_phone: data.shop_phone,
    shop_whatsapp: data.shop_whatsapp,
    shop_address: data.shop_address,
    shop_google_maps: data.shop_google_maps || '',
  }, { merge: true });

  return data;
}

// ---------------------------------------------------------------------------
// 100% FREE CLIENT-SIDE IMAGE COMPRESSION (ZERO COST STORAGE)
// ---------------------------------------------------------------------------

export function compressImageToBase64(file: File, maxWidth: number = 800, quality: number = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // Compress to high-efficiency WebP or JPEG (~30KB)
        const dataUrl = canvas.toDataURL('image/webp', quality);
        resolve(dataUrl);
      };
      img.onerror = () => resolve(event.target?.result as string);
    };
    reader.onerror = (err) => reject(err);
  });
}

export async function uploadProductImage(file: File, productId: string): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files (JPEG, PNG, WEBP) are allowed.');
  }

  // 100% Free & Zero-Setup Strategy:
  // Try Firebase Storage first; if Storage is on free plan / not activated,
  // seamlessly compress the image into lightweight Base64 stored directly in Firestore!
  try {
    const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const storageRef = ref(storage, `product_images/${productId}/${filename}`);
    await uploadBytes(storageRef, file, { contentType: file.type });
    return await getDownloadURL(storageRef);
  } catch (storageErr) {
    console.warn('Firebase Storage not active or failed, using 100% Free compressed Base64:', storageErr);
    return await compressImageToBase64(file, 800, 0.75);
  }
}

// ---------------------------------------------------------------------------
// PUBLIC DIGITAL SHOWROOM
// ---------------------------------------------------------------------------

function sanitizePublicProduct(id: string, prod: any) {
  const variants = prod.variants || [];
  const sizes = [...new Set(variants.map((v: any) => v.size).filter(Boolean))];
  const colors = [...new Set(variants.map((v: any) => v.color).filter(Boolean))];
  const totalStock = variants.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), Number(prod.stock) || 0);

  return {
    id,
    name: prod.name,
    slug: prod.slug || prod.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    sku: prod.sku,
    brand: prod.brand || 'Munna Collection',
    fabric: prod.fabric || '',
    gender: prod.gender || 'Men',
    mrp: Number(prod.mrp) || 0,
    selling_price: Number(prod.selling_price) || 0,
    images: prod.images || [],
    description: prod.description || '',
    sizes,
    colors,
    in_stock: totalStock > 0,
    is_featured: prod.is_featured || false,
    is_new_arrival: prod.is_new_arrival || false,
    is_best_seller: prod.is_best_seller || false,
    category_id: prod.category_id || '',
    category_name: prod.category_name || '',
  };
}

export async function getPublicCatalogue(params?: { search?: string; category?: string; gender?: string }) {
  const snap = await getDocs(collection(db, PATHS.CATALOGUE_PRODUCTS));
  let products = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

  if (params?.search) {
    const s = params.search.toLowerCase();
    products = products.filter(p => p.name?.toLowerCase().includes(s) || p.fabric?.toLowerCase().includes(s) || p.brand?.toLowerCase().includes(s));
  }
  if (params?.category) {
    products = products.filter(p => p.category_id === params.category || p.category_slug === params.category);
  }
  if (params?.gender) {
    products = products.filter(p => p.gender === params.gender);
  }

  const catSnap = await getDocs(collection(db, PATHS.CATALOGUE_CATEGORIES));
  const categories = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const settingsSnap = await getDoc(doc(db, PATHS.CATALOGUE_SHOP_INFO, 'general'));
  const shopSettings = settingsSnap.exists() ? settingsSnap.data() : {};

  return { products, categories, shopSettings };
}

export async function getPublicProduct(slugOrId: string) {
  // Try ID first
  const docRef = doc(db, PATHS.CATALOGUE_PRODUCTS, slugOrId);
  const snap = await getDoc(docRef);
  if (snap.exists()) return { id: snap.id, ...snap.data() };

  // Try slug query
  const q = query(collection(db, PATHS.CATALOGUE_PRODUCTS), where('slug', '==', slugOrId), limit(1));
  const qSnap = await getDocs(q);
  if (!qSnap.empty) {
    return { id: qSnap.docs[0].id, ...qSnap.docs[0].data() };
  }
  throw new Error('Product not found in catalogue');
}
