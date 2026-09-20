import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ShoppingBag, Truck, Search } from 'lucide-react';
import { suppliersApi, productsApi, purchasesApi } from '../../api';
import { formatCurrency } from '../../utils';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import toast from 'react-hot-toast';

export default function NewPurchase() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [supplierInvoice, setSupplierInvoice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paidAmount, setPaidAmount] = useState<number | ''>('');
  
  // Product search to add item
  const [prodSearch, setProdSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    suppliersApi.list().then(res => setSuppliers(res.data.suppliers || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (prodSearch.length >= 2) {
      productsApi.search(prodSearch).then(res => setSearchResults(res.data)).catch(() => {});
    } else {
      setSearchResults([]);
    }
  }, [prodSearch]);

  const addItem = (product: any, variant: any = null) => {
    const newItem = {
      product_id: product.id,
      variant_id: variant?.id || null,
      product_name: product.name,
      size: variant?.size || '',
      color: variant?.color || '',
      quantity: 10,
      purchase_rate: variant?.purchase_price || product.purchase_price || 0,
      discount_percent: 0,
      gst_rate: product.gst_rate || 5,
    };
    setItems([...items, newItem]);
    setProdSearch('');
    setSearchResults([]);
  };

  const updateItem = (index: number, key: string, val: any) => {
    const updated = [...items];
    updated[index][key] = val;
    setItems(updated);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((sum, it) => sum + (it.quantity * it.purchase_rate), 0);
  const gstTotal = items.reduce((sum, it) => sum + ((it.quantity * it.purchase_rate) * it.gst_rate / 100), 0);
  const totalAmount = subtotal + gstTotal;
  const balanceDue = Math.max(0, totalAmount - (Number(paidAmount) || 0));

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      toast.error('Please select a supplier');
      return;
    }
    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    setSubmitting(true);
    try {
      await purchasesApi.create({
        supplier_id: Number(supplierId),
        supplier_invoice: supplierInvoice,
        date: purchaseDate,
        subtotal,
        gst_amount: gstTotal,
        total_amount: totalAmount,
        paid_amount: Number(paidAmount) || 0,
        due_amount: balanceDue,
        payment_method: paymentMethod,
        items,
      });
      toast.success('Purchase recorded and inventory updated!');
      navigate('/purchases/history');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to record purchase');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-serif text-gray-900">New Garment Purchase (Stock Inward)</h1>
        <p className="text-sm text-gray-500 mt-0.5">Procure fabrics, clothes, and apparel from textile mills & suppliers</p>
      </div>

      <form onSubmit={handleSavePurchase} className="space-y-6">
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Supplier / Mill *</label>
              <select
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
                className="w-full py-2 px-3 text-sm rounded-xl border border-gray-200 outline-none focus:border-amber-600"
                required
              >
                <option value="">Select Supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.company || 'Direct'})</option>)}
              </select>
            </div>
            <Input
              label="Supplier Invoice / Bill No."
              value={supplierInvoice}
              onChange={e => setSupplierInvoice(e.target.value)}
              placeholder="e.g. MILL-INV-9821"
            />
            <Input
              label="Purchase Date"
              type="date"
              value={purchaseDate}
              onChange={e => setPurchaseDate(e.target.value)}
              required
            />
          </div>
        </Card>

        {/* Item Selection & Table */}
        <Card padding="none">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={prodSearch}
                onChange={e => setProdSearch(e.target.value)}
                placeholder="Search garment to add to purchase..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 outline-none focus:border-amber-600"
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden divide-y">
                  {searchResults.map(p => (
                    <div key={p.id} className="p-2 hover:bg-gray-50 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-semibold text-gray-800">{p.name}</p>
                        <p className="text-gray-400">{p.sku} · Cost: {formatCurrency(p.purchase_price)}</p>
                      </div>
                      <div className="flex gap-1">
                        {p.variants?.length > 0 ? (
                          p.variants.map((v: any) => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => addItem(p, v)}
                              className="px-2 py-1 bg-amber-50 text-amber-900 font-medium rounded hover:bg-amber-100"
                            >
                              + {v.size}
                            </button>
                          ))
                        ) : (
                          <button
                            type="button"
                            onClick={() => addItem(p)}
                            className="px-2 py-1 bg-amber-50 text-amber-900 font-medium rounded hover:bg-amber-100"
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <table className="w-full text-left text-sm">
            <thead className="bg-amber-50/40 text-xs text-amber-900 border-b border-amber-100">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Item</th>
                <th className="py-2.5 px-4 font-semibold">Size/Color</th>
                <th className="py-2.5 px-4 font-semibold text-center">Qty</th>
                <th className="py-2.5 px-4 font-semibold text-right">Purchase Rate</th>
                <th className="py-2.5 px-4 font-semibold text-right">GST %</th>
                <th className="py-2.5 px-4 font-semibold text-right">Total</th>
                <th className="py-2.5 px-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400 text-xs">
                    Search and add garment items to this purchase order.
                  </td>
                </tr>
              ) : (
                items.map((it, idx) => (
                  <tr key={idx} className="hover:bg-amber-50/20">
                    <td className="py-2.5 px-4 font-medium text-gray-800">{it.product_name}</td>
                    <td className="py-2.5 px-4 text-xs text-gray-500">{[it.size, it.color].filter(Boolean).join(' / ') || '-'}</td>
                    <td className="py-2.5 px-4 text-center">
                      <input
                        type="number"
                        min="1"
                        value={it.quantity}
                        onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                        className="w-16 py-1 px-2 text-center text-xs border rounded-lg outline-none focus:border-amber-600"
                      />
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <input
                        type="number"
                        min="0"
                        value={it.purchase_rate}
                        onChange={e => updateItem(idx, 'purchase_rate', Number(e.target.value))}
                        className="w-24 py-1 px-2 text-right text-xs border rounded-lg outline-none focus:border-amber-600"
                      />
                    </td>
                    <td className="py-2.5 px-4 text-right text-xs text-gray-500">{it.gst_rate}%</td>
                    <td className="py-2.5 px-4 text-right font-bold text-gray-900">
                      {formatCurrency((it.quantity * it.purchase_rate) * (1 + it.gst_rate / 100))}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <button type="button" onClick={() => removeItem(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {items.length > 0 && (
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center text-xs">
              <div className="flex gap-4">
                <span>Subtotal: <strong>{formatCurrency(subtotal)}</strong></span>
                <span>GST: <strong>{formatCurrency(gstTotal)}</strong></span>
                <span>Total: <strong className="text-sm text-amber-900">{formatCurrency(totalAmount)}</strong></span>
              </div>
            </div>
          )}
        </Card>

        {/* Payment Details */}
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full py-2 px-3 text-sm rounded-xl border border-gray-200 outline-none focus:border-amber-600"
              >
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                <option value="UPI">UPI</option>
                <option value="Cheque">Cheque</option>
                <option value="Credit">Supplier Credit (Pay Later)</option>
              </select>
            </div>
            <Input
              label="Amount Paid Immediately"
              type="number"
              value={paidAmount}
              onChange={e => setPaidAmount(Number(e.target.value))}
              placeholder={`Paid (Total: ${formatCurrency(totalAmount)})`}
            />
            <div>
              <p className="text-xs text-gray-500 mb-1">Supplier Balance Due:</p>
              <p className={`text-base font-bold ${balanceDue > 0 ? 'text-red-500' : 'text-green-600'}`}>
                {formatCurrency(balanceDue)}
              </p>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t mt-4 border-gray-100">
            <Button type="button" variant="outline" onClick={() => navigate('/purchases/history')}>Cancel</Button>
            <Button type="submit" loading={submitting} icon={<ShoppingBag size={15} />}>
              Save Purchase Order
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
