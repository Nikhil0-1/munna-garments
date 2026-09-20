import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, IndianRupee, Download, Calendar, Package, Users } from 'lucide-react';
import { reportsApi, exportApi } from '../api';
import { formatCurrency, formatDate, downloadBlob } from '../utils';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { SkeletonCard } from '../components/ui/Skeleton';
import toast from 'react-hot-toast';

export default function Reports() {
  const [salesReport, setSalesReport] = useState<any>(null);
  const [inventoryReport, setInventoryReport] = useState<any>(null);
  const [financeReport, setFinanceReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sales' | 'inventory' | 'finance'>('sales');

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [s, inv, fin] = await Promise.all([
        reportsApi.sales({ from: dateFrom, to: dateTo }),
        reportsApi.inventory(),
        reportsApi.finance({ from: dateFrom, to: dateTo }),
      ]);
      setSalesReport(s.data);
      setInventoryReport(inv.data);
      setFinanceReport(fin.data);
    } catch (err) {
      toast.error('Failed to load business reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [dateFrom, dateTo]);

  const handleExportAll = async () => {
    try {
      const res = await exportApi.all();
      downloadBlob(res.data, `Complete_Shop_Data_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Complete business data exported');
    } catch (err) {
      toast.error('Export failed');
    }
  };

  if (loading && !salesReport) {
    return <div className="space-y-4"><SkeletonCard /><SkeletonCard /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-gray-900">Analytics & Financial Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Comprehensive audit reports for Munna Readymade Garments, Dhobwal Bazzar</p>
        </div>
        <Button variant="outline" onClick={handleExportAll} icon={<Download size={15} />}>
          Export Master Workbook (Excel)
        </Button>
      </div>

      {/* Date Filters & Tab Navigation */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2 border-b sm:border-0 pb-2 sm:pb-0">
            <button
              onClick={() => setActiveTab('sales')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${activeTab === 'sales' ? 'bg-amber-100 text-amber-900 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Sales & Profits
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${activeTab === 'inventory' ? 'bg-amber-100 text-amber-900 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Inventory Valuation
            </button>
            <button
              onClick={() => setActiveTab('finance')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${activeTab === 'finance' ? 'bg-amber-100 text-amber-900 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              P&L / Net Margin
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Date Range:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="py-1 px-2 text-xs border rounded-lg"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="py-1 px-2 text-xs border rounded-lg"
            />
          </div>
        </div>
      </Card>

      {/* Sales Tab */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <p className="text-xs text-gray-500 font-semibold">Total Revenue</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(salesReport?.totals?.revenue || 0)}</p>
            </Card>
            <Card>
              <p className="text-xs text-gray-500 font-semibold">Gross Profit</p>
              <p className="text-xl font-bold text-green-600 mt-1">{formatCurrency(salesReport?.totals?.profit || 0)}</p>
            </Card>
            <Card>
              <p className="text-xs text-gray-500 font-semibold">Collected Cash/UPI</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(salesReport?.totals?.collected || 0)}</p>
            </Card>
            <Card>
              <p className="text-xs text-gray-500 font-semibold">Customer Credit Due</p>
              <p className="text-xl font-bold text-red-500 mt-1">{formatCurrency(salesReport?.totals?.due || 0)}</p>
            </Card>
          </div>

          <Card padding="none">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900 text-sm">Top Selling Garment Styles</h3>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600 border-b">
                <tr>
                  <th className="py-2.5 px-4">Garment Item</th>
                  <th className="py-2.5 px-4 text-center">Units Sold</th>
                  <th className="py-2.5 px-4 text-right">Revenue</th>
                  <th className="py-2.5 px-4 text-right">Gross Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {salesReport?.topProducts?.map((p: any, idx: number) => (
                  <tr key={idx} className="hover:bg-amber-50/20">
                    <td className="py-2.5 px-4 font-medium text-gray-800">{p.product_name}</td>
                    <td className="py-2.5 px-4 text-center font-bold text-gray-700">{p.qty} pcs</td>
                    <td className="py-2.5 px-4 text-right font-bold text-gray-900">{formatCurrency(p.revenue)}</td>
                    <td className="py-2.5 px-4 text-right font-semibold text-green-600">{formatCurrency(p.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* Inventory Valuation Tab */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <p className="text-xs text-gray-500 font-semibold">Total Stock Value</p>
              <p className="text-2xl font-bold text-amber-900 mt-1">{formatCurrency(inventoryReport?.totalValue || 0)}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Valuation based on selling retail prices</p>
            </Card>
            <Card>
              <p className="text-xs text-gray-500 font-semibold">Low Stock Threshold Items</p>
              <p className="text-2xl font-bold text-orange-500 mt-1">{inventoryReport?.lowStock?.length || 0} styles</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Need restock order soon</p>
            </Card>
            <Card>
              <p className="text-xs text-gray-500 font-semibold">Out of Stock</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{inventoryReport?.outOfStock?.length || 0} styles</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Zero physical quantity available</p>
            </Card>
          </div>

          <Card padding="none">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900 text-sm">Stock Valuation Breakdown</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs text-gray-600 border-b sticky top-0">
                  <tr>
                    <th className="py-2.5 px-4">Garment Item</th>
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4 text-right">In Stock</th>
                    <th className="py-2.5 px-4 text-right">Retail Rate</th>
                    <th className="py-2.5 px-4 text-right">Total Holding Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {inventoryReport?.stockSummary?.map((p: any) => (
                    <tr key={p.id}>
                      <td className="py-2 px-4 font-medium text-gray-800">{p.name}</td>
                      <td className="py-2 px-4 text-xs text-gray-500">{p.category}</td>
                      <td className="py-2 px-4 text-right font-bold">{p.current_stock} pcs</td>
                      <td className="py-2 px-4 text-right text-gray-600">{formatCurrency(p.selling_price)}</td>
                      <td className="py-2 px-4 text-right font-bold text-gray-900">{formatCurrency(p.stock_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Finance Tab */}
      {activeTab === 'finance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <p className="text-xs text-gray-500 font-semibold">Total Revenue</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(financeReport?.revenue || 0)}</p>
            </Card>
            <Card>
              <p className="text-xs text-gray-500 font-semibold">Gross Margin</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(financeReport?.grossProfit || 0)}</p>
            </Card>
            <Card>
              <p className="text-xs text-gray-500 font-semibold">Shop Expenses</p>
              <p className="text-xl font-bold text-red-500 mt-1">- {formatCurrency(financeReport?.expenses || 0)}</p>
            </Card>
            <Card>
              <p className="text-xs text-gray-500 font-semibold">Net Business Profit</p>
              <p className={`text-xl font-bold mt-1 ${(financeReport?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(financeReport?.netProfit || 0)}
              </p>
            </Card>
          </div>

          <Card padding="none">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900 text-sm">Expenses By Category</h3>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600 border-b">
                <tr>
                  <th className="py-2.5 px-4">Expense Head</th>
                  <th className="py-2.5 px-4 text-right">Total Outflow</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {financeReport?.expenseByCategory?.map((exp: any, idx: number) => (
                  <tr key={idx}>
                    <td className="py-2.5 px-4 font-medium text-gray-800">{exp.category}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-red-600">{formatCurrency(exp.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}
