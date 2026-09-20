import { useState, useEffect } from 'react';
import { RotateCcw, Search, Plus, AlertCircle, ArrowLeft } from 'lucide-react';
import { returnsApi, salesApi } from '../../api';
import { formatCurrency, formatDate } from '../../utils';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonTable } from '../../components/ui/Skeleton';
import toast from 'react-hot-toast';

export default function SalesReturns() {
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  
  // New return form
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [saleFound, setSaleFound] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<{ [key: number]: number }>({});
  const [returnAction, setReturnAction] = useState('Refund');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const res = await returnsApi.list({ type: 'Sale' });
      setReturns(res.data.returns || []);
    } catch (err) {
      toast.error('Failed to load sales returns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, []);

  const searchInvoice = async () => {
    if (!invoiceSearch.trim()) return;
    try {
      const res = await salesApi.list({ search: invoiceSearch.trim(), limit: 1 });
      if (res.data.sales?.length > 0) {
        const fullSale = await salesApi.get(res.data.sales[0].id);
        setSaleFound(fullSale.data);
        // default 0 qty for all items
        const initialMap: any = {};
        fullSale.data.items.forEach((item: any) => {
          initialMap[item.id] = 0;
        });
        setReturnItems(initialMap);
      } else {
        toast.error('Invoice not found');
      }
    } catch (err) {
      toast.error('Error finding invoice');
    }
  };

  const handleCreateReturn = async () => {
    const selectedList = Object.entries(returnItems)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, qty]) => {
        const originalItem = saleFound.items.find((it: any) => it.id === Number(itemId));
        return {
          product_id: originalItem.product_id,
          variant_id: originalItem.variant_id,
          product_name: originalItem.product_name,
          size: originalItem.size,
          color: originalItem.color,
          quantity: qty,
          rate: originalItem.selling_price,
          total_amount: qty * originalItem.selling_price,
        };
      });

    if (selectedList.length === 0) {
      toast.error('Please select at least 1 item to return');
      return;
    }

    setSubmitting(true);
    try {
      await returnsApi.createSalesReturn({
        sale_id: saleFound.sale.id,
        items: selectedList,
        return_action: returnAction,
        reason,
      });
      toast.success('Return processed and stock restored!');
      setShowNewModal(false);
      setSaleFound(null);
      setInvoiceSearch('');
      fetchReturns();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to process return');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-gray-900">Sales Returns & Exchanges</h1>
          <p className="text-sm text-gray-500 mt-0.5">Process product returns, refunds, and auto-restock items</p>
        </div>
        <Button onClick={() => setShowNewModal(true)} icon={<Plus size={16} />}>
          Process Return
        </Button>
      </div>

      <Card padding="none">
        {loading ? (
          <SkeletonTable rows={5} />
        ) : returns.length === 0 ? (
          <EmptyState
            title="No returns recorded"
            description="All processed customer sales returns will appear here."
            icon={<RotateCcw size={32} />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-amber-50/40 text-xs text-amber-900 border-b border-amber-100">
                <tr>
                  <th className="py-3 px-4 font-semibold">Return #</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Customer</th>
                  <th className="py-3 px-4 font-semibold">Original Invoice</th>
                  <th className="py-3 px-4 font-semibold">Action</th>
                  <th className="py-3 px-4 font-semibold text-right">Amount</th>
                  <th className="py-3 px-4 font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {returns.map((ret: any) => (
                  <tr key={ret.id} className="hover:bg-amber-50/20 transition-colors">
                    <td className="py-3 px-4 font-bold text-gray-900">{ret.return_number}</td>
                    <td className="py-3 px-4 text-gray-500">{formatDate(ret.date)}</td>
                    <td className="py-3 px-4 font-medium text-gray-800">{ret.customer_name || 'Walk-in'}</td>
                    <td className="py-3 px-4 text-amber-800">{ret.invoice_number}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                        {ret.return_action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-red-600">
                      - {formatCurrency(ret.total_amount)}
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{ret.reason || 'Customer request'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Process Return Modal */}
      <Modal open={showNewModal} onClose={() => { setShowNewModal(false); setSaleFound(null); }} title="Process Sales Return" size="lg">
        <div className="space-y-4">
          {!saleFound ? (
            <div className="flex gap-2">
              <input
                value={invoiceSearch}
                onChange={e => setInvoiceSearch(e.target.value)}
                placeholder="Enter Invoice Number (e.g. MRG-2026-0001)..."
                className="flex-1 py-2 px-3 text-sm rounded-xl border border-gray-200 outline-none focus:border-amber-600"
              />
              <Button onClick={searchInvoice} icon={<Search size={15} />}>
                Find Invoice
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200/60 flex justify-between items-center text-xs">
                <div>
                  <p className="font-bold text-gray-900">{saleFound.sale.invoice_number}</p>
                  <p className="text-gray-500">{saleFound.sale.customer_name} · {formatDate(saleFound.sale.date)}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSaleFound(null)} icon={<ArrowLeft size={13} />}>
                  Change
                </Button>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-2">Select Items & Quantities to Return:</label>
                <div className="space-y-2 border rounded-xl p-3 max-h-56 overflow-y-auto">
                  {saleFound.items.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                      <div>
                        <p className="font-semibold text-gray-800">{item.product_name}</p>
                        <p className="text-gray-500">{[item.size, item.color].filter(Boolean).join(' / ')} · Rate: {formatCurrency(item.selling_price)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">Sold: {item.quantity}</span>
                        <input
                          type="number"
                          min="0"
                          max={item.quantity}
                          value={returnItems[item.id] || 0}
                          onChange={e => setReturnItems({ ...returnItems, [item.id]: Number(e.target.value) })}
                          className="w-16 py-1 px-2 text-center border rounded-lg outline-none focus:border-amber-600"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Return Action</label>
                  <select
                    value={returnAction}
                    onChange={e => setReturnAction(e.target.value)}
                    className="w-full py-2 px-3 text-sm rounded-xl border border-gray-200 outline-none focus:border-amber-600"
                  >
                    <option value="Refund">Cash Refund</option>
                    <option value="Store Credit">Store Credit (Customer Ledger)</option>
                    <option value="Exchange">Exchange Only</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Reason</label>
                  <input
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Defect, size mismatch, etc."
                    className="w-full py-2 px-3 text-sm rounded-xl border border-gray-200 outline-none focus:border-amber-600"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowNewModal(false)}>Cancel</Button>
                <Button onClick={handleCreateReturn} loading={submitting} icon={<RotateCcw size={15} />}>
                  Complete Return & Restock
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
