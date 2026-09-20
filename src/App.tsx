import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store';
import AdminLayout from './components/layout/AdminLayout';
import PageLoader from './components/ui/PageLoader';

// Lazy load pages for code splitting
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NewSale = lazy(() => import('./pages/sales/NewSale'));
const Invoices = lazy(() => import('./pages/sales/Invoices'));
const SalesReturns = lazy(() => import('./pages/sales/SalesReturns'));
const Products = lazy(() => import('./pages/inventory/Products'));
const ProductDetail = lazy(() => import('./pages/inventory/ProductDetail'));
const Categories = lazy(() => import('./pages/inventory/Categories'));
const StockEntry = lazy(() => import('./pages/inventory/StockEntry'));
const StockExit = lazy(() => import('./pages/inventory/StockExit'));
const StockLedger = lazy(() => import('./pages/inventory/StockLedger'));
const LowStock = lazy(() => import('./pages/inventory/LowStock'));
const Barcode = lazy(() => import('./pages/inventory/Barcode'));
const NewPurchase = lazy(() => import('./pages/purchases/NewPurchase'));
const PurchaseHistory = lazy(() => import('./pages/purchases/PurchaseHistory'));
const PurchaseReturns = lazy(() => import('./pages/purchases/PurchaseReturns'));
const Customers = lazy(() => import('./pages/Customers'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Payments = lazy(() => import('./pages/Payments'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Reports = lazy(() => import('./pages/Reports'));
const CatalogueManagement = lazy(() => import('./pages/CatalogueManagement'));
const Settings = lazy(() => import('./pages/Settings'));

// Public catalogue pages
const PublicCatalogue = lazy(() => import('./pages/catalogue/PublicCatalogue'));
const CatalogueProductDetail = lazy(() => import('./pages/catalogue/CatalogueProductDetail'));
const CatalogueCategory = lazy(() => import('./pages/catalogue/CatalogueCategory'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  if (token) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#fff',
            color: '#2D2D2D',
            border: '1px solid rgba(201, 169, 110, 0.2)',
            borderRadius: '12px',
            padding: '12px 16px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#C9A96E', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/catalogue" element={<PublicCatalogue />} />
          <Route path="/catalogue/category/:slug" element={<CatalogueCategory />} />
          <Route path="/catalogue/product/:slug" element={<CatalogueProductDetail />} />

          {/* Admin routes */}
          <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />

            {/* Sales */}
            <Route path="/sales/new" element={<NewSale />} />
            <Route path="/sales/invoices" element={<Invoices />} />
            <Route path="/sales/returns" element={<SalesReturns />} />

            {/* Inventory */}
            <Route path="/inventory/products" element={<Products />} />
            <Route path="/inventory/products/:id" element={<ProductDetail />} />
            <Route path="/inventory/categories" element={<Categories />} />
            <Route path="/inventory/stock-entry" element={<StockEntry />} />
            <Route path="/inventory/stock-exit" element={<StockExit />} />
            <Route path="/inventory/ledger" element={<StockLedger />} />
            <Route path="/inventory/low-stock" element={<LowStock />} />
            <Route path="/inventory/barcode" element={<Barcode />} />

            {/* Purchases */}
            <Route path="/purchases/new" element={<NewPurchase />} />
            <Route path="/purchases/history" element={<PurchaseHistory />} />
            <Route path="/purchases/returns" element={<PurchaseReturns />} />

            {/* Other */}
            <Route path="/customers" element={<Customers />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/catalogue-management" element={<CatalogueManagement />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
