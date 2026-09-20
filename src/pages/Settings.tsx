import { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, Save, Database, Shield, Store, Printer, Key, Upload, Download } from 'lucide-react';
import { settingsApi, backupApi, authApi } from '../api';
import { useSettingsStore } from '../store';
import { downloadBlob } from '../utils';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import toast from 'react-hot-toast';

export default function Settings() {
  const { settings, setSettings } = useSettingsStore();
  const [form, setForm] = useState<any>({ ...settings });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'store' | 'invoice' | 'backup' | 'password'>('store');

  // Password change
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPass, setChangingPass] = useState(false);

  // Backup
  const [backups, setBackups] = useState<any[]>([]);
  const [creatingBackup, setCreatingBackup] = useState(false);

  useEffect(() => {
    settingsApi.get().then(res => {
      setForm(res.data);
      setSettings(res.data);
    }).catch(() => {});

    backupApi.list().then(res => setBackups(res.data)).catch(() => {});
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsApi.update(form);
      setSettings(form);
      toast.success('Shop settings saved successfully');
    } catch (err: any) {
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setChangingPass(true);
    try {
      await authApi.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      toast.success('Password changed successfully');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Password update failed');
    } finally {
      setChangingPass(false);
    }
  };

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    try {
      await backupApi.create();
      toast.success('Cloud JSON snapshot created successfully!');
      const res = await backupApi.list();
      setBackups(res.data);
    } catch (err: any) {
      toast.error('Backup failed');
    } finally {
      setCreatingBackup(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoring, setRestoring] = useState(false);

  const handleDownloadBackup = (b: any) => {
    if (b.jsonDump) {
      const blob = new Blob([b.jsonDump], { type: 'application/json' });
      downloadBlob(blob, b.filename || 'Munna_Garments_Backup.json');
      toast.success('Backup downloaded');
    } else {
      toast.error('Backup payload not found');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    try {
      const text = await file.text();
      await (backupApi as any).restore(text);
      toast.success('Database restored successfully from backup!');
      const sRes = await settingsApi.get();
      setForm(sRes.data);
      setSettings(sRes.data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to restore backup');
    } finally {
      setRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-serif text-gray-900">System & Shop Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure store information, tax & invoice printing, local database backups, and security</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('store')}
          className={`py-2 px-4 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'store' ? 'border-amber-600 text-amber-900' : 'border-transparent text-gray-500'}`}
        >
          Shop Information
        </button>
        <button
          onClick={() => setActiveTab('invoice')}
          className={`py-2 px-4 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'invoice' ? 'border-amber-600 text-amber-900' : 'border-transparent text-gray-500'}`}
        >
          Invoice & Print Format
        </button>
        <button
          onClick={() => setActiveTab('backup')}
          className={`py-2 px-4 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'backup' ? 'border-amber-600 text-amber-900' : 'border-transparent text-gray-500'}`}
        >
          Database Backups
        </button>
        <button
          onClick={() => setActiveTab('password')}
          className={`py-2 px-4 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'password' ? 'border-amber-600 text-amber-900' : 'border-transparent text-gray-500'}`}
        >
          Security & Password
        </button>
      </div>

      {activeTab === 'store' && (
        <Card>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Shop Official Name" value={form.shop_name} onChange={e => setForm({ ...form, shop_name: e.target.value })} required />
              <Input label="Market / Location" value={form.shop_location} onChange={e => setForm({ ...form, shop_location: e.target.value })} required />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Phone Number" value={form.shop_phone} onChange={e => setForm({ ...form, shop_phone: e.target.value })} />
              <Input label="WhatsApp Number" value={form.shop_whatsapp} onChange={e => setForm({ ...form, shop_whatsapp: e.target.value })} />
              <Input label="GSTIN Number" value={form.shop_gstin} onChange={e => setForm({ ...form, shop_gstin: e.target.value })} placeholder="GST number" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Shop Address" value={form.shop_address} onChange={e => setForm({ ...form, shop_address: e.target.value })} />
              <Input label="City" value={form.shop_city} onChange={e => setForm({ ...form, shop_city: e.target.value })} />
              <Input label="State" value={form.shop_state} onChange={e => setForm({ ...form, shop_state: e.target.value })} />
            </div>

            <Input label="Google Maps Direction Link" value={form.shop_google_maps} onChange={e => setForm({ ...form, shop_google_maps: e.target.value })} />

            <div className="flex justify-end pt-2">
              <Button type="submit" loading={saving} icon={<Save size={15} />}>
                Save Shop Info
              </Button>
            </div>
          </form>
        </Card>
      )}

      {activeTab === 'invoice' && (
        <Card>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Invoice Prefix Code" value={form.invoice_prefix} onChange={e => setForm({ ...form, invoice_prefix: e.target.value })} placeholder="MRG" />
              <Input label="Currency Symbol" value={form.currency_symbol} onChange={e => setForm({ ...form, currency_symbol: e.target.value })} placeholder="₹" />
            </div>

            <Input label="Invoice Thank You Message" value={form.thank_you_message} onChange={e => setForm({ ...form, thank_you_message: e.target.value })} />

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Return & Exchange Policy</label>
              <textarea
                value={form.return_policy}
                onChange={e => setForm({ ...form, return_policy: e.target.value })}
                rows={2}
                className="w-full p-2.5 text-xs rounded-xl border border-gray-200 outline-none focus:border-amber-600"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Terms & Conditions</label>
              <textarea
                value={form.terms_conditions}
                onChange={e => setForm({ ...form, terms_conditions: e.target.value })}
                rows={2}
                className="w-full p-2.5 text-xs rounded-xl border border-gray-200 outline-none focus:border-amber-600"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" loading={saving} icon={<Save size={15} />}>
                Save Invoice Format
              </Button>
            </div>
          </form>
        </Card>
      )}

      {activeTab === 'backup' && (
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">One-Click Cloud & JSON Backup</h3>
                <p className="text-xs text-gray-500 mt-0.5">Creates a complete JSON database snapshot of Products, Customers, Suppliers, Expenses & Settings</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".json"
                  className="hidden"
                />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} loading={restoring} icon={<Upload size={15} />}>
                  Restore JSON Backup
                </Button>
                <Button onClick={handleCreateBackup} loading={creatingBackup} icon={<Database size={15} />}>
                  Create Backup Snapshot
                </Button>
              </div>
            </div>
          </Card>

          <Card padding="none">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900 text-sm">Recent System Backups</h3>
            </div>
            {backups.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                No backup snapshots created yet. Click "Create Backup Snapshot" to safeguard your data.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs text-gray-600 border-b">
                  <tr>
                    <th className="py-2.5 px-4">Backup Filename</th>
                    <th className="py-2.5 px-4">Date Created</th>
                    <th className="py-2.5 px-4">Size</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {backups.map(b => (
                    <tr key={b.id}>
                      <td className="py-2.5 px-4 font-mono text-xs text-gray-800">{b.filename}</td>
                      <td className="py-2.5 px-4 text-xs text-gray-500">{b.created_at}</td>
                      <td className="py-2.5 px-4 text-xs font-semibold text-gray-700">{b.size_formatted || `${(b.size / 1024).toFixed(1)} KB`}</td>
                      <td className="py-2.5 px-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleDownloadBackup(b)} icon={<Download size={14} />}>
                          Download JSON
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'password' && (
        <div className="max-w-md">
          <Card>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <Input
                label="Current Password *"
                type="password"
                value={passwords.currentPassword}
                onChange={e => setPasswords({ ...passwords, currentPassword: e.target.value })}
                required
              />
              <Input
                label="New Password *"
                type="password"
                value={passwords.newPassword}
                onChange={e => setPasswords({ ...passwords, newPassword: e.target.value })}
                required
              />
              <Input
                label="Confirm New Password *"
                type="password"
                value={passwords.confirmPassword}
                onChange={e => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                required
              />
              <div className="pt-2">
                <Button type="submit" loading={changingPass} className="w-full" icon={<Key size={15} />}>
                  Update Admin Password
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
