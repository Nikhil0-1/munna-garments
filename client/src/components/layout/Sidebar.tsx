import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import {
  LayoutDashboard, ShoppingCart, Package, ShoppingBag,
  Users, Truck, CreditCard, Receipt, BarChart3, Globe,
  Settings, ChevronDown, Tag, ArrowDownCircle, ArrowUpCircle,
  BookOpen, AlertTriangle, QrCode, RotateCcw, History
} from 'lucide-react';

const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  {
    label: 'Sales', icon: ShoppingCart,
    children: [
      { label: 'New Sale (POS)', path: '/sales/new', icon: ShoppingCart },
      { label: 'Invoices', path: '/sales/invoices', icon: Receipt },
      { label: 'Returns', path: '/sales/returns', icon: RotateCcw },
    ]
  },
  {
    label: 'Inventory', icon: Package,
    children: [
      { label: 'Products', path: '/inventory/products', icon: Package },
      { label: 'Categories', path: '/inventory/categories', icon: Tag },
      { label: 'Stock Entry', path: '/inventory/stock-entry', icon: ArrowDownCircle },
      { label: 'Stock Exit', path: '/inventory/stock-exit', icon: ArrowUpCircle },
      { label: 'Stock Ledger', path: '/inventory/ledger', icon: BookOpen },
      { label: 'Low Stock', path: '/inventory/low-stock', icon: AlertTriangle },
      { label: 'Barcode', path: '/inventory/barcode', icon: QrCode },
    ]
  },
  {
    label: 'Purchases', icon: ShoppingBag,
    children: [
      { label: 'New Purchase', path: '/purchases/new', icon: ShoppingBag },
      { label: 'History', path: '/purchases/history', icon: History },
      { label: 'Returns', path: '/purchases/returns', icon: RotateCcw },
    ]
  },
  { label: 'Customers', icon: Users, path: '/customers' },
  { label: 'Suppliers', icon: Truck, path: '/suppliers' },
  { label: 'Payments', icon: CreditCard, path: '/payments' },
  { label: 'Expenses', icon: Receipt, path: '/expenses' },
  { label: 'Reports', icon: BarChart3, path: '/reports' },
  { label: 'Catalogue', icon: Globe, path: '/catalogue-management' },
  { label: 'Settings', icon: Settings, path: '/settings' },
];

export default function Sidebar({ collapsed }: { collapsed: boolean }) {
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState<string[]>(['Sales', 'Inventory', 'Purchases']);

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => prev.includes(label) ? prev.filter(g => g !== label) : [...prev, label]);
  };

  const isGroupActive = (children: { path: string }[]) =>
    children.some(c => location.pathname.startsWith(c.path));

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ type: 'spring', damping: 30, stiffness: 400 }}
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: 'white', borderRight: '1px solid rgba(201,169,110,0.15)', zIndex: 30 }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom: '1px solid rgba(201,169,110,0.12)', minHeight: 72 }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: 'linear-gradient(135deg,#C9A96E,#8B7355)' }}>
          <span className="text-white font-serif font-bold text-base">M</span>
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p className="font-serif font-bold text-sm leading-tight" style={{ color: '#2D2D2D' }}>MUNNA</p>
              <p className="text-[9px] font-medium tracking-widest" style={{ color: '#8B7355' }}>READYMADE GARMENTS</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV.map(item => (
          item.path ? (
            <NavLink key={item.path} to={item.path} className={({ isActive }) =>
              `sidebar-link mb-0.5 ${isActive ? 'active' : ''}`
            }>
              <item.icon size={18} className="flex-shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="truncate text-sm">
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </NavLink>
          ) : (
            <div key={item.label}>
              <button
                onClick={() => toggleGroup(item.label)}
                className={`sidebar-link mb-0.5 w-full justify-between ${
                  isGroupActive(item.children || []) ? 'text-[#8B7355] font-semibold' : ''
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <item.icon size={18} className="flex-shrink-0" />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-left text-sm truncate">
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                {!collapsed && (
                  <motion.div animate={{ rotate: openGroups.includes(item.label) ? 180 : 0 }}>
                    <ChevronDown size={14} />
                  </motion.div>
                )}
              </button>
              <AnimatePresence>
                {!collapsed && openGroups.includes(item.label) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden ml-3 pl-3 mb-1"
                    style={{ borderLeft: '1.5px solid rgba(201,169,110,0.3)' }}
                  >
                    {item.children?.map(child => (
                      <NavLink key={child.path} to={child.path} className={({ isActive }) =>
                        `sidebar-link text-xs py-2 mb-0.5 ${isActive ? 'active' : ''}`
                      }>
                        <child.icon size={14} />
                        {child.label}
                      </NavLink>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3" style={{ borderTop: '1px solid rgba(201,169,110,0.12)' }}>
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p className="text-[10px] text-center font-medium" style={{ color: '#8B7355' }}>Munna Readymade Garments</p>
              <p className="text-[9px] text-center" style={{ color: '#B5A896' }}>Dhobwal Bazzar</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
