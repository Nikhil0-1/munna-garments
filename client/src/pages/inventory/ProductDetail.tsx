import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Plus, Barcode, History, Image as ImageIcon, Sparkles } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { productsApi, categoriesApi } from '../../api';
import { formatCurrency, formatDate } from '../../utils';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { SkeletonCard } from '../../components/ui/Skeleton';
import ProductImageManager from '../../components/ui/ProductImageManager';
import toast from 'react-hot-toast';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'variants' | 'ledger'>('info');

  const [newVariant, setNewVariant] = useState({ size: '', color: '', stock: 0, purchase_price: 0, selling_price: 0 });
  const [showAddVariant, setShowAddVariant] = useState(false);

  const barcodeRef = useRef<SVGSVGElement | null>(null);
  const [regeneratingBarcode, setRegeneratingBarcode] = useState(false);

  const fetchProduct = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [pRes, cRes, lRes] = await Promise.all([
        productsApi.get(id),
        categoriesApi.list(),
        productsApi.ledger(id),
      ]);
      setProduct(pRes.data);
      setCategories(cRes.data);
      setLedger(lRes.data.movements || []);
    } catch (err) {
      toast.error('Failed to load product details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProduct();
  }, [id]);

  useEffect(() => {
    if (product && barcodeRef.current) {
      const code = product.barcode || product.sku;
      if (code) {
        try {
          JsBarcode(barcodeRef.current, code, {
            format: 'CODE128',
            width: 1.8,
            height: 50,
            displayValue: true,
            fontSize: 13,
            lineColor: '#2D2D2D',
            margin: 10,
          });
        } catch {}
      }
    }
  }, [product]);

  const handleRegenerateBarcode = async () => {
    if (!id) return;
    setRegeneratingBarcode(true);
    try {
      const res = await productsApi.generateBarcode('MRG');
      const updated = { ...product, barcode: res.data.barcode };
      await productsApi.update(id, updated);
      setProduct(updated);
      toast.success(`New Barcode Assigned: ${res.data.barcode}`);
    } catch {
      toast.error('Failed to regenerate barcode');
    } finally {
      setRegeneratingBarcode(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    try {
      await productsApi.update(id, product);
      toast.success('Product updated successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleAddVariant = async () => {
    if (!id) return;
    if (!newVariant.size && !newVariant.color) {
      toast.error('Specify size or color');
      return;
    }
    try {
      const updatedVariants = [...(product.variants || []), {
        ...newVariant,
        selling_price: newVariant.selling_price || product.selling_price,
        purchase_price: newVariant.purchase_price || product.purchase_price,
      }];
      await productsApi.update(id, { ...product, variants: updatedVariants });
      toast.success('Variant added');
      setShowAddVariant(false);
      setNewVariant({ size: '', color: '', stock: 0, purchase_price: 0, selling_price: 0 });
      fetchProduct();
    } catch (err) {
      toast.error('Failed to add variant');
    }
  };

  if (loading) return <div className="space-y-4"><SkeletonCard /><SkeletonCard /></div>;
  if (!product) return <div className="p-8 text-center text-gray-500">Product not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/inventory/products')} icon={<ArrowLeft size={16} />}>
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-serif text-gray-900">{product.name}</h1>
            <p className="text-xs text-gray-500 font-mono">SKU: {product.sku}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate(`/inventory/barcode?sku=${product.sku}`)} icon={<Barcode size={15} />}>
            Print Barcode
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('info')}
          className={`py-2 px-4 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'info' ? 'border-amber-600 text-amber-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Basic Details
        </button>
        <button
          onClick={() => setActiveTab('variants')}
          className={`py-2 px-4 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'variants' ? 'border-amber-600 text-amber-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Sizes & Colors ({product.variants?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          className={`py-2 px-4 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'ledger' ? 'border-amber-600 text-amber-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Stock Movement History
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Product Name" value={product.name} onChange={e => setProduct({ ...product, name: e.target.value })} required />
                  <Input label="SKU Code" value={product.sku} onChange={e => setProduct({ ...product, sku: e.target.value })} required />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Category</label>
                    <select
                      value={product.category_id || ''}
                      onChange={e => setProduct({ ...product, category_id: e.target.value })}
                      className="w-full py-2 px-3 text-sm rounded-xl border border-gray-200 outline-none focus:border-amber-600"
                    >
                      <option value="">Select Category</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Gender</label>
                    <select
                      value={product.gender || 'Men'}
                      onChange={e => setProduct({ ...product, gender: e.target.value })}
                      className="w-full py-2 px-3 text-sm rounded-xl border border-gray-200 outline-none focus:border-amber-600"
                    >
                      <option value="Men">Men</option>
                      <option value="Women">Women</option>
                      <option value="Kids">Kids</option>
                      <option value="Unisex">Unisex</option>
                    </select>
                  </div>
                  <Input label="Fabric Type" value={product.fabric || ''} onChange={e => setProduct({ ...product, fabric: e.target.value })} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Input label="Selling Price" type="number" value={product.selling_price} onChange={e => setProduct({ ...product, selling_price: Number(e.target.value) })} required />
                  <Input label="Purchase Price" type="number" value={product.purchase_price} onChange={e => setProduct({ ...product, purchase_price: Number(e.target.value) })} />
                  <Input label="MRP" type="number" value={product.mrp} onChange={e => setProduct({ ...product, mrp: Number(e.target.value) })} />
                  <Input label="GST Rate (%)" type="number" value={product.gst_rate} onChange={e => setProduct({ ...product, gst_rate: Number(e.target.value) })} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Alert Minimum Stock" type="number" value={product.min_stock} onChange={e => setProduct({ ...product, min_stock: Number(e.target.value) })} />
                  <Input label="Barcode Number" value={product.barcode || ''} onChange={e => setProduct({ ...product, barcode: e.target.value })} />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Description</label>
                  <textarea
                    value={product.description || ''}
                    onChange={e => setProduct({ ...product, description: e.target.value })}
                    rows={3}
                    className="w-full p-3 text-sm rounded-xl border border-gray-200 outline-none focus:border-amber-600"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" loading={saving} icon={<Save size={15} />}>
                    Save Changes
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          <div className="space-y-6">
            {/* Product Images (Web URL System) */}
            <Card>
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Product Images (Web URL System)</h3>
              <p className="text-xs text-gray-500 mb-3">Add image URLs from ImgBB, Postimages, or any web link. The first photo is displayed on the public showroom.</p>
              <ProductImageManager
                images={product.images || []}
                onChange={async (newImages) => {
                  const updated = { ...product, images: newImages };
                  setProduct(updated);
                  if (id) {
                    try {
                      await productsApi.update(id, updated);
                      toast.success('Images updated');
                    } catch {
                      toast.error('Failed to save image changes');
                    }
                  }
                }}
                maxImages={6}
              />
            </Card>

            {/* Live Barcode Card */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800">Retail Barcode (Code 128)</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRegenerateBarcode}
                  loading={regeneratingBarcode}
                  icon={<Sparkles size={13} />}
                >
                  Regenerate
                </Button>
              </div>
              <div className="bg-amber-50/40 p-4 rounded-xl border border-amber-100 flex flex-col items-center justify-center">
                <svg ref={barcodeRef} className="max-w-full" />
                <p className="text-[11px] text-gray-400 mt-2">Compatible with standard handheld USB barcode scanners</p>
              </div>
              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => navigate(`/inventory/barcode?sku=${product.sku}`)}
                  icon={<Barcode size={14} />}
                >
                  Print Price Hangtags
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'variants' && (
        <Card padding="none">
          <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 text-sm">Size & Color Inventory</h3>
            <Button size="sm" onClick={() => setShowAddVariant(true)} icon={<Plus size={14} />}>
              Add Size / Variant
            </Button>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-600 border-b">
              <tr>
                <th className="py-2.5 px-4">Size</th>
                <th className="py-2.5 px-4">Color</th>
                <th className="py-2.5 px-4">Variant SKU</th>
                <th className="py-2.5 px-4 text-right">Selling Rate</th>
                <th className="py-2.5 px-4 text-right">In Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {product.variants?.map((v: any, vIdx: number) => (
                <tr key={v.id || vIdx} className="hover:bg-amber-50/20">
                  <td className="py-2.5 px-4 font-bold text-gray-800">{v.size || 'Free Size'}</td>
                  <td className="py-2.5 px-4 text-gray-600">{v.color || 'Standard'}</td>
                  <td className="py-2.5 px-4 font-mono text-xs text-gray-500">{v.variant_sku || '-'}</td>
                  <td className="py-2.5 px-4 text-right font-semibold text-gray-800">{formatCurrency(v.selling_price || product.selling_price)}</td>
                  <td className="py-2.5 px-4 text-right">
                    <span className={`font-bold ${v.stock <= product.min_stock ? 'text-red-500' : 'text-green-600'}`}>
                      {v.stock} pcs
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {activeTab === 'ledger' && (
        <Card padding="none">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 text-sm">Complete Stock Ledger</h3>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-600 border-b">
              <tr>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Variant</th>
                <th className="py-2.5 px-4 text-center">Change</th>
                <th className="py-2.5 px-4 text-right">New Stock</th>
                <th className="py-2.5 px-4">Reason / Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ledger.map((m: any, mIdx: number) => (
                <tr key={m.id || mIdx} className="hover:bg-amber-50/20">
                  <td className="py-2.5 px-4 text-xs text-gray-500">{formatDate(m.created_at || m.timestamp)}</td>
                  <td className="py-2.5 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${m.type.includes('Sale') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                      {m.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-xs">{[m.size, m.color].filter(Boolean).join(' / ')}</td>
                  <td className={`py-2.5 px-4 text-center font-bold text-xs ${m.quantity < 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </td>
                  <td className="py-2.5 px-4 text-right font-medium text-gray-800">{m.new_stock}</td>
                  <td className="py-2.5 px-4 text-xs text-gray-500">{m.reason || m.reference_number || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Add Variant Modal */}
      <Modal open={showAddVariant} onClose={() => setShowAddVariant(false)} title="Add Variant" size="sm">
        <div className="space-y-3">
          <Input label="Size" placeholder="e.g. XL, 34" value={newVariant.size} onChange={e => setNewVariant({ ...newVariant, size: e.target.value })} />
          <Input label="Color" placeholder="e.g. Navy Blue" value={newVariant.color} onChange={e => setNewVariant({ ...newVariant, color: e.target.value })} />
          <Input label="Initial Stock" type="number" value={newVariant.stock} onChange={e => setNewVariant({ ...newVariant, stock: Number(e.target.value) })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowAddVariant(false)}>Cancel</Button>
            <Button onClick={handleAddVariant}>Add</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
