import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Download, Edit, Trash2, Eye, Package, Tag, ArrowUpDown, Barcode, Image as ImageIcon, Sparkles, Archive, RotateCcw, Copy, RefreshCw } from 'lucide-react';
import { productsApi, categoriesApi, exportApi } from '../../api';
import { formatCurrency, downloadBlob } from '../../utils';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonTable } from '../../components/ui/Skeleton';
import toast from 'react-hot-toast';

export default function Products() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [gender, setGender] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Product creation modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingBarcode, setGeneratingBarcode] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newProd, setNewProd] = useState<any>({
    name: '', sku: '', barcode: '', category_id: '', brand: '', fabric: '',
    gender: 'Men', gst_rate: 5, mrp: '', purchase_price: '', selling_price: '',
    min_stock: 5, description: '', variants: [{ size: 'M', color: '', stock: 10, purchase_price: '', selling_price: '' }]
  });

  const navigate = useNavigate();

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 15, status: statusFilter };
      if (search) params.search = search;
      if (category) params.category = category;
      if (gender) params.gender = gender;

      const res = await productsApi.list(params);
      setProducts(res.data.products || []);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (err) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    categoriesApi.list().then(r => setCategories(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [page, category, gender, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProducts();
  };

  const handleExport = async () => {
    try {
      const res = await exportApi.products();
      downloadBlob(res.data, `Products_Catalog_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Products exported to Excel');
    } catch (err) {
      toast.error('Export failed');
    }
  };

  const handleGenerateBarcode = async () => {
    setGeneratingBarcode(true);
    try {
      const res = await productsApi.generateBarcode('MRG');
      setNewProd((prev: any) => ({
        ...prev,
        barcode: res.data.barcode,
        sku: prev.sku ? prev.sku : res.data.barcode,
      }));
      toast.success(`Generated Barcode: ${res.data.barcode}`);
    } catch (err) {
      toast.error('Could not generate barcode');
    } finally {
      setGeneratingBarcode(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const addVariantRow = () => {
    setNewProd({
      ...newProd,
      variants: [...newProd.variants, { size: 'L', color: '', stock: 5, purchase_price: newProd.purchase_price, selling_price: newProd.selling_price }]
    });
  };

  const removeVariantRow = (idx: number) => {
    setNewProd({
      ...newProd,
      variants: newProd.variants.filter((_: any, i: number) => i !== idx)
    });
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProd.name || !newProd.selling_price) {
      toast.error('Product name and selling price are required');
      return;
    }

    if (newProd.barcode) {
      const check = await productsApi.checkBarcode(newProd.barcode);
      if (check.data.exists) {
        toast.error(`Barcode "${newProd.barcode}" already exists! Please use a unique barcode.`);
        return;
      }
    }

    setSaving(true);
    try {
      const tempId = `prod_${Date.now()}`;
      let uploadedUrls: string[] = [];

      if (imageFile) {
        toast.loading('Processing product image...', { id: 'upload-img' });
        const upRes = await productsApi.uploadImage(imageFile, tempId);
        uploadedUrls.push(upRes.data.url);
        toast.success('Image saved successfully', { id: 'upload-img' });
      } else if (imagePreview && (imagePreview.startsWith('http://') || imagePreview.startsWith('https://') || imagePreview.startsWith('data:'))) {
        uploadedUrls.push(imagePreview);
      }

      await productsApi.create({
        ...newProd,
        images: uploadedUrls.length > 0 ? uploadedUrls : (newProd.images || []),
      });

      toast.success('Product created successfully');
      setShowAddModal(false);
      setImageFile(null);
      setImagePreview('');
      setNewProd({
        name: '', sku: '', barcode: '', category_id: '', brand: '', fabric: '',
        gender: 'Men', gst_rate: 5, mrp: '', purchase_price: '', selling_price: '',
        min_stock: 5, description: '', variants: [{ size: 'M', color: '', stock: 10, purchase_price: '', selling_price: '' }]
      });
      fetchProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (id: string, name: string) => {
    if (!window.confirm(`Archive "${name}"? It will be safely hidden from POS and catalogue.`)) return;
    try {
      await productsApi.delete(id);
      toast.success(`"${name}" archived`);
      fetchProducts();
    } catch {
      toast.error('Failed to archive product');
    }
  };

  const handleDeletePermanent = async (id: string, name: string) => {
    if (!window.confirm(`Kya aap "${name}" ko permanently delete karna chahte hain?`)) return;
    try {
      await productsApi.deletePermanent(id);
      toast.success(`"${name}" delete ho gaya`);
      fetchProducts();
    } catch {
      toast.error('Failed to delete product');
    }
  };

  const handleDuplicate = (prod: any) => {
    setNewProd({
      name: `${prod.name} (Copy)`,
      sku: `${prod.sku || 'MRG'}-COPY`,
      barcode: '',
      category_id: prod.category_id || '',
      brand: prod.brand || 'Munna Collection',
      fabric: prod.fabric || '',
      gender: prod.gender || 'Men',
      gst_rate: prod.gst_rate || 5,
      mrp: prod.mrp || '',
      purchase_price: prod.purchase_price || '',
      selling_price: prod.selling_price || '',
      min_stock: prod.min_stock || 5,
      description: prod.description || '',
      variants: prod.variants?.map((v: any) => ({
        size: v.size,
        color: v.color,
        stock: v.stock,
        purchase_price: v.purchase_price || prod.purchase_price,
        selling_price: v.selling_price || prod.selling_price
      })) || [{ size: 'M', color: '', stock: 5 }]
    });
    handleGenerateBarcode();
    setShowAddModal(true);
    toast.success('Product duplicate ho gaya! Details check karke save karein.');
  };

  const handleReloadSampleStock = async () => {
    if (!window.confirm('Munna Garments ke sabhi 20 sample aur duplicate kapde load karein?')) return;
    try {
      await productsApi.reloadSampleStock();
      toast.success('20 sample garments load ho gaye!');
      fetchProducts();
    } catch {
      toast.error('Could not reload samples');
    }
  };

  const handleRestore = async (id: string, name: string) => {
    try {
      await productsApi.restore(id);
      toast.success(`"${name}" restored to active inventory`);
      fetchProducts();
    } catch {
      toast.error('Failed to restore product');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-gray-900">Garments Inventory</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage cloth products, variants (size/color), and stock levels</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleReloadSampleStock} icon={<RefreshCw size={14} />} title="Munna Garments ke 20 sample aur duplicate items load karein">
            Load Samples
          </Button>
          <Button variant="outline" onClick={handleExport} icon={<Download size={15} />}>
            Export
          </Button>
          <Button onClick={() => setShowAddModal(true)} icon={<Plus size={16} />}>
            Add Product
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <Card padding="sm">
        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, SKU, brand..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50/50 outline-none focus:border-amber-600 focus:bg-white transition-all"
            />
          </div>
          <div>
            <select
              value={category}
              onChange={e => { setCategory(e.target.value); setPage(1); }}
              className="w-full py-2 px-3 text-sm rounded-xl border border-gray-200 bg-gray-50/50 outline-none focus:border-amber-600 focus:bg-white"
            >
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <select
              value={gender}
              onChange={e => { setGender(e.target.value); setPage(1); }}
              className="w-full py-2 px-3 text-sm rounded-xl border border-gray-200 bg-gray-50/50 outline-none focus:border-amber-600 focus:bg-white"
            >
              <option value="">All Genders</option>
              <option value="Men">Men</option>
              <option value="Women">Women</option>
              <option value="Kids">Kids</option>
              <option value="Unisex">Unisex</option>
            </select>
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value as any); setPage(1); }}
              className="w-full py-2 px-3 text-sm rounded-xl border border-gray-200 bg-gray-50/50 outline-none focus:border-amber-600 focus:bg-white font-medium text-gray-700"
            >
              <option value="active">Active Products</option>
              <option value="archived">Archived / Hidden</option>
              <option value="all">All Records</option>
            </select>
          </div>
        </form>
      </Card>

      {/* Product Table */}
      <Card padding="none">
        {loading ? (
          <SkeletonTable rows={8} />
        ) : products.length === 0 ? (
          <EmptyState
            title="No products found"
            description="Add your garments items and sizes to start tracking your inventory."
            icon={<Package size={32} />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-amber-50/40 text-xs text-amber-900 border-b border-amber-100">
                <tr>
                  <th className="py-3 px-4 font-semibold">Product</th>
                  <th className="py-3 px-4 font-semibold">SKU / Barcode</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold">Fabric / Gender</th>
                  <th className="py-3 px-4 font-semibold text-right">Selling Price</th>
                  <th className="py-3 px-4 font-semibold text-right">Stock</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((p: any) => (
                  <tr key={p.id} className="hover:bg-amber-50/20 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {p.images && p.images[0] ? (
                          <img src={p.images[0]} alt={p.name} className="w-10 h-10 rounded-xl object-cover border border-amber-200 shadow-xs" />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center font-bold text-amber-800 text-xs">
                            {p.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-gray-800">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.brand || 'Munna Collection'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-gray-600">
                      <div>{p.sku}</div>
                      {p.barcode && <div className="text-[10px] text-amber-700/70">{p.barcode}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {p.category_name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500">
                      {[p.fabric, p.gender].filter(Boolean).join(' · ')}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-gray-900">
                      {formatCurrency(p.selling_price)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-bold ${p.total_stock <= p.min_stock ? 'text-red-500' : 'text-gray-800'}`}>
                        {p.total_stock} pcs
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {p.archived || p.status === 'Archived' ? (
                        <Badge color="gray">Archived</Badge>
                      ) : (
                        <Badge color={p.total_stock > p.min_stock ? 'green' : p.total_stock > 0 ? 'orange' : 'red'}>
                          {p.total_stock > p.min_stock ? 'In Stock' : p.total_stock > 0 ? 'Low Stock' : 'Out of Stock'}
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/inventory/products/${p.id}`)} icon={<Eye size={14} />} title="View & Edit Details">
                          Manage
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDuplicate(p)} icon={<Copy size={14} className="text-blue-600" />} title="Duplicate Product">
                          Copy
                        </Button>
                        {p.archived || p.status === 'Archived' ? (
                          <Button variant="ghost" size="sm" onClick={() => handleRestore(p.id, p.name)} icon={<RotateCcw size={14} className="text-green-600" />} title="Restore to Active">
                            Restore
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => handleArchive(p.id, p.name)} icon={<Archive size={14} className="text-amber-800" />} title="Archive Product">
                            Archive
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleDeletePermanent(p.id, p.name)} icon={<Trash2 size={14} className="text-red-600" />} title="Delete Product Permanently">
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Add Product Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Garment Product" size="lg">
        <form onSubmit={handleSaveProduct} className="space-y-4">
          {/* Photo upload & Web Link section (100% Free - Zero Firebase Storage cost) */}
          <div className="space-y-3 p-3 border border-amber-100 bg-amber-50/30 rounded-xl">
            <div className="flex gap-4 items-center">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-amber-300 hover:border-amber-500 bg-white flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all shrink-0"
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center text-amber-700/70 p-1 text-center">
                    <ImageIcon size={20} />
                    <span className="text-[10px] font-medium mt-1 leading-tight">Add Photo</span>
                  </div>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageSelect}
                accept="image/*"
                className="hidden"
              />
              <div className="flex-1 space-y-1">
                <p className="text-xs font-semibold text-gray-800">Garment Image (100% Free — Zero Storage Fee)</p>
                <p className="text-[11px] text-gray-500">Device se photo select karein (auto-compressed) ya neeche direct web image link paste karein.</p>
                {imagePreview && (
                  <button
                    type="button"
                    onClick={() => { setImageFile(null); setImagePreview(''); }}
                    className="text-xs text-red-500 hover:underline font-medium"
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </div>

            {/* Direct Image URL Link Input */}
            <div className="pt-2 border-t border-amber-200/50">
              <label className="text-[11px] font-semibold text-amber-900 block mb-1">
                🔗 Ya Direct Image URL / Link Paste Karein (Imgur, Cloudinary, WhatsApp, Google):
              </label>
              <input
                type="url"
                placeholder="https://images.unsplash.com/... or https://i.imgur.com/..."
                value={imagePreview && !imageFile ? imagePreview : ''}
                onChange={e => {
                  const url = e.target.value.trim();
                  setImagePreview(url);
                  if (url) {
                    setImageFile(null);
                  }
                }}
                className="w-full py-1.5 px-2.5 text-xs bg-white rounded-lg border border-amber-200 outline-none focus:border-amber-600 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Product Name *" value={newProd.name} onChange={e => setNewProd({ ...newProd, name: e.target.value })} placeholder="e.g. Cotton Kurta Set" required />
            <Input label="SKU (Leave blank to auto-generate)" value={newProd.sku} onChange={e => setNewProd({ ...newProd, sku: e.target.value })} placeholder="e.g. KUR-COT-01" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Barcode (Code 128)</label>
              <div className="flex gap-2">
                <input
                  value={newProd.barcode}
                  onChange={e => setNewProd({ ...newProd, barcode: e.target.value })}
                  placeholder="e.g. MRG-100234"
                  className="flex-1 py-2 px-3 text-sm rounded-xl border border-gray-200 outline-none focus:border-amber-600"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateBarcode}
                  loading={generatingBarcode}
                  icon={<Sparkles size={13} />}
                >
                  Auto
                </Button>
              </div>
            </div>
            <Input label="Brand / Label" value={newProd.brand} onChange={e => setNewProd({ ...newProd, brand: e.target.value })} placeholder="e.g. Munna Collection, Raymond" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Category</label>
              <select
                value={newProd.category_id}
                onChange={e => setNewProd({ ...newProd, category_id: e.target.value })}
                className="w-full py-2 px-3 text-sm rounded-xl border border-gray-200 outline-none focus:border-amber-600"
              >
                <option value="">Select Category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Gender</label>
              <select
                value={newProd.gender}
                onChange={e => setNewProd({ ...newProd, gender: e.target.value })}
                className="w-full py-2 px-3 text-sm rounded-xl border border-gray-200 outline-none focus:border-amber-600"
              >
                <option value="Men">Men</option>
                <option value="Women">Women</option>
                <option value="Kids">Kids</option>
                <option value="Unisex">Unisex</option>
              </select>
            </div>
            <Input label="Fabric" value={newProd.fabric} onChange={e => setNewProd({ ...newProd, fabric: e.target.value })} placeholder="Cotton, Silk, Denim" />
          </div>

          <div className="grid grid-cols-4 gap-3">
            <Input label="Selling Price *" type="number" value={newProd.selling_price} onChange={e => setNewProd({ ...newProd, selling_price: e.target.value })} placeholder="₹0.00" required />
            <Input label="Purchase Price" type="number" value={newProd.purchase_price} onChange={e => setNewProd({ ...newProd, purchase_price: e.target.value })} placeholder="₹0.00" />
            <Input label="MRP" type="number" value={newProd.mrp} onChange={e => setNewProd({ ...newProd, mrp: e.target.value })} placeholder="₹0.00" />
            <Input label="GST Rate %" type="number" value={newProd.gst_rate} onChange={e => setNewProd({ ...newProd, gst_rate: e.target.value })} placeholder="5" />
          </div>

          {/* Variants section */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold text-gray-700">Stock Variants (Sizes & Colors)</label>
              <Button type="button" variant="ghost" size="sm" onClick={addVariantRow} icon={<Plus size={13} />}>
                Add Variant
              </Button>
            </div>
            <div className="space-y-2 border rounded-xl p-3 bg-gray-50/50">
              {newProd.variants.map((v: any, idx: number) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    value={v.size}
                    onChange={e => {
                      const copy = [...newProd.variants];
                      copy[idx].size = e.target.value;
                      setNewProd({ ...newProd, variants: copy });
                    }}
                    placeholder="Size (S, M, L, 32, 34)"
                    className="w-24 py-1.5 px-2 text-xs border rounded-lg bg-white outline-none focus:border-amber-600"
                  />
                  <input
                    value={v.color}
                    onChange={e => {
                      const copy = [...newProd.variants];
                      copy[idx].color = e.target.value;
                      setNewProd({ ...newProd, variants: copy });
                    }}
                    placeholder="Color (Blue, Red)"
                    className="w-28 py-1.5 px-2 text-xs border rounded-lg bg-white outline-none focus:border-amber-600"
                  />
                  <input
                    type="number"
                    value={v.stock}
                    onChange={e => {
                      const copy = [...newProd.variants];
                      copy[idx].stock = Number(e.target.value);
                      setNewProd({ ...newProd, variants: copy });
                    }}
                    placeholder="Initial Stock"
                    className="w-24 py-1.5 px-2 text-xs border rounded-lg bg-white outline-none focus:border-amber-600"
                  />
                  {newProd.variants.length > 1 && (
                    <button type="button" onClick={() => removeVariantRow(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save Garment Item</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
