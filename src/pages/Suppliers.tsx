import { useState, useEffect } from 'react';
import { Truck, Plus, Search, Download, BookOpen, CreditCard } from 'lucide-react';
import { suppliersApi } from '../api';
import { formatCurrency, formatDate } from '../utils';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonTable } from '../components/ui/Skeleton';
import toast from 'react-hot-toast';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add Supplier Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSupp, setNewSupp] = useState({ name: '', company: '', phone: '', email: '', city: 'Surat', gstin: '', opening_balance: 0 });
  const [saving, setSaving] = useState(false);

  // Supplier Ledger Modal
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [showLedger, setShowLedger] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await suppliersApi.list({ search });
      setSuppliers(res.data.suppliers || []);
    } catch (err) {
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupp.name) {
      toast.error('Contact person name is required');
      return;
    }
    setSaving(true);
    try {
      await suppliersApi.create(newSupp);
      toast.success('Supplier / Mill added');
      setShowAddModal(false);
      setNewSupp({ name: '', company: '', phone: '', email: '', city: 'Surat', gstin: '', opening_balance: 0 });
      fetchSuppliers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add supplier');
    } finally {
      setSaving(false);
    }
  };

  const openLedger = async (supp: any) => {
    try {
      const res = await suppliersApi.get(supp.id);
      setSelectedSupplier(res.data);
      setShowLedger(true);
    } catch (err) {
      toast.error('Failed to load supplier ledger');
    }
  };

  const handlePaySupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      toast.error('Enter valid amount');
      return;
    }
    try {
      await suppliersApi.addPayment(selectedSupplier.supplier.id, {
        amount: Number(paymentAmount),
        payment_method: paymentMethod,
        notes: 'Supplier bill payment',
      });
      toast.success('Payment recorded to supplier!');
      setPaymentAmount('');
      const updated = await suppliersApi.get(selectedSupplier.supplier.id);
      setSelectedSupplier(updated.data);
      fetchSuppliers();
    } catch (err: any) {
      toast.error('Failed to pay supplier');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-gray-900">Wholesale Suppliers & Mills</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage garment vendors, procurement invoices, payables, and debit balances</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} icon={<Plus size={16} />}>
          Add Supplier
        </Button>
      </div>

      <Card padding="none">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); if (!e.target.value) fetchSuppliers(); }}
              onKeyDown={e => e.key === 'Enter' && fetchSuppliers()}
              placeholder="Search by name, company..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 outline-none focus:border-amber-600"
            />
          </div>
        </div>

        {loading ? (
          <SkeletonTable rows={5} />
        ) : suppliers.length === 0 ? (
          <EmptyState
            title="No suppliers found"
            description="Add your fabric suppliers, wholesalers, and manufacturers."
            icon={<Truck size={32} />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-amber-50/40 text-xs text-amber-900 border-b border-amber-100">
                <tr>
                  <th className="py-3 px-4 font-semibold">Vendor / Mill</th>
                  <th className="py-3 px-4 font-semibold">Contact Person</th>
                  <th className="py-3 px-4 font-semibold">City / Hub</th>
                  <th className="py-3 px-4 font-semibold">GSTIN</th>
                  <th className="py-3 px-4 font-semibold text-right">Total Inward</th>
                  <th className="py-3 px-4 font-semibold text-right">Our Payable Due</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {suppliers.map(s => (
                  <tr key={s.id} className="hover:bg-amber-50/20">
                    <td className="py-3 px-4 font-bold text-gray-900">{s.company || s.name}</td>
                    <td className="py-3 px-4 text-gray-700">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{s.phone || '-'}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-600">{s.city || 'Ludhiana / Surat'}</td>
                    <td className="py-3 px-4 text-xs font-mono text-gray-500">{s.gstin || '-'}</td>
                    <td className="py-3 px-4 text-right font-medium text-gray-700">{formatCurrency(s.total_purchases || 0)}</td>
                    <td className="py-3 px-4 text-right">
                      {s.total_due > 0 ? (
                        <span className="font-bold text-red-600">{formatCurrency(s.total_due)}</span>
                      ) : (
                        <span className="text-gray-400 font-medium">₹0.00</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => openLedger(s)} icon={<BookOpen size={14} />}>
                        Khata
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add Supplier Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Supplier / Textile Vendor" size="sm">
        <form onSubmit={handleAddSupplier} className="space-y-3">
          <Input label="Company / Mill Name" value={newSupp.company} onChange={e => setNewSupp({ ...newSupp, company: e.target.value })} placeholder="e.g. Vardhman Textiles" />
          <Input label="Contact Person Name *" value={newSupp.name} onChange={e => setNewSupp({ ...newSupp, name: e.target.value })} placeholder="e.g. Rajesh Singhania" required />
          <Input label="Phone Number" value={newSupp.phone} onChange={e => setNewSupp({ ...newSupp, phone: e.target.value })} placeholder="Mobile number" />
          <Input label="City / Textile Market" value={newSupp.city} onChange={e => setNewSupp({ ...newSupp, city: e.target.value })} placeholder="e.g. Surat, Ludhiana, Delhi" />
          <Input label="GSTIN (Optional)" value={newSupp.gstin} onChange={e => setNewSupp({ ...newSupp, gstin: e.target.value })} placeholder="GST number" />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Add Supplier</Button>
          </div>
        </form>
      </Modal>

      {/* Supplier Ledger Modal */}
      <Modal open={showLedger} onClose={() => setShowLedger(false)} title={`Supplier Ledger: ${selectedSupplier?.supplier?.company || selectedSupplier?.supplier?.name || ''}`} size="lg">
        {selectedSupplier && (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200/60 flex justify-between items-center">
              <div>
                <p className="font-bold text-lg text-gray-900">{selectedSupplier.supplier.company || selectedSupplier.supplier.name}</p>
                <p className="text-xs text-gray-500">Contact: {selectedSupplier.supplier.name} · {selectedSupplier.supplier.phone}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 font-semibold uppercase">Payable Due</p>
                <p className="text-xl font-bold text-red-600">
                  {formatCurrency(selectedSupplier.stats?.balance || 0)}
                </p>
              </div>
            </div>

            {/* Quick payout */}
            {(selectedSupplier.stats?.balance || 0) > 0 && (
              <form onSubmit={handlePaySupplier} className="p-3 bg-gray-50 border rounded-xl flex gap-2 items-center">
                <Input
                  type="number"
                  placeholder="Payment Amount (₹)"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(Number(e.target.value))}
                  className="flex-1"
                />
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="py-2 px-3 text-sm rounded-xl border border-gray-200 bg-white"
                >
                  <option value="Bank Transfer">NEFT / RTGS</option>
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                </select>
                <Button type="submit" size="sm" icon={<CreditCard size={14} />}>
                  Record Pay
                </Button>
              </form>
            )}

            <div className="border rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 text-gray-600 border-b">
                  <tr>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Description / Ref</th>
                    <th className="py-2 px-3 text-right">Debit (Paid)</th>
                    <th className="py-2 px-3 text-right">Credit (Purchased)</th>
                    <th className="py-2 px-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {selectedSupplier.ledger?.map((row: any) => (
                    <tr key={row.id}>
                      <td className="py-2 px-3 text-gray-500">{formatDate(row.date)}</td>
                      <td className="py-2 px-3 text-gray-800">{row.description || row.reference_number || '-'}</td>
                      <td className="py-2 px-3 text-right text-green-600 font-medium">{row.debit > 0 ? formatCurrency(row.debit) : '-'}</td>
                      <td className="py-2 px-3 text-right text-gray-900 font-medium">{row.credit > 0 ? formatCurrency(row.credit) : '-'}</td>
                      <td className="py-2 px-3 text-right font-bold text-gray-900">{formatCurrency(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
