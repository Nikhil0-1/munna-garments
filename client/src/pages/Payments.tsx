import { useState, useEffect } from 'react';
import { CreditCard, Download, Calendar, Filter } from 'lucide-react';
import { reportsApi } from '../api';
import { formatCurrency, formatDate, getPaymentColor } from '../utils';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonTable } from '../components/ui/Skeleton';
import toast from 'react-hot-toast';

export default function Payments() {
  const [payments, setPayments] = useState<any[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await reportsApi.payments({ from: dateFrom, to: dateTo });
      setPayments(res.data.payments || []);
      setSummary(res.data.summary || []);
    } catch (err) {
      toast.error('Failed to load payments history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [dateFrom, dateTo]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-gray-900">Payment Collections & Payouts</h1>
          <p className="text-sm text-gray-500 mt-0.5">Audit log of every UPI, Cash, Card, and Bank settlement</p>
        </div>
      </div>

      {/* Date Filter Card */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-gray-600">Filter By Date:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="py-1.5 px-3 text-xs rounded-xl border border-gray-200 outline-none focus:border-amber-600"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="py-1.5 px-3 text-xs rounded-xl border border-gray-200 outline-none focus:border-amber-600"
          />
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
              Clear
            </Button>
          )}
        </div>
      </Card>

      {/* Payments Table */}
      <Card padding="none">
        {loading ? (
          <SkeletonTable rows={6} />
        ) : payments.length === 0 ? (
          <EmptyState
            title="No payment records found"
            description="All payment entries and transaction logs will be listed here."
            icon={<CreditCard size={32} />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-amber-50/40 text-xs text-amber-900 border-b border-amber-100">
                <tr>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Type</th>
                  <th className="py-3 px-4 font-semibold">Party / Customer / Vendor</th>
                  <th className="py-3 px-4 font-semibold">Payment Mode</th>
                  <th className="py-3 px-4 font-semibold text-right">Amount</th>
                  <th className="py-3 px-4 font-semibold">Ref / Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-amber-50/20">
                    <td className="py-3 px-4 text-gray-500 text-xs">{formatDate(p.date)}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                        p.type.includes('Received') || p.type.includes('Customer')
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                      }`}>
                        {p.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-800">
                      {p.customer_name || p.supplier_name || 'Walk-in Customer'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getPaymentColor(p.payment_method)}`}>
                        {p.payment_method}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-gray-900">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500">{p.notes || p.reference_number || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
