import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Plus, Barcode, History, Image as ImageIcon, Sparkles, Upload, ExternalLink } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { productsApi, categoriesApi } from '../../api';
import { formatCurrency, formatDate } from '../../utils';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { SkeletonCard } from '../../components/ui/Skeleton';
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
  const imageUploadRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [regeneratingBarcode, setRegeneratingBarcode] = useState(false);
  const [imageLinkInput, setImageLinkInput] = useState('');

  const fetchProduct = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [pRes, cRes, lRes] = await Promise.all([
        productsApi.get(Number(id)),
        categoriesApi.list(),
        productsApi.ledger(Number(id)),
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
    setRegeneratingBarcode(true);
    try {
      const res = await productsApi.generateBarcode('MRG');
      const updated = { ...product, barcode: res.data.barcode };
      await productsApi.update(Number(id), updated);
      setProduct(updated);
      toast.success(`New Barcode Assigned: ${res.data.barcode}`);
    } catch {
      toast.error('Failed to regenerate barcode');
    } finally {
      setRegeneratingBarcode(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const res = await productsApi.uploadImage(file, String(id));
      const currentImages = product.images || [];
      const updated = { ...product, images: [res.data.url, ...currentImages] };
      await productsApi.update(Number(id), updated);
      setProduct(updated);
      toast.success('Garment image saved successfully');
    } catch {
      toast.error('Failed to upload image');
    } finally {
      setUploadingImage(false);
      if (imageUploadRef.current) imageUploadRef.current.value = '';
    }
  };

  const handleAddImageLink = async () => {
    if (!imageLinkInput.trim()) {
      toast.error('Please enter an image link');
      return;
    }
    try {
      const currentImages = product.images || [];
      const updated = { ...product, images: [imageLinkInput.trim(), ...currentImages] };
      await productsApi.update(Number(id), updated);
      setProduct(updated);
      setImageLinkInput('');
      toast.success('Image link add ho gaya!');
    } catch {
      toast.error('Failed to add image link');
    }
  };

  const handleRemoveImage = async (indexToRemove: number) => {
    try {
      const updatedImages = product.images.filter((_: any, i: number) => i !== indexToRemove);
      const updated = { ...product, images: updatedImages };
      await productsApi.update(Number(id), updated);
      setProduct(updated);
      toast.success('Photo removed');
    } catch {
      toast.error('Failed to remove image');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await productsApi.update(Number(id), product);
      toast.success('Product updated successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleAddVariant = async () => {
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
      await productsApi.update(Number(id), { ...product, variants: updatedVariants });
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

            {/* Product Image Gallery Card */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800">Product Images</h3>
                <input
                  type="file"
                  ref={imageUploadRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => imageUploadRef.current?.click()}
                  loading={uploadingImage}
                  icon={<Upload size={13} />}
                >
                  Upload
                </Button>
              </div>
              {product.images && product.images.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {product.images.map((img: string, idx: number) => (
                    <div key={idx} className="relative rounded-xl overflow-hidden border border-gray-200 aspect-square group">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-1.5 right-1.5 p-1 bg-red-600/80 hover:bg-red-700 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove photo"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  onClick={() => imageUploadRef.current?.click()}
                  className="py-6 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-amber-400 cursor-pointer transition-colors mb-3"
                >
                  <ImageIcon size={26} className="mb-1 text-gray-300" />
                  <span className="text-xs">Device se photo select karein</span>
                </div>
              )}

              {/* Add image by URL link */}
              <div className="pt-2 border-t border-gray-100">
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  🔗 Image Link / URL se Add Karein:
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://example.com/photo.jpg"
                    value={imageLinkInput}
                    onChange={e => setImageLinkInput(e.target.value)}
                    className="flex-1 py-1.5 px-2.5 text-xs bg-gray-50/50 rounded-lg border border-gray-200 outline-none focus:border-amber-600 font-mono"
                  />
                  <Button type="button" size="sm" variant="outline" onClick={handleAddImageLink}>
                    Add Link
                  </Button>
                </div>
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
              {product.variants?.map((v: any) => (
                <tr key={v.id} className="hover:bg-amber-50/20">
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
              {ledger.map((m: any) => (
                <tr key={m.id} className="hover:bg-amber-50/20">
                  <td className="py-2.5 px-4 text-xs text-gray-500">{formatDate(m.created_at)}</td>
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
