import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Eye, Plus, Search, Truck } from 'lucide-react';
import { purchasesApi } from '../../api';
import { formatCurrency, formatDate } from '../../utils';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonTable } from '../../components/ui/Skeleton';
import toast from 'react-hot-toast';

export default function PurchaseHistory() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const res = await purchasesApi.list({ search });
      setPurchases(res.data.purchases || []);
    } catch (err) {
      toast.error('Failed to load purchase records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-gray-900">Purchase Inward History</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track procurement bills, payments, and outstanding supplier credits</p>
        </div>
        <Button onClick={() => navigate('/purchases/new')} icon={<Plus size={16} />}>
          New Purchase
        </Button>
      </div>

      <Card padding="none">
        {loading ? (
          <SkeletonTable rows={6} />
        ) : purchases.length === 0 ? (
          <EmptyState
            title="No purchases found"
            description="Record supplier invoices and stock inwards to keep books updated."
            icon={<ShoppingBag size={32} />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-amber-50/40 text-xs text-amber-900 border-b border-amber-100">
                <tr>
                  <th className="py-3 px-4 font-semibold">Order #</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Supplier / Mill</th>
                  <th className="py-3 px-4 font-semibold">Supplier Bill #</th>
                  <th className="py-3 px-4 font-semibold text-right">Total Amount</th>
                  <th className="py-3 px-4 font-semibold text-right">Paid</th>
                  <th className="py-3 px-4 font-semibold text-right">Balance Due</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {purchases.map(p => (
                  <tr key={p.id} className="hover:bg-amber-50/20">
                    <td className="py-3 px-4 font-bold text-gray-900">{p.purchase_number}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{formatDate(p.date)}</td>
                    <td className="py-3 px-4 font-medium text-gray-800">{p.supplier_name || 'Direct Procurement'}</td>
                    <td className="py-3 px-4 text-xs font-mono text-gray-500">{p.supplier_invoice || '-'}</td>
                    <td className="py-3 px-4 text-right font-bold text-gray-900">{formatCurrency(p.total_amount)}</td>
                    <td className="py-3 px-4 text-right text-green-600 font-medium">{formatCurrency(p.paid_amount)}</td>
                    <td className="py-3 px-4 text-right">
                      {p.due_amount > 0 ? (
                        <span className="font-bold text-red-500">{formatCurrency(p.due_amount)}</span>
                      ) : (
                        <span className="text-gray-400">₹0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge color={p.due_amount <= 0 ? 'green' : 'orange'}>
                        {p.due_amount <= 0 ? 'Paid' : 'Due'}
                      </Badge>
                    </td>
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
