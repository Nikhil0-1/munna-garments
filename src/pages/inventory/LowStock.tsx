import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Plus, ShoppingBag } from 'lucide-react';
import { productsApi } from '../../api';
import { formatCurrency } from '../../utils';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonTable } from '../../components/ui/Skeleton';
import toast from 'react-hot-toast';

export default function LowStock() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchLowStock = async () => {
    setLoading(true);
    try {
      const res = await productsApi.lowStock();
      setItems(res.data.lowStock || []);
    } catch (err) {
      toast.error('Failed to load low stock items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLowStock();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-gray-900">Low Stock & Out-of-Stock Alert</h1>
          <p className="text-sm text-gray-500 mt-0.5">Garment items running below threshold, needing reordering</p>
        </div>
        <Button onClick={() => navigate('/purchases/new')} icon={<ShoppingBag size={16} />}>
          Create Purchase Order
        </Button>
      </div>

      <Card padding="none">
        {loading ? (
          <SkeletonTable rows={5} />
        ) : items.length === 0 ? (
          <EmptyState
            title="All stock levels are optimal!"
            description="No garment items currently fall below their safety reorder threshold."
            icon={<AlertTriangle size={32} />}
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-amber-50/40 text-xs text-amber-900 border-b border-amber-100">
              <tr>
                <th className="py-3 px-4 font-semibold">Garment Item</th>
                <th className="py-3 px-4 font-semibold">SKU</th>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold text-right">Min Threshold</th>
                <th className="py-3 px-4 font-semibold text-right">Current Stock</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((it: any) => (
                <tr key={it.id} className="hover:bg-amber-50/20">
                  <td className="py-3 px-4 font-bold text-gray-800">{it.name}</td>
                  <td className="py-3 px-4 text-xs font-mono text-gray-500">{it.sku}</td>
                  <td className="py-3 px-4 text-xs text-gray-600">{it.category_name}</td>
                  <td className="py-3 px-4 text-right text-xs text-gray-500">{it.min_stock} pcs</td>
                  <td className="py-3 px-4 text-right">
                    <span className="font-bold text-red-600 text-sm">{it.current_stock} pcs</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge color={it.current_stock === 0 ? 'red' : 'orange'}>
                      {it.current_stock === 0 ? 'Out of Stock' : 'Low Stock'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/inventory/stock-entry`)} icon={<Plus size={13} />}>
                      Restock
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
