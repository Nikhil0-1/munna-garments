import { useState, useEffect } from 'react';
import { ArrowDownCircle, Search } from 'lucide-react';
import { productsApi, stockApi } from '../../api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import toast from 'react-hot-toast';

export default function StockEntry() {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [quantity, setQuantity] = useState<number | ''>('');
  const [reason, setReason] = useState('New Purchase Batch');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (search.length >= 2) {
      productsApi.search(search).then(res => setProducts(res.data)).catch(() => {});
    } else {
      setProducts([]);
    }
  }, [search]);

  const selectProduct = (p: any) => {
    setSelectedProduct(p);
    setSelectedVariant(p.variants?.[0] || null);
    setProducts([]);
    setSearch('');
  };

  const handleStockEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !selectedVariant) {
      toast.error('Please select a product and size');
      return;
    }
    if (!quantity || Number(quantity) <= 0) {
      toast.error('Enter a valid quantity');
      return;
    }

    setSubmitting(true);
    try {
      await stockApi.entry({
        product_id: selectedProduct.id,
        variant_id: selectedVariant.id,
        quantity: Number(quantity),
        reason,
        notes,
      });
      toast.success(`Added ${quantity} units to ${selectedProduct.name}!`);
      setSelectedProduct(null);
      setSelectedVariant(null);
      setQuantity('');
      setNotes('');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update stock');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-serif text-gray-900">Stock Entry (Material In)</h1>
        <p className="text-sm text-gray-500 mt-0.5">Record received cloth inventory batches or manual inward stock</p>
      </div>

      <Card>
        <form onSubmit={handleStockEntry} className="space-y-4">
          {/* Search selection */}
          {!selectedProduct ? (
            <div className="relative">
              <label className="text-xs font-semibold text-gray-700 block mb-1">Search Garment Item</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Type product name or SKU..."
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 outline-none focus:border-amber-600"
                />
              </div>

              {products.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden divide-y">
                  {products.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectProduct(p)}
                      className="w-full text-left p-3 hover:bg-amber-50/50 flex justify-between items-center transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.sku} · {p.category_name}</p>
                      </div>
                      <span className="text-xs font-bold text-gray-700">{p.total_stock} pcs</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-amber-50/40 rounded-xl border border-amber-200/60 flex justify-between items-center">
              <div>
                <p className="font-bold text-gray-900">{selectedProduct.name}</p>
                <p className="text-xs text-gray-500">{selectedProduct.sku} · {selectedProduct.category_name}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedProduct(null)}>
                Change
              </Button>
            </div>
          )}

          {selectedProduct && (
            <>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Select Size / Variant</label>
                <div className="grid grid-cols-3 gap-2">
                  {selectedProduct.variants?.map((v: any) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      className={`p-2 rounded-xl border text-xs text-left transition-all ${selectedVariant?.id === v.id ? 'border-amber-600 bg-amber-50/50 text-amber-900 font-bold' : 'border-gray-200 hover:bg-gray-50'}`}
                    >
                      <p>{v.size || 'Standard'} {v.color && `(${v.color})`}</p>
                      <p className="text-gray-400 text-[10px] mt-0.5">Cur: {v.stock} pcs</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Quantity to Add *"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={e => setQuantity(Number(e.target.value))}
                  placeholder="e.g. 50"
                  required
                />
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Reason</label>
                  <select
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    className="w-full py-2 px-3 text-sm rounded-xl border border-gray-200 outline-none focus:border-amber-600"
                  >
                    <option value="New Purchase Batch">New Purchase Batch</option>
                    <option value="Stock Correction">Stock Correction (+)</option>
                    <option value="Direct Supplier Inward">Direct Supplier Inward</option>
                    <option value="Sample / Production">Sample / Production</option>
                  </select>
                </div>
              </div>

              <Input
                label="Notes / Supplier Reference"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional invoice # or remarks"
              />

              <div className="pt-2">
                <Button type="submit" loading={submitting} className="w-full" icon={<ArrowDownCircle size={16} />}>
                  Confirm Stock Entry
                </Button>
              </div>
            </>
          )}
        </form>
      </Card>
    </div>
  );
}
