import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Search, LogOut, Settings, X, Package, FileText, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store';
import { searchApi } from '../../api';
import { formatCurrency } from '../../utils';

export default function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ products: {id:number;name:string;sku:string;selling_price:number}[]; sales: {id:number;invoice_number:string;customer_name:string;total_amount:number;date:string}[]; customers: {id:number;name:string;phone:string}[]; suppliers: {id:number;name:string;phone:string}[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      setSearching(true);
      const timer = setTimeout(() => {
        searchApi.global(searchQuery)
          .then(r => setSearchResults(r.data))
          .catch(() => {})
          .finally(() => setSearching(false));
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults(null);
    }
  }, [searchQuery]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchResults(null);
        setSearchQuery('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const hasResults = searchResults && (searchResults.products.length + searchResults.sales.length + searchResults.customers.length + searchResults.suppliers.length) > 0;

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <header className="flex items-center gap-3 px-4 md:px-6 py-3" style={{ background: 'white', borderBottom: '1px solid rgba(201,169,110,0.12)', height: 64, zIndex: 20 }}>
      <button onClick={onMenuClick} className="p-2 rounded-lg hover:bg-[#F5EFE6] transition-colors" style={{ color: '#8B7355' }}>
        <Menu size={20} />
      </button>

      {/* Global Search */}
      <div ref={searchRef} className="flex-1 max-w-md relative">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#B5A896' }} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search products, invoices, customers..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-[#E8E0D5] bg-[#FDFBF8] outline-none focus:border-[#C9A96E] focus:bg-white transition-all"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); setSearchResults(null); }} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={14} style={{ color: '#B5A896' }} />
            </button>
          )}
        </div>

        <AnimatePresence>
          {searchResults && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl overflow-hidden z-50"
              style={{ border: '1px solid rgba(201,169,110,0.15)', maxHeight: 360, overflowY: 'auto' }}
            >
              {!hasResults ? (
                <div className="p-4 text-center text-sm" style={{ color: '#8B8B8B' }}>No results found</div>
              ) : (
                <>
                  {searchResults.products.length > 0 && (
                    <div>
                      <div className="px-4 py-2 text-xs font-semibold" style={{ color: '#B5A896', background: '#FDFBF8' }}>PRODUCTS</div>
                      {searchResults.products.map(p => (
                        <button key={p.id} onClick={() => { navigate(`/inventory/products/${p.id}`); setSearchQuery(''); setSearchResults(null); }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FDFBF8] text-left transition-colors">
                          <Package size={16} style={{ color: '#C9A96E' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            <p className="text-xs" style={{ color: '#8B8B8B' }}>{p.sku} • {formatCurrency(p.selling_price)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.sales.length > 0 && (
                    <div>
                      <div className="px-4 py-2 text-xs font-semibold" style={{ color: '#B5A896', background: '#FDFBF8' }}>INVOICES</div>
                      {searchResults.sales.map(s => (
                        <button key={s.id} onClick={() => { navigate('/sales/invoices'); setSearchQuery(''); setSearchResults(null); }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FDFBF8] text-left transition-colors">
                          <FileText size={16} style={{ color: '#C9A96E' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{s.invoice_number}</p>
                            <p className="text-xs" style={{ color: '#8B8B8B' }}>{s.customer_name} • {formatCurrency(s.total_amount)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.customers.length > 0 && (
                    <div>
                      <div className="px-4 py-2 text-xs font-semibold" style={{ color: '#B5A896', background: '#FDFBF8' }}>CUSTOMERS</div>
                      {searchResults.customers.map(c => (
                        <button key={c.id} onClick={() => { navigate('/customers'); setSearchQuery(''); setSearchResults(null); }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FDFBF8] text-left transition-colors">
                          <Users size={16} style={{ color: '#C9A96E' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{c.name}</p>
                            <p className="text-xs" style={{ color: '#8B8B8B' }}>{c.phone}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {/* Network Status Badge */}
        <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isOnline ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200 animate-pulse'}`}>
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
          {isOnline ? 'Cloud Sync' : 'Offline'}
        </div>
        {/* User menu */}
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.02 }}
            onClick={() => setShowUser(!showUser)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors hover:bg-[#F5EFE6]"
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold" style={{ background: 'linear-gradient(135deg,#C9A96E,#8B7355)' }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium leading-tight" style={{ color: '#2D2D2D' }}>{user?.name}</p>
              <p className="text-xs" style={{ color: '#8B8B8B' }}>{user?.role}</p>
            </div>
          </motion.button>

          <AnimatePresence>
            {showUser && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -8 }}
                className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl overflow-hidden"
                style={{ border: '1px solid rgba(201,169,110,0.15)' }}
              >
                <div className="px-4 py-3" style={{ borderBottom: '1px solid #F0EBE3' }}>
                  <p className="text-sm font-semibold">{user?.name}</p>
                  <p className="text-xs" style={{ color: '#8B8B8B' }}>{user?.role}</p>
                </div>
                <button onClick={() => { navigate('/settings'); setShowUser(false); }} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-[#FDFBF8] transition-colors">
                  <Settings size={15} style={{ color: '#8B7355' }} /> Settings
                </button>
                <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-red-50 transition-colors" style={{ color: '#ef4444' }}>
                  <LogOut size={15} /> Logout
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
