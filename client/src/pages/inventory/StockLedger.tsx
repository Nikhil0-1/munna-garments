import { useState, useEffect } from 'react';
import { BookOpen, Download, Search } from 'lucide-react';
import { exportApi, productsApi } from '../../api';
import { formatDate, downloadBlob } from '../../utils';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { SkeletonTable } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

export default function StockLedger() {
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const res = await productsApi.allMovements(search);
      setMovements(res.data.movements || []);
    } catch (err) {
      toast.error('Failed to load ledger history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  const handleExport = async () => {
    try {
      const res = await exportApi.stock();
      downloadBlob(res.data, `Stock_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Stock ledger exported');
    } catch (err) {
      toast.error('Export failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-gray-900">Stock Movement Ledger</h1>
          <p className="text-sm text-gray-500 mt-0.5">Audit log of every stock inward, sale deduction, damage exit, and return</p>
        </div>
        <Button variant="outline" onClick={handleExport} icon={<Download size={15} />}>
          Export Excel
        </Button>
      </div>

      <Card padding="none">
        {loading ? (
          <SkeletonTable rows={8} />
        ) : movements.length === 0 ? (
          <EmptyState
            title="No movements recorded"
            description="Inventory changes will automatically log here."
            icon={<BookOpen size={32} />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-amber-50/40 text-xs text-amber-900 border-b border-amber-100">
                <tr>
                  <th className="py-3 px-4 font-semibold">Timestamp</th>
                  <th className="py-3 px-4 font-semibold">Type</th>
                  <th className="py-3 px-4 font-semibold">Product / Item</th>
                  <th className="py-3 px-4 font-semibold">Variant</th>
                  <th className="py-3 px-4 font-semibold text-center">Change</th>
                  <th className="py-3 px-4 font-semibold text-right">Prev → New</th>
                  <th className="py-3 px-4 font-semibold">Reason / Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {movements.map((m: any, idx: number) => (
                  <tr key={idx} className="hover:bg-amber-50/20">
                    <td className="py-3 px-4 text-xs text-gray-500">{formatDate(m.created_at)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        String(m.type || m.action).includes('Sale') || String(m.type || m.action).includes('Exit')
                          ? 'bg-red-50 text-red-700'
                          : 'bg-green-50 text-green-700'
                      }`}>
                        {m.type || m.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-800">{m.product_name || m.reference_number || 'Inventory Item'}</td>
                    <td className="py-3 px-4 text-xs text-gray-500">{[m.size, m.color].filter(Boolean).join(' / ') || '-'}</td>
                    <td className={`py-3 px-4 text-center font-bold ${Number(m.quantity) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                      {Number(m.quantity) > 0 ? `+${m.quantity}` : m.quantity || '-'}
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-mono text-gray-600">
                      {m.previous_stock !== undefined ? `${m.previous_stock} → ${m.new_stock}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500">{m.reason || m.details || '-'}</td>
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
