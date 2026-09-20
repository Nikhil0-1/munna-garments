import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, ShoppingCart, Package, Users,
  CreditCard, AlertTriangle, IndianRupee, Plus, ArrowRight,
  BarChart2, PieChart as PieIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { dashboardApi } from '../api';
import { formatCurrency, formatDate, getGreeting, getStatusColor, getPaymentColor, CHART_COLORS } from '../utils';
import { useSettingsStore } from '../store';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { SkeletonCard } from '../components/ui/Skeleton';
import Badge from '../components/ui/Badge';

function AnimatedNumber({ value, prefix = '₹', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const start = 0;
    const end = value;
    if (end === 0) { setDisplayed(0); return; }
    const duration = 1200;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);

  return (
    <span>
      {prefix}{displayed.toLocaleString('en-IN')}{suffix}
    </span>
  );
}

interface KPICardProps {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  icon: React.ReactNode;
  color: string;
  trend?: number;
  trendLabel?: string;
  onClick?: () => void;
}

function KPICard({ title, value, prefix = '₹', suffix = '', icon, color, trend, trendLabel, onClick }: KPICardProps) {
  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: '0 12px 40px rgba(0,0,0,0.10)' }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={`kpi-card ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
          <div style={{ color }}>{icon}</div>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${trend >= 0 ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50'}`}>
            {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <p className="text-xs font-medium mb-1" style={{ color: '#8B8B8B' }}>{title}</p>
      <p className="text-2xl font-bold" style={{ color: '#1A1A2E' }}>
        <AnimatedNumber value={value} prefix={prefix} suffix={suffix} />
      </p>
      {trendLabel && <p className="text-xs mt-1" style={{ color: '#B5A896' }}>{trendLabel}</p>}
    </motion.div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { settings } = useSettingsStore();
  const navigate = useNavigate();

  useEffect(() => {
    dashboardApi.get()
      .then(r => setData(r.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const quickActions = [
    { label: 'New Sale', icon: ShoppingCart, path: '/sales/new', color: '#C9A96E' },
    { label: 'Add Product', icon: Package, path: '/inventory/products', color: '#8B7355' },
    { label: 'Stock Entry', icon: Package, path: '/inventory/stock-entry', color: '#B5896A' },
    { label: 'New Purchase', icon: ShoppingCart, path: '/purchases/new', color: '#D4A574' },
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold font-serif" style={{ color: '#2D2D2D' }}>
            {getGreeting()}, <span style={{ color: '#C9A96E' }}>Munna Readymade Garments</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: '#8B8B8B' }}>
            📍 Dhobwal Bazzar &nbsp;·&nbsp; {dateStr}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickActions.map(qa => (
            <motion.button
              key={qa.label}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(qa.path)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-white shadow-sm"
              style={{ background: `linear-gradient(135deg, ${qa.color}, ${qa.color}BB)` }}
            >
              <Plus size={14} />
              {qa.label}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Today's Sales", value: data?.today?.revenue || 0, icon: <IndianRupee size={20} />, color: '#C9A96E', trend: data?.growth?.revenueGrowth, trendLabel: 'vs last month', onClick: () => navigate('/sales/invoices') },
          { title: "Today's Profit", value: data?.today?.profit || 0, icon: <TrendingUp size={20} />, color: '#22c55e', prefix: '₹' },
          { title: "Today's Bills", value: data?.today?.sales || 0, icon: <ShoppingCart size={20} />, color: '#8B7355', prefix: '', suffix: ' bills', onClick: () => navigate('/sales/invoices') },
          { title: 'Stock Value', value: data?.stock?.value || 0, icon: <Package size={20} />, color: '#6366f1', onClick: () => navigate('/reports') },
          { title: 'Total Customers', value: data?.customers || 0, icon: <Users size={20} />, color: '#f59e0b', prefix: '', onClick: () => navigate('/customers') },
          { title: 'Receivables', value: data?.receivables || 0, icon: <CreditCard size={20} />, color: '#ef4444' },
          { title: 'Payables', value: data?.payables || 0, icon: <CreditCard size={20} />, color: '#8b5cf6' },
          { title: 'Low Stock Items', value: data?.lowStockCount || 0, icon: <AlertTriangle size={20} />, color: '#f97316', prefix: '', onClick: () => navigate('/inventory/low-stock') },
        ].map((kpi, i) => (
          <motion.div key={kpi.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <KPICard {...kpi} />
          </motion.div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Overview */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold" style={{ color: '#2D2D2D' }}>Sales Overview</h3>
            <BarChart2 size={18} style={{ color: '#C9A96E' }} />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data?.charts?.dailySales || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE3" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#B5A896' }} tickFormatter={d => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} />
              <YAxis tick={{ fontSize: 11, fill: '#B5A896' }} tickFormatter={v => `₹${v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v}`} />
              <Tooltip formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']} labelFormatter={(l: any) => l ? new Date(String(l)).toLocaleDateString('en-IN') : ''} contentStyle={{ borderRadius: '10px', border: '1px solid rgba(201,169,110,0.2)', fontSize: '12px' }} />
              <Line type="monotone" dataKey="revenue" stroke="#C9A96E" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#C9A96E' }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Payment Methods */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold" style={{ color: '#2D2D2D' }}>Payment Methods</h3>
            <PieIcon size={18} style={{ color: '#C9A96E' }} />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={data?.charts?.paymentBreakdown || []} dataKey="amount" nameKey="payment_method" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                {(data?.charts?.paymentBreakdown || []).map((_: any, i: number) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => `₹${Number(v).toLocaleString('en-IN')}`} contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid rgba(201,169,110,0.2)' }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold" style={{ color: '#2D2D2D' }}>Top Products (30 days)</h3>
          </div>
          {data?.charts?.topProducts?.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data?.charts?.topProducts || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#B5A896' }} tickFormatter={v => `${v}`} />
                <YAxis type="category" dataKey="product_name" width={100} tick={{ fontSize: 10, fill: '#6B6B6B' }} />
                <Tooltip formatter={(v: any) => [`${v} pcs`, 'Qty']} contentStyle={{ borderRadius: '10px', fontSize: '12px' }} />
                <Bar dataKey="total_qty" fill="#C9A96E" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-sm" style={{ color: '#B5A896' }}>No sales data yet</div>
          )}
        </Card>

        {/* Category Sales */}
        <Card>
          <h3 className="font-semibold mb-4" style={{ color: '#2D2D2D' }}>Category Sales</h3>
          {data?.charts?.categorySales?.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data?.charts?.categorySales || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE3" />
                <XAxis dataKey="category" tick={{ fontSize: 10, fill: '#B5A896' }} />
                <YAxis tick={{ fontSize: 11, fill: '#B5A896' }} tickFormatter={v => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}`} />
                <Tooltip formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']} contentStyle={{ borderRadius: '10px', fontSize: '12px' }} />
                <Bar dataKey="revenue" fill="#8B7355" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-sm" style={{ color: '#B5A896' }}>No data yet</div>
          )}
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <Card padding="none">
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F0EBE3' }}>
            <h3 className="font-semibold" style={{ color: '#2D2D2D' }}>Recent Transactions</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/sales/invoices')} icon={<ArrowRight size={14} />}>
              View All
            </Button>
          </div>
          <div className="divide-y" style={{ borderColor: '#F8F4F0' }}>
            {data?.recentSales?.length > 0 ? data.recentSales.slice(0, 8).map((s: any) => (
              <div key={s.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#FDFBF8] transition-colors">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#F5EFE6' }}>
                  <ShoppingCart size={14} style={{ color: '#C9A96E' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.invoice_number}</p>
                  <p className="text-xs truncate" style={{ color: '#8B8B8B' }}>{s.customer_name} · {formatDate(s.date)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold" style={{ color: '#2D2D2D' }}>{formatCurrency(s.total_amount)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getPaymentColor(s.payment_method)}`}>{s.payment_method}</span>
                </div>
              </div>
            )) : (
              <div className="py-12 text-center text-sm" style={{ color: '#B5A896' }}>No transactions yet</div>
            )}
          </div>
        </Card>

        {/* Low Stock Alert */}
        <Card padding="none">
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F0EBE3' }}>
            <h3 className="font-semibold" style={{ color: '#2D2D2D' }}>Low Stock Alert</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/inventory/low-stock')} icon={<ArrowRight size={14} />}>
              View All
            </Button>
          </div>
          <div className="divide-y" style={{ borderColor: '#F8F4F0' }}>
            {data?.lowStockProducts?.length > 0 ? data.lowStockProducts.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#FDFBF8] transition-colors">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-orange-50">
                  <AlertTriangle size={14} className="text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs" style={{ color: '#8B8B8B' }}>SKU: {p.sku} · Min: {p.min_stock}</p>
                </div>
                <Badge color={p.current_stock === 0 ? 'red' : 'orange'}>
                  {p.current_stock === 0 ? 'Out of Stock' : `${p.current_stock} left`}
                </Badge>
              </div>
            )) : (
              <div className="py-12 text-center">
                <p className="text-2xl mb-2">🎉</p>
                <p className="text-sm font-medium" style={{ color: '#22c55e' }}>All stock levels are good!</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
