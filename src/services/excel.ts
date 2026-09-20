import * as XLSX from 'xlsx';
import { getProducts, getCustomers, getSuppliers, getExpenses, getPayments, PATHS } from './db';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

function saveWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

export async function exportProductsToExcel() {
  const products = await getProducts();
  const rows = products.map((p: any) => ({
    'Product Name': p.name,
    'SKU': p.sku,
    'Barcode': p.barcode || '-',
    'Category': p.category_name || '-',
    'Gender': p.gender || 'Unisex',
    'Fabric': p.fabric || '-',
    'Purchase Rate': p.purchase_price || 0,
    'Selling Rate': p.selling_price || 0,
    'MRP': p.mrp || 0,
    'Current Stock': p.total_stock || 0,
    'Min Stock Alert': p.min_stock || 5,
    'GST %': p.gst_rate || 5,
    'Status': p.active !== false ? 'Active' : 'Archived',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  saveWorkbook(wb, `Munna_Garments_Products_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export async function exportSalesToExcel(from?: string, to?: string) {
  const snap = await getDocs(collection(db, PATHS.SALES));
  let sales = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  if (from) sales = sales.filter(s => s.date >= from);
  if (to) sales = sales.filter(s => s.date <= to);

  const rows = sales.map((s: any) => ({
    'Invoice Number': s.invoice_number,
    'Date': s.date,
    'Customer Name': s.customer_name || 'Walk-in',
    'Phone': s.customer_phone || '-',
    'Payment Method': s.payment_method,
    'Subtotal': s.subtotal || 0,
    'Discount': s.discount_amount || 0,
    'GST': s.gst_amount || 0,
    'Total Amount': s.total_amount || 0,
    'Paid Amount': s.paid_amount || 0,
    'Due Balance': s.due_amount || 0,
    'Status': s.status || 'Completed',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sales Invoices');
  saveWorkbook(wb, `Munna_Garments_Sales_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export async function exportCustomersToExcel() {
  const customers = await getCustomers();
  const rows = customers.map((c: any) => ({
    'Customer Name': c.name,
    'Phone': c.phone || '-',
    'City': c.city || 'Dhobwal Bazzar',
    'Total Purchases': c.total_purchases || 0,
    'Total Paid': c.total_paid || 0,
    'Current Khata Due': c.balance || 0,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Customers');
  saveWorkbook(wb, `Munna_Garments_Customers_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export async function exportExpensesToExcel() {
  const { expenses } = await getExpenses();
  const rows = expenses.map((e: any) => ({
    'Date': e.date,
    'Category': e.category,
    'Description': e.description || '-',
    'Payment Method': e.payment_method || 'Cash',
    'Amount': e.amount || 0,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
  saveWorkbook(wb, `Munna_Garments_Expenses_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export async function exportStockLedgerToExcel() {
  const snap = await getDocs(collection(db, PATHS.STOCK_MOVEMENTS));
  const movements = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

  const rows = movements.map((m: any) => ({
    'Date': m.timestamp ? m.timestamp.split('T')[0] : '-',
    'Type': m.type,
    'Product': m.product_name,
    'Size / Color': [m.size, m.color].filter(Boolean).join(' / ') || '-',
    'Quantity Change': m.quantity,
    'Previous Stock': m.previous_stock,
    'New Stock': m.new_stock,
    'Reference': m.reference_number || m.reason || '-',
    'Recorded By': m.createdBy || 'owner',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Stock Ledger');
  saveWorkbook(wb, `Munna_Garments_Stock_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export async function exportMasterWorkbook() {
  const wb = XLSX.utils.book_new();

  // 1. Products
  const products = await getProducts();
  const pRows = products.map((p: any) => ({
    'Product Name': p.name,
    'SKU': p.sku,
    'Barcode': p.barcode || '-',
    'Category': p.category_name || '-',
    'Selling Rate': p.selling_price || 0,
    'Stock': p.total_stock || 0,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pRows), 'Inventory');

  // 2. Sales
  const sSnap = await getDocs(collection(db, PATHS.SALES));
  const sRows = sSnap.docs.map(d => {
    const s: any = d.data();
    return {
      'Invoice': s.invoice_number,
      'Date': s.date,
      'Customer': s.customer_name,
      'Total': s.total_amount,
      'Paid': s.paid_amount,
      'Due': s.due_amount,
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sRows), 'Sales');

  // 3. Customers
  const customers = await getCustomers();
  const cRows = customers.map((c: any) => ({
    'Customer': c.name,
    'Phone': c.phone,
    'Purchases': c.total_purchases || 0,
    'Due': c.balance || 0,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cRows), 'Customers Khata');

  // 4. Expenses
  const { expenses } = await getExpenses();
  const eRows = expenses.map((e: any) => ({
    'Date': e.date,
    'Category': e.category,
    'Amount': e.amount,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(eRows), 'Expenses');

  saveWorkbook(wb, `Munna_Garments_Master_Workbook_${new Date().toISOString().split('T')[0]}.xlsx`);
}
