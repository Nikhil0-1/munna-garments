import * as dbService from '../services/db';
import * as authService from '../services/auth';
import * as excelService from '../services/excel';
import { collection, getDocs, doc, getDoc, setDoc, query, orderBy, limit, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

// Helper for matching Axios response structure { data: ... }
const wrap = <T>(data: T) => Promise.resolve({ data });

// ---------------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------------
export const authApi = {
  login: async (creds: { username?: string; email?: string; password: string }) => {
    const email = creds.email || creds.username || '';
    const owner = await authService.signInOwner(email, creds.password);
    return wrap({ user: owner, token: owner.uid });
  },
  setupInitial: async (creds: { email: string; password: string; name?: string }) => {
    const owner = await authService.setupInitialOwner(creds.email, creds.password, creds.name);
    return wrap({ user: owner, token: owner.uid });
  },
  isInitialized: async () => {
    const initialized = await authService.isOwnerInitialized();
    return wrap({ initialized });
  },
  me: async () => {
    // Current user lookup
    return wrap({ user: { role: 'owner', name: 'Shop Owner' } });
  },
  changePassword: async (data: { newPassword: string; currentPassword?: string }) => {
    await authService.changeOwnerPassword(data.newPassword, data.currentPassword);
    return wrap({ success: true });
  },
  generateSecure: async () => {
    const creds = authService.generateAutoSecureCredentials();
    return wrap(creds);
  },
};

// ---------------------------------------------------------------------------
// DASHBOARD (REAL CLOUD FIRESTORE AGGREGATION)
// ---------------------------------------------------------------------------
export const dashboardApi = {
  get: async () => {
    const [salesSnap, prods, custs, supps] = await Promise.all([
      getDocs(collection(db, dbService.PATHS.SALES)),
      dbService.getProducts(),
      dbService.getCustomers(),
      dbService.getSuppliers(),
    ]);

    const sales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    sales.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());

    const todayStr = new Date().toISOString().split('T')[0];
    const todaySales = sales.filter(s => s.date === todayStr);

    const todayRevenue = todaySales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
    const todayProfit = todaySales.reduce((sum, s) => {
      // Estimate 25% average garment gross margin if not itemized
      const cost = s.items?.reduce((c: number, it: any) => c + ((Number(it.purchase_price) || Number(it.selling_price) * 0.7) * (Number(it.quantity) || 1)), 0);
      return sum + (s.total_amount - (cost || s.total_amount * 0.7));
    }, 0);

    const stockCount = prods.reduce((sum, p) => sum + (Number(p.total_stock) || 0), 0);
    const stockValue = prods.reduce((sum, p) => sum + ((Number(p.selling_price) || 0) * (Number(p.total_stock) || 0)), 0);

    const receivables = custs.reduce((sum, c) => sum + (Number(c.balance) || 0), 0);
    const payables = supps.reduce((sum, s) => sum + (Number(s.balance || s.total_due) || 0), 0);

    const lowStockProducts = prods.filter(p => Number(p.total_stock) <= (Number(p.min_stock) || 5));

    // Daily sales last 14 days
    const dailyMap: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = d.toISOString().split('T')[0];
      dailyMap[k] = 0;
    }
    sales.forEach(s => {
      if (s.date && dailyMap[s.date] !== undefined) {
        dailyMap[s.date] += Number(s.total_amount) || 0;
      }
    });
    const dailySales = Object.entries(dailyMap).map(([date, revenue]) => ({ date, revenue }));

    // Payment methods
    const payMap: Record<string, number> = {};
    sales.forEach(s => {
      const m = s.payment_method || 'Cash';
      payMap[m] = (payMap[m] || 0) + (Number(s.total_amount) || 0);
    });
    const paymentBreakdown = Object.entries(payMap).map(([payment_method, amount]) => ({ payment_method, amount }));

    // Category sales
    const catMap: Record<string, number> = {};
    sales.forEach(s => {
      s.items?.forEach((it: any) => {
        const cat = it.category_name || 'Apparel';
        catMap[cat] = (catMap[cat] || 0) + (Number(it.total_amount) || Number(it.selling_price) * Number(it.quantity) || 0);
      });
    });
    const categorySales = Object.entries(catMap).map(([category, revenue]) => ({ category, revenue }));

    // Top products
    const prodMap: Record<string, { total_qty: number; product_name: string }> = {};
    sales.forEach(s => {
      s.items?.forEach((it: any) => {
        const name = it.product_name || 'Garment';
        if (!prodMap[name]) prodMap[name] = { total_qty: 0, product_name: name };
        prodMap[name].total_qty += Number(it.quantity) || 1;
      });
    });
    const topProducts = Object.values(prodMap).sort((a, b) => b.total_qty - a.total_qty).slice(0, 5);

    return wrap({
      today: {
        revenue: Math.round(todayRevenue),
        profit: Math.round(todayProfit),
        sales: todaySales.length,
      },
      stock: {
        count: stockCount,
        value: Math.round(stockValue),
      },
      customers: custs.length,
      receivables: Math.round(receivables),
      payables: Math.round(payables),
      lowStockCount: lowStockProducts.length,
      lowStockProducts: lowStockProducts.slice(0, 8),
      recentSales: sales.slice(0, 8),
      charts: {
        dailySales,
        paymentBreakdown,
        categorySales,
        topProducts,
      },
    });
  },
};

// ---------------------------------------------------------------------------
// SETTINGS
// ---------------------------------------------------------------------------
export const settingsApi = {
  get: async () => wrap(await dbService.getShopSettings()),
  update: async (data: any) => wrap(await dbService.updateShopSettings(data)),
};

// ---------------------------------------------------------------------------
// PRODUCTS
// ---------------------------------------------------------------------------
export const productsApi = {
  list: async (params?: any) => {
    const products = await dbService.getProducts(params);
    return wrap({
      products,
      pagination: { total: products.length, pages: 1, page: 1, limit: products.length },
    });
  },
  search: async (q: string) => {
    const products = await dbService.getProducts({ search: q });
    return wrap(products);
  },
  get: async (id: string | number) => wrap(await dbService.getProduct(String(id))),
  create: async (data: any) => wrap(await dbService.createProduct(data)),
  update: async (id: string | number, data: any) => wrap(await dbService.updateProduct(String(id), data)),
  delete: async (id: string | number) => {
    await dbService.deleteProduct(String(id), true);
    return wrap({ success: true });
  },
  deletePermanent: async (id: string | number) => {
    await dbService.deleteProduct(String(id), false);
    return wrap({ success: true });
  },
  reloadSampleStock: async () => {
    localStorage.setItem('mrg_local_products', JSON.stringify(dbService.DEFAULT_PRODUCTS));
    return wrap({ success: true, count: dbService.DEFAULT_PRODUCTS.length });
  },
  restore: async (id: string | number) => {
    await dbService.restoreProduct(String(id));
    return wrap({ success: true });
  },
  adjustStock: async (id: string | number, data: any) => {
    const res = await dbService.adjustStock(String(id), data.variant_id, Number(data.quantity), data.type, data.reason, data.notes);
    return wrap(res);
  },
  lowStock: async () => {
    const prods = await dbService.getProducts();
    const lowStock = prods.filter(p => Number(p.total_stock) <= (Number(p.min_stock) || 5));
    return wrap({ lowStock });
  },
  ledger: async (id: string | number) => {
    const snap = await getDocs(query(collection(db, dbService.PATHS.STOCK_MOVEMENTS)));
    let movements = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    movements = movements.filter(m => String(m.product_id) === String(id));
    movements.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return wrap({ movements });
  },
  allMovements: async (search?: string) => {
    const snap = await getDocs(query(collection(db, dbService.PATHS.STOCK_MOVEMENTS)));
    let movements = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    if (search) {
      const s = search.toLowerCase();
      movements = movements.filter(m =>
        m.product_name?.toLowerCase().includes(s) ||
        m.type?.toLowerCase().includes(s) ||
        m.reason?.toLowerCase().includes(s) ||
        m.reference_number?.toLowerCase().includes(s)
      );
    }
    movements.sort((a, b) => new Date(b.timestamp || b.created_at || 0).getTime() - new Date(a.timestamp || a.created_at || 0).getTime());
    return wrap({ movements });
  },
  uploadImage: async (file: File, productId: string) => {
    const url = await dbService.uploadProductImage(file, productId);
    return wrap({ url });
  },
  generateBarcode: async (prefix?: string) => {
    const barcode = await dbService.generateUniqueBarcode(prefix || 'MRG');
    return wrap({ barcode });
  },
  checkBarcode: async (barcode: string, excludeId?: string) => {
    const exists = await dbService.checkBarcodeExists(barcode, excludeId);
    return wrap({ exists });
  },
};

// ---------------------------------------------------------------------------
// CATEGORIES
// ---------------------------------------------------------------------------
export const categoriesApi = {
  list: async () => wrap(await dbService.getCategories()),
  create: async (data: any) => wrap(await dbService.createCategory(data)),
  update: async (id: string | number, data: any) => wrap(await dbService.updateCategory(String(id), data)),
  delete: async (id: string | number) => {
    await dbService.deleteCategory(String(id));
    return wrap({ success: true });
  },
};

// ---------------------------------------------------------------------------
// SALES
// ---------------------------------------------------------------------------
export const salesApi = {
  list: async (params?: any) => {
    const snap = await getDocs(collection(db, dbService.PATHS.SALES));
    let sales = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    if (params?.search) {
      const s = params.search.toLowerCase();
      sales = sales.filter(sale => sale.invoice_number?.toLowerCase().includes(s) || sale.customer_name?.toLowerCase().includes(s));
    }
    if (params?.status) sales = sales.filter(s => s.status === params.status);
    if (params?.from) sales = sales.filter(s => s.date >= params.from);
    if (params?.to) sales = sales.filter(s => s.date <= params.to);
    sales.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());

    return wrap({ sales, pagination: { total: sales.length, pages: 1, page: 1, limit: sales.length } });
  },
  get: async (id: string | number) => {
    const snap = await getDoc(doc(db, dbService.PATHS.SALES, String(id)));
    if (!snap.exists()) throw new Error('Sale not found');
    const sale = { id: snap.id, ...snap.data() } as any;
    return wrap({ sale, items: sale.items || [] });
  },
  create: async (data: any) => wrap(await dbService.createSaleTransaction(data)),
  cancel: async (id: string | number) => {
    await updateDoc(doc(db, dbService.PATHS.SALES, String(id)), { status: 'Cancelled' });
    return wrap({ success: true });
  },
};

// ---------------------------------------------------------------------------
// PURCHASES
// ---------------------------------------------------------------------------
export const purchasesApi = {
  list: async (params?: any) => {
    const snap = await getDocs(collection(db, dbService.PATHS.PURCHASES));
    let purchases = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    if (params?.search) {
      const s = params.search.toLowerCase();
      purchases = purchases.filter(p => p.purchase_number?.toLowerCase().includes(s) || p.supplier_name?.toLowerCase().includes(s));
    }
    purchases.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
    return wrap({ purchases, pagination: { total: purchases.length, pages: 1, page: 1, limit: purchases.length } });
  },
  get: async (id: string | number) => {
    const snap = await getDoc(doc(db, dbService.PATHS.PURCHASES, String(id)));
    return wrap(snap.data());
  },
  create: async (data: any) => wrap(await dbService.createPurchaseTransaction(data)),
};

// ---------------------------------------------------------------------------
// CUSTOMERS
// ---------------------------------------------------------------------------
export const customersApi = {
  list: async (params?: any) => {
    const customers = await dbService.getCustomers(params?.search);
    return wrap({ customers, pagination: { total: customers.length, pages: 1, page: 1, limit: customers.length } });
  },
  get: async (id: string | number) => wrap(await dbService.getCustomer(String(id))),
  create: async (data: any) => wrap(await dbService.createCustomer(data)),
  update: async (id: string | number, data: any) => {
    await updateDoc(doc(db, dbService.PATHS.CUSTOMERS, String(id)), data);
    return wrap({ id, ...data });
  },
  delete: async (id: string | number) => {
    await deleteDoc(doc(db, dbService.PATHS.CUSTOMERS, String(id)));
    return wrap({ success: true });
  },
  addPayment: async (id: string | number, data: any) => wrap(await dbService.addCustomerPayment(String(id), data)),
};

// ---------------------------------------------------------------------------
// SUPPLIERS
// ---------------------------------------------------------------------------
export const suppliersApi = {
  list: async (params?: any) => {
    const suppliers = await dbService.getSuppliers(params?.search);
    return wrap({ suppliers, pagination: { total: suppliers.length, pages: 1, page: 1, limit: suppliers.length } });
  },
  get: async (id: string | number) => wrap(await dbService.getSupplier(String(id))),
  create: async (data: any) => wrap(await dbService.createSupplier(data)),
  update: async (id: string | number, data: any) => {
    await updateDoc(doc(db, dbService.PATHS.SUPPLIERS, String(id)), data);
    return wrap({ id, ...data });
  },
  delete: async (id: string | number) => {
    await deleteDoc(doc(db, dbService.PATHS.SUPPLIERS, String(id)));
    return wrap({ success: true });
  },
  addPayment: async (id: string | number, data: any) => wrap(await dbService.addSupplierPayment(String(id), data)),
};

// ---------------------------------------------------------------------------
// EXPENSES
// ---------------------------------------------------------------------------
export const expensesApi = {
  list: async () => wrap(await dbService.getExpenses()),
  create: async (data: any) => wrap(await dbService.createExpense(data)),
  delete: async (id: string | number) => {
    await dbService.deleteExpense(String(id));
    return wrap({ success: true });
  },
};

// ---------------------------------------------------------------------------
// RETURNS
// ---------------------------------------------------------------------------
export const returnsApi = {
  list: async (params?: any) => {
    const snap = await getDocs(collection(db, dbService.PATHS.RETURNS));
    let returns = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    if (params?.type) returns = returns.filter(r => r.type === params.type);
    returns.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
    return wrap({ returns });
  },
  createSalesReturn: async (data: any) => wrap(await dbService.processSalesReturn(data)),
};

// ---------------------------------------------------------------------------
// STOCK (INWARD / OUTWARD)
// ---------------------------------------------------------------------------
export const stockApi = {
  entry: async (data: { product_id: string | number; variant_id?: any; quantity: number; reason: string; notes?: string }) => {
    return wrap(await dbService.adjustStock(String(data.product_id), data.variant_id, Number(data.quantity), 'Stock Entry', data.reason, data.notes));
  },
  exit: async (data: { product_id: string | number; variant_id?: any; quantity: number; reason: string; notes?: string }) => {
    return wrap(await dbService.adjustStock(String(data.product_id), data.variant_id, Number(data.quantity), 'Stock Exit', data.reason, data.notes));
  },
};

// ---------------------------------------------------------------------------
// REPORTS
// ---------------------------------------------------------------------------
export const reportsApi = {
  sales: async (params?: any) => {
    const snap = await getDocs(collection(db, dbService.PATHS.SALES));
    let sales = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    if (params?.from) sales = sales.filter(s => s.date >= params.from);
    if (params?.to) sales = sales.filter(s => s.date <= params.to);

    const revenue = sales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
    const profit = Math.round(revenue * 0.28);
    const collected = sales.reduce((sum, s) => sum + (Number(s.paid_amount) || 0), 0);
    const due = sales.reduce((sum, s) => sum + (Number(s.due_amount) || 0), 0);

    const topMap: Record<string, { qty: number; revenue: number; profit: number; product_name: string }> = {};
    sales.forEach(s => {
      s.items?.forEach((it: any) => {
        const name = it.product_name || 'Apparel';
        if (!topMap[name]) topMap[name] = { qty: 0, revenue: 0, profit: 0, product_name: name };
        const q = Number(it.quantity) || 1;
        const rev = Number(it.total_amount) || Number(it.selling_price) * q;
        topMap[name].qty += q;
        topMap[name].revenue += rev;
        topMap[name].profit += Math.round(rev * 0.28);
      });
    });

    return wrap({
      totals: { revenue, profit, collected, due },
      topProducts: Object.values(topMap).sort((a, b) => b.qty - a.qty).slice(0, 10),
    });
  },
  inventory: async () => {
    const prods = await dbService.getProducts();
    const totalValue = prods.reduce((sum, p) => sum + ((Number(p.selling_price) || 0) * (Number(p.total_stock) || 0)), 0);
    const lowStock = prods.filter(p => Number(p.total_stock) <= (Number(p.min_stock) || 5) && Number(p.total_stock) > 0);
    const outOfStock = prods.filter(p => Number(p.total_stock) === 0);

    const stockSummary = prods.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category_name || 'General',
      current_stock: p.total_stock,
      selling_price: p.selling_price,
      stock_value: Math.round((Number(p.selling_price) || 0) * (Number(p.total_stock) || 0)),
    }));

    return wrap({ totalValue: Math.round(totalValue), lowStock, outOfStock, stockSummary });
  },
  finance: async (params?: any) => {
    const [salesSnap, { expenses }] = await Promise.all([
      getDocs(collection(db, dbService.PATHS.SALES)),
      dbService.getExpenses(),
    ]);

    let sales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    if (params?.from) sales = sales.filter(s => s.date >= params.from);
    if (params?.to) sales = sales.filter(s => s.date <= params.to);

    const revenue = sales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
    const grossProfit = Math.round(revenue * 0.28);
    const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const netProfit = grossProfit - totalExpenses;

    const catMap: Record<string, number> = {};
    expenses.forEach(e => {
      catMap[e.category] = (catMap[e.category] || 0) + (Number(e.amount) || 0);
    });
    const expenseByCategory = Object.entries(catMap).map(([category, total]) => ({ category, total }));

    return wrap({ revenue, grossProfit, expenses: totalExpenses, netProfit, expenseByCategory });
  },
  payments: async (params?: any) => wrap(await dbService.getPayments(params)),
  activity: async () => {
    const snap = await getDocs(query(collection(db, dbService.PATHS.AUDIT_LOGS), orderBy('timestamp', 'desc'), limit(50)));
    const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return wrap({ logs });
  },
};

// ---------------------------------------------------------------------------
// EXCEL EXPORTS (CLIENT-SIDE)
// ---------------------------------------------------------------------------
export const exportApi = {
  sales: async (params?: any) => {
    await excelService.exportSalesToExcel(params?.from, params?.to);
    return wrap(new Blob());
  },
  products: async () => {
    await excelService.exportProductsToExcel();
    return wrap(new Blob());
  },
  stock: async () => {
    await excelService.exportStockLedgerToExcel();
    return wrap(new Blob());
  },
  customers: async () => {
    await excelService.exportCustomersToExcel();
    return wrap(new Blob());
  },
  expenses: async () => {
    await excelService.exportExpensesToExcel();
    return wrap(new Blob());
  },
  all: async () => {
    await excelService.exportMasterWorkbook();
    return wrap(new Blob());
  },
};

// ---------------------------------------------------------------------------
// PUBLIC DIGITAL CATALOGUE
// ---------------------------------------------------------------------------
export const catalogueApi = {
  products: async (params?: any) => wrap(await dbService.getPublicCatalogue(params)),
  product: async (slug: string) => {
    const prod = (await dbService.getPublicProduct(slug)) as any;
    const settings = await dbService.getShopSettings();
    const whatsappNum = (settings.shop_whatsapp || '+919876543210').replace(/\D/g, '');
    const prodName = prod?.name || 'Garments';
    const prodSku = prod?.sku || slug;
    const whatsappLink = `https://wa.me/${whatsappNum}?text=${encodeURIComponent(`Hello Munna Readymade Garments, I would like to inquire about "${prodName}" (SKU: ${prodSku}).`)}`;
    return wrap({ ...prod, whatsappLink });
  },
  toggleProduct: async (id: string | number, field: string) => {
    const docRef = doc(db, dbService.PATHS.PRODUCTS, String(id));
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const cur = snap.data()[field];
      await dbService.updateProduct(String(id), { [field]: !cur });
    }
    return wrap({ success: true });
  },
};

// ---------------------------------------------------------------------------
// BACKUP & RESTORE
// ---------------------------------------------------------------------------
export const backupApi = {
  list: async () => {
    const snap = await getDocs(collection(db, dbService.PATHS.BACKUPS));
    const backups = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return wrap(backups);
  },
  create: async () => {
    // Generate JSON cloud dump
    const [prods, custs, supps, { expenses }, settings] = await Promise.all([
      dbService.getProducts(),
      dbService.getCustomers(),
      dbService.getSuppliers(),
      dbService.getExpenses(),
      dbService.getShopSettings(),
    ]);

    const backupData = {
      timestamp: new Date().toISOString(),
      shop: 'Munna Readymade Garments',
      location: 'Dhobwal Bazzar',
      data: { products: prods, customers: custs, suppliers: supps, expenses, settings },
    };

    const docRef = doc(collection(db, dbService.PATHS.BACKUPS));
    const filename = `Munna_Garments_Backup_${new Date().toISOString().split('T')[0]}_${Date.now().toString().slice(-4)}.json`;
    const record = {
      id: docRef.id,
      filename,
      created_at: new Date().toLocaleString('en-IN'),
      size_formatted: `${(JSON.stringify(backupData).length / 1024).toFixed(1)} KB`,
      jsonDump: JSON.stringify(backupData),
    };
    await setDoc(docRef, record);
    await dbService.addStockMovement({
      product_id: 'SYSTEM',
      product_name: 'Database Backup',
      type: 'Backup Snapshot',
      quantity: 0,
      previous_stock: 0,
      new_stock: 0,
      reason: 'Cloud JSON Snapshot created',
    });
    return wrap(record);
  },
  restore: async (jsonString: string) => {
    const parsed = JSON.parse(jsonString);
    if (!parsed.data) throw new Error('Invalid backup file format');
    if (parsed.data.products && Array.isArray(parsed.data.products)) {
      for (const p of parsed.data.products) {
        if (p.id) await setDoc(doc(db, dbService.PATHS.PRODUCTS, String(p.id)), p, { merge: true });
      }
    }
    if (parsed.data.customers && Array.isArray(parsed.data.customers)) {
      for (const c of parsed.data.customers) {
        if (c.id) await setDoc(doc(db, dbService.PATHS.CUSTOMERS, String(c.id)), c, { merge: true });
      }
    }
    if (parsed.data.suppliers && Array.isArray(parsed.data.suppliers)) {
      for (const s of parsed.data.suppliers) {
        if (s.id) await setDoc(doc(db, dbService.PATHS.SUPPLIERS, String(s.id)), s, { merge: true });
      }
    }
    if (parsed.data.settings) {
      await setDoc(doc(db, dbService.PATHS.SETTINGS, 'general'), parsed.data.settings, { merge: true });
    }
    return wrap({ success: true });
  },
};

// ---------------------------------------------------------------------------
// GLOBAL SEARCH
// ---------------------------------------------------------------------------
export const searchApi = {
  global: async (q: string) => {
    const s = q.toLowerCase();
    const [prods, salesSnap, custs, supps] = await Promise.all([
      dbService.getProducts({ search: q }),
      getDocs(collection(db, dbService.PATHS.SALES)),
      dbService.getCustomers(q),
      dbService.getSuppliers(q),
    ]);

    const sales = salesSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .filter(sale => sale.invoice_number?.toLowerCase().includes(s) || sale.customer_name?.toLowerCase().includes(s))
      .slice(0, 5);

    return wrap({
      products: prods.slice(0, 5),
      sales,
      customers: custs.slice(0, 5),
      suppliers: supps.slice(0, 5),
    });
  },
};

export default {
  auth: authApi,
  dashboard: dashboardApi,
  products: productsApi,
  sales: salesApi,
  purchases: purchasesApi,
  customers: customersApi,
  suppliers: suppliersApi,
  expenses: expensesApi,
  returns: returnsApi,
  reports: reportsApi,
  settings: settingsApi,
  catalogue: catalogueApi,
};
