import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Tag, Layers } from 'lucide-react';
import { categoriesApi } from '../../api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonTable } from '../../components/ui/Skeleton';
import toast from 'react-hot-toast';

export default function Categories() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCat, setEditingCat] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', description: '', sort_order: 0 });
  const [saving, setSaving] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await categoriesApi.list();
      setCategories(res.data);
    } catch (err) {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openAdd = () => {
    setEditingCat(null);
    setFormData({ name: '', description: '', sort_order: categories.length + 1 });
    setShowModal(true);
  };

  const openEdit = (cat: any) => {
    setEditingCat(cat);
    setFormData({ name: cat.name, description: cat.description || '', sort_order: cat.sort_order || 0 });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Category name is required');
      return;
    }
    setSaving(true);
    try {
      if (editingCat) {
        await categoriesApi.update(editingCat.id, formData);
        toast.success('Category updated');
      } else {
        await categoriesApi.create(formData);
        toast.success('Category created');
      }
      setShowModal(false);
      fetchCategories();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      await categoriesApi.delete(id);
      toast.success('Category deleted');
      fetchCategories();
    } catch (err) {
      toast.error('Failed to delete category');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-gray-900">Clothing Categories</h1>
          <p className="text-sm text-gray-500 mt-0.5">Organize items into Kurti, Jeans, Shirts, Sarees, etc.</p>
        </div>
        <Button onClick={openAdd} icon={<Plus size={16} />}>
          Add Category
        </Button>
      </div>

      <Card padding="none">
        {loading ? (
          <SkeletonTable rows={5} />
        ) : categories.length === 0 ? (
          <EmptyState
            title="No categories"
            description="Create categories to organize your garments inventory."
            icon={<Tag size={32} />}
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-amber-50/40 text-xs text-amber-900 border-b border-amber-100">
              <tr>
                <th className="py-3 px-4 font-semibold">Category Name</th>
                <th className="py-3 px-4 font-semibold">Slug</th>
                <th className="py-3 px-4 font-semibold">Description</th>
                <th className="py-3 px-4 font-semibold text-center">Products</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categories.map(cat => (
                <tr key={cat.id} className="hover:bg-amber-50/20">
                  <td className="py-3 px-4 font-bold text-gray-900">{cat.name}</td>
                  <td className="py-3 px-4 text-xs font-mono text-gray-500">{cat.slug}</td>
                  <td className="py-3 px-4 text-gray-600 text-xs">{cat.description || '-'}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded-full font-bold text-xs">
                      {cat.product_count || 0} items
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(cat)} icon={<Edit size={13} />}>Edit</Button>
                    <button onClick={() => handleDelete(cat.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingCat ? 'Edit Category' : 'Add Category'} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Category Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Sarees, Jeans, T-Shirts" required />
          <Input label="Description (Optional)" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Brief description" />
          <Input label="Display Order" type="number" value={formData.sort_order} onChange={e => setFormData({ ...formData, sort_order: Number(e.target.value) })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
