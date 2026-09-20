import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Eye, Printer, Download, Filter, RefreshCw, AlertCircle } from 'lucide-react';
import { salesApi, exportApi } from '../../api';
import { formatCurrency, formatDate, getPaymentColor, getStatusColor, downloadBlob } from '../../utils';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { SkeletonTable } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import InvoicePrint from '../../components/invoice/InvoicePrint';
import toast from 'react-hot-toast';

export default function Invoices() {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 15 };
      if (search) params.search = search;
      if (status) params.status = status;
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;

      const res = await salesApi.list(params);
      setSales(res.data.sales || []);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (err: any) {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [page, status, dateFrom, dateTo]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchSales();
  };

  const handleExport = async () => {
    try {
      const res = await exportApi.sales({ from: dateFrom, to: dateTo });
      downloadBlob(res.data, `Sales_Invoices_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Invoices exported successfully');
    } catch (err) {
      toast.error('Export failed');
    }
  };

  const viewInvoice = async (id: number) => {
    try {
      const res = await salesApi.get(id);
      setSelectedSale(res.data);
      setShowPrint(true);
    } catch (err) {
      toast.error('Failed to load invoice details');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-gray-900">Sales Invoices</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage and print customer receipts & bills</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport} icon={<Download size={15} />}>
            Export Excel
          </Button>
          <Button variant="secondary" onClick={() => fetchSales()} icon={<RefreshCw size={15} />}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search invoice number, customer..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50/50 outline-none focus:border-amber-600 focus:bg-white transition-all"
            />
          </div>
          <div>
            <select
              value={status}
              onChange={e => { setStatus(e.target.value); setPage(1); }}
              className="w-full py-2 px-3 text-sm rounded-xl border border-gray-200 bg-gray-50/50 outline-none focus:border-amber-600 focus:bg-white"
            >
              <option value="">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              className="w-full py-2 px-3 text-sm rounded-xl border border-gray-200 bg-gray-50/50 outline-none focus:border-amber-600 focus:bg-white"
            />
          </div>
          <div>
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1); }}
              className="w-full py-2 px-3 text-sm rounded-xl border border-gray-200 bg-gray-50/50 outline-none focus:border-amber-600 focus:bg-white"
            />
          </div>
        </form>
      </Card>

      {/* Invoice Table */}
      <Card padding="none">
        {loading ? (
          <SkeletonTable rows={8} />
        ) : sales.length === 0 ? (
          <EmptyState
            title="No invoices found"
            description="No sales matches your current search or date filters."
            icon={<AlertCircle size={32} />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-amber-50/40 text-xs text-amber-900 border-b border-amber-100">
                <tr>
                  <th className="py-3 px-4 font-semibold">Invoice #</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Customer</th>
                  <th className="py-3 px-4 font-semibold">Method</th>
                  <th className="py-3 px-4 font-semibold text-right">Total</th>
                  <th className="py-3 px-4 font-semibold text-right">Paid</th>
                  <th className="py-3 px-4 font-semibold text-right">Due</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sales.map((sale: any) => (
                  <tr key={sale.id} className="hover:bg-amber-50/20 transition-colors">
                    <td className="py-3 px-4 font-bold text-gray-900">{sale.invoice_number}</td>
                    <td className="py-3 px-4 text-gray-500">{formatDate(sale.date)}</td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-800">{sale.customer_name}</p>
                      {sale.customer_phone && <p className="text-xs text-gray-400">{sale.customer_phone}</p>}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getPaymentColor(sale.payment_method)}`}>
                        {sale.payment_method}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-gray-900">{formatCurrency(sale.total_amount)}</td>
                    <td className="py-3 px-4 text-right text-green-600 font-medium">{formatCurrency(sale.paid_amount)}</td>
                    <td className="py-3 px-4 text-right">
                      {sale.due_amount > 0 ? (
                        <span className="font-bold text-red-500">{formatCurrency(sale.due_amount)}</span>
                      ) : (
                        <span className="text-gray-400">₹0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${getStatusColor(sale.status)}`}>
                        {sale.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => viewInvoice(sale.id)} icon={<Eye size={14} />}>
                        View / Print
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Invoice Modal Print */}
      {showPrint && selectedSale && (
        <InvoicePrint
          sale={selectedSale.sale}
          items={selectedSale.items}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  );
}
