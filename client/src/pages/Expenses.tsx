import { useState, useEffect } from 'react';
import { Receipt, Plus, Download, Trash2, Tag, Calendar } from 'lucide-react';
import { expensesApi, exportApi } from '../api';
import { formatCurrency, formatDate, downloadBlob } from '../utils';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonTable } from '../components/ui/Skeleton';
import toast from 'react-hot-toast';

const EXPENSE_CATEGORIES = ['Shop Rent', 'Staff Salary', 'Electricity & Power', 'Packaging & Bags', 'Tea & Refreshment', 'Store Maintenance', 'Transportation / Rickshaw', 'Marketing & Printing', 'Miscellaneous'];

export default function Expenses() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [totalExpense, setTotalExpense] = useState(0);
  const [loading, setLoading] = useState(true);

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    category: 'Shop Rent',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    payment_method: 'Cash',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await expensesApi.list();
      setExpenses(res.data.expenses || []);
      setTotalExpense(res.data.total || 0);
    } catch (err) {
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error('Please enter an amount');
      return;
    }
    setSaving(true);
    try {
      await expensesApi.create({
        ...form,
        amount: Number(form.amount),
      });
      toast.success('Expense recorded');
      setShowAdd(false);
      setForm({
        category: 'Shop Rent',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        payment_method: 'Cash',
        description: '',
      });
      fetchExpenses();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to record expense');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await expensesApi.delete(id);
      toast.success('Expense removed');
      fetchExpenses();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const handleExport = async () => {
    try {
      const res = await exportApi.expenses();
      downloadBlob(res.data, `Shop_Expenses_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Expenses exported to Excel');
    } catch (err) {
      toast.error('Export failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-gray-900">Daily Shop Expenses</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track store overheads, rent, salaries, electricity, and packaging supplies</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport} icon={<Download size={15} />}>
            Export
          </Button>
          <Button onClick={() => setShowAdd(true)} icon={<Plus size={16} />}>
            Record Expense
          </Button>
        </div>
      </div>

      <Card padding="none">
        <div className="p-4 bg-amber-50/40 border-b border-amber-100 flex justify-between items-center">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Recorded Overheads</span>
          <span className="text-lg font-bold text-red-600">{formatCurrency(totalExpense)}</span>
        </div>

        {loading ? (
          <SkeletonTable rows={6} />
        ) : expenses.length === 0 ? (
          <EmptyState
            title="No expenses recorded"
            description="Log daily operational shop costs to calculate net business profit."
            icon={<Receipt size={32} />}
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-600 border-b">
              <tr>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold">Description</th>
                <th className="py-3 px-4 font-semibold">Payment Mode</th>
                <th className="py-3 px-4 font-semibold text-right">Amount</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {expenses.map(exp => (
                <tr key={exp.id} className="hover:bg-amber-50/20">
                  <td className="py-3 px-4 text-gray-500 text-xs">{formatDate(exp.date)}</td>
                  <td className="py-3 px-4 font-semibold text-gray-800">{exp.category}</td>
                  <td className="py-3 px-4 text-xs text-gray-600">{exp.description || '-'}</td>
                  <td className="py-3 px-4 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">
                      {exp.payment_method}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-red-600">{formatCurrency(exp.amount)}</td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => handleDelete(exp.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Record Expense Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Record Daily Shop Expense" size="sm">
        <form onSubmit={handleAddExpense} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">Expense Category</label>
            <select
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
              className="w-full py-2 px-3 text-sm rounded-xl border border-gray-200 outline-none focus:border-amber-600"
            >
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <Input
            label="Amount (₹) *"
            type="number"
            min="1"
            value={form.amount}
            onChange={e => setForm({ ...form, amount: e.target.value })}
            placeholder="e.g. 1500"
            required
          />

          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Date"
              type="date"
              value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
              required
            />
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Payment Mode</label>
              <select
                value={form.payment_method}
                onChange={e => setForm({ ...form, payment_method: e.target.value })}
                className="w-full py-2 px-3 text-sm rounded-xl border border-gray-200 outline-none focus:border-amber-600"
              >
                <option value="Cash">Cash Drawer</option>
                <option value="UPI">Shop UPI</option>
                <option value="Bank">Bank Account</option>
              </select>
            </div>
          </div>

          <Input
            label="Description / Remark"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="e.g. Bill payment, bags order"
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save Expense</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
