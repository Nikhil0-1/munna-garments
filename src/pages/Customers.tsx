import { useState, useEffect } from 'react';
import { Users, Plus, Search, Phone, Download, BookOpen, CreditCard } from 'lucide-react';
import { customersApi, exportApi } from '../api';
import { formatCurrency, formatDate, downloadBlob } from '../utils';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonTable } from '../components/ui/Skeleton';
import toast from 'react-hot-toast';

export default function Customers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', phone: '', email: '', address: '', city: 'Jalandhar', opening_balance: 0 });
  const [saving, setSaving] = useState(false);

  // Customer Ledger Modal
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showLedger, setShowLedger] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await customersApi.list({ search });
      setCustomers(res.data.customers || []);
    } catch (err) {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCust.name) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      await customersApi.create(newCust);
      toast.success('Customer added');
      setShowAddModal(false);
      setNewCust({ name: '', phone: '', email: '', address: '', city: 'Jalandhar', opening_balance: 0 });
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add customer');
    } finally {
      setSaving(false);
    }
  };

  const openLedger = async (cust: any) => {
    try {
      const res = await customersApi.get(cust.id);
      setSelectedCustomer(res.data);
      setShowLedger(true);
    } catch (err) {
      toast.error('Failed to load customer details');
    }
  };

  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      toast.error('Enter valid amount');
      return;
    }
    try {
      await customersApi.addPayment(selectedCustomer.customer.id, {
        amount: Number(paymentAmount),
        payment_method: paymentMethod,
        notes: 'Customer ledger settlement',
      });
      toast.success('Payment received & ledger credited!');
      setPaymentAmount('');
      const updated = await customersApi.get(selectedCustomer.customer.id);
      setSelectedCustomer(updated.data);
      fetchCustomers();
    } catch (err: any) {
      toast.error('Failed to record payment');
    }
  };

  const handleExport = async () => {
    try {
      const res = await exportApi.customers();
      downloadBlob(res.data, `Customers_Directory_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Customers exported to Excel');
    } catch (err) {
      toast.error('Export failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-gray-900">Customer Accounts & Khata</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage regular shoppers, purchase records, balances, and payment collections</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport} icon={<Download size={15} />}>
            Export
          </Button>
          <Button onClick={() => setShowAddModal(true)} icon={<Plus size={16} />}>
            Add Customer
          </Button>
        </div>
      </div>

      <Card padding="none">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); if (!e.target.value) fetchCustomers(); }}
              onKeyDown={e => e.key === 'Enter' && fetchCustomers()}
              placeholder="Search by name or phone..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 outline-none focus:border-amber-600"
            />
          </div>
        </div>

        {loading ? (
          <SkeletonTable rows={6} />
        ) : customers.length === 0 ? (
          <EmptyState
            title="No customers found"
            description="Add your retail shoppers and regular clients to start tracking credit balance."
            icon={<Users size={32} />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-amber-50/40 text-xs text-amber-900 border-b border-amber-100">
                <tr>
                  <th className="py-3 px-4 font-semibold">Customer</th>
                  <th className="py-3 px-4 font-semibold">Phone</th>
                  <th className="py-3 px-4 font-semibold">Location</th>
                  <th className="py-3 px-4 font-semibold text-right">Total Purchases</th>
                  <th className="py-3 px-4 font-semibold text-right">Total Paid</th>
                  <th className="py-3 px-4 font-semibold text-right">Khata Due</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map(c => (
                  <tr key={c.id} className="hover:bg-amber-50/20">
                    <td className="py-3 px-4 font-bold text-gray-900">{c.name}</td>
                    <td className="py-3 px-4 text-xs font-mono text-gray-600">{c.phone || '-'}</td>
                    <td className="py-3 px-4 text-xs text-gray-500">{[c.city, c.state].filter(Boolean).join(', ') || 'Dhobwal Bazzar'}</td>
                    <td className="py-3 px-4 text-right font-medium text-gray-700">{formatCurrency(c.total_purchases || 0)}</td>
                    <td className="py-3 px-4 text-right text-green-600 font-medium">{formatCurrency(c.total_paid || 0)}</td>
                    <td className="py-3 px-4 text-right">
                      {(c.balance || c.total_due) > 0 ? (
                        <span className="font-bold text-red-600">{formatCurrency(c.balance || c.total_due)}</span>
                      ) : (
                        <span className="text-gray-400 font-medium">₹0.00</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => openLedger(c)} icon={<BookOpen size={14} />}>
                        Khata Ledger
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add Customer Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Retail Customer" size="sm">
        <form onSubmit={handleAddCustomer} className="space-y-3">
          <Input label="Customer Full Name *" value={newCust.name} onChange={e => setNewCust({ ...newCust, name: e.target.value })} placeholder="e.g. Ramesh Kumar" required />
          <Input label="Phone Number" value={newCust.phone} onChange={e => setNewCust({ ...newCust, phone: e.target.value })} placeholder="10-digit mobile" />
          <Input label="City / Area" value={newCust.city} onChange={e => setNewCust({ ...newCust, city: e.target.value })} placeholder="Dhobwal Bazzar" />
          <Input label="Opening Credit Balance" type="number" value={newCust.opening_balance} onChange={e => setNewCust({ ...newCust, opening_balance: Number(e.target.value) })} placeholder="0" />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Add Customer</Button>
          </div>
        </form>
      </Modal>

      {/* Ledger Modal */}
      <Modal open={showLedger} onClose={() => setShowLedger(false)} title={`Customer Khata: ${selectedCustomer?.customer?.name || ''}`} size="lg">
        {selectedCustomer && (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200/60 flex justify-between items-center">
              <div>
                <p className="font-bold text-lg text-gray-900">{selectedCustomer.customer.name}</p>
                <p className="text-xs text-gray-500">Contact: {selectedCustomer.customer.phone || 'N/A'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 font-semibold uppercase">Outstanding Due Balance</p>
                <p className="text-xl font-bold text-red-600">
                  {formatCurrency(selectedCustomer.stats?.balance || 0)}
                </p>
              </div>
            </div>

            {/* Quick payment collection */}
            {(selectedCustomer.stats?.balance || 0) > 0 && (
              <form onSubmit={handleCollectPayment} className="p-3 bg-gray-50 border rounded-xl flex gap-2 items-center">
                <Input
                  type="number"
                  placeholder="Amount Received (₹)"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(Number(e.target.value))}
                  className="flex-1"
                />
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="py-2 px-3 text-sm rounded-xl border border-gray-200 bg-white"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank">Bank</option>
                </select>
                <Button type="submit" size="sm" icon={<CreditCard size={14} />}>
                  Collect
                </Button>
              </form>
            )}

            <div className="border rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 text-gray-600 border-b">
                  <tr>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Description / Ref</th>
                    <th className="py-2 px-3 text-right">Debit (Sale)</th>
                    <th className="py-2 px-3 text-right">Credit (Paid)</th>
                    <th className="py-2 px-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {selectedCustomer.ledger?.map((row: any) => (
                    <tr key={row.id}>
                      <td className="py-2 px-3 text-gray-500">{formatDate(row.date)}</td>
                      <td className="py-2 px-3 text-gray-800">{row.description || row.reference_number || '-'}</td>
                      <td className="py-2 px-3 text-right text-gray-900 font-medium">{row.debit > 0 ? formatCurrency(row.debit) : '-'}</td>
                      <td className="py-2 px-3 text-right text-green-600 font-medium">{row.credit > 0 ? formatCurrency(row.credit) : '-'}</td>
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
