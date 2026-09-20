import { useState, useEffect } from 'react';
import { RotateCcw, Plus, AlertCircle } from 'lucide-react';
import { returnsApi } from '../../api';
import { formatCurrency, formatDate } from '../../utils';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonTable } from '../../components/ui/Skeleton';
import toast from 'react-hot-toast';

export default function PurchaseReturns() {
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const res = await returnsApi.list({ type: 'Purchase' });
      setReturns(res.data.returns || []);
    } catch (err) {
      toast.error('Failed to load purchase returns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-gray-900">Purchase Debit Notes & Supplier Returns</h1>
          <p className="text-sm text-gray-500 mt-0.5">Defective fabric and returned stock sent back to suppliers</p>
        </div>
      </div>

      <Card padding="none">
        {loading ? (
          <SkeletonTable rows={5} />
        ) : returns.length === 0 ? (
          <EmptyState
            title="No purchase returns"
            description="Goods returned to mills or wholesale suppliers will show up here."
            icon={<RotateCcw size={32} />}
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-amber-50/40 text-xs text-amber-900 border-b border-amber-100">
              <tr>
                <th className="py-3 px-4 font-semibold">Return / Debit Note #</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Supplier</th>
                <th className="py-3 px-4 font-semibold text-right">Debit Amount</th>
                <th className="py-3 px-4 font-semibold">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {returns.map(r => (
                <tr key={r.id} className="hover:bg-amber-50/20">
                  <td className="py-3 px-4 font-bold text-gray-900">{r.return_number}</td>
                  <td className="py-3 px-4 text-gray-500 text-xs">{formatDate(r.date)}</td>
                  <td className="py-3 px-4 font-medium text-gray-800">{r.supplier_name || 'Supplier'}</td>
                  <td className="py-3 px-4 text-right font-bold text-red-600">{formatCurrency(r.total_amount)}</td>
                  <td className="py-3 px-4 text-xs text-gray-500">{r.reason || 'Defective fabric'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
