import { useState, useEffect } from 'react';
import { Globe, Eye, ExternalLink, QrCode, ToggleLeft, ToggleRight, Sparkles } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { catalogueApi, productsApi } from '../api';
import { formatCurrency } from '../utils';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';

export default function CatalogueManagement() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const catalogueUrl = `${window.location.origin}/catalogue`;

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await productsApi.list({ limit: 50 });
      setProducts(res.data.products || []);
    } catch (err) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const toggleStatus = async (id: number, field: string) => {
    try {
      await catalogueApi.toggleProduct(id, field);
      toast.success('Updated catalogue display status');
      fetchProducts();
    } catch (err) {
      toast.error('Failed to toggle');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-gray-900">Digital Catalogue & Customer Showroom</h1>
          <p className="text-sm text-gray-500 mt-0.5">Control which garments appear on your public website and generate store QR codes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowQR(true)} icon={<QrCode size={15} />}>
            Showroom QR Standee
          </Button>
          <Button onClick={() => window.open(catalogueUrl, '_blank')} icon={<ExternalLink size={15} />}>
            Open Public Site
          </Button>
        </div>
      </div>

      {/* Info card */}
      <Card padding="sm" className="bg-amber-50/50 border-amber-200/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="text-amber-800" size={20} />
            <div>
              <p className="text-xs font-bold text-gray-800">Your Public Web Catalogue Link</p>
              <p className="text-xs text-amber-900 font-mono select-all mt-0.5">{catalogueUrl}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(catalogueUrl); toast.success('Link copied!'); }}>
            Copy URL
          </Button>
        </div>
      </Card>

      <Card padding="none">
        <div className="p-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">Garments Display Settings (Public Showroom)</h3>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs text-gray-600 border-b">
            <tr>
              <th className="py-3 px-4">Garment</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4 text-right">Price</th>
              <th className="py-3 px-4 text-center">Public Catalogue</th>
              <th className="py-3 px-4 text-center">Featured Style</th>
              <th className="py-3 px-4 text-center">New Arrival Badge</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {products.map(p => (
              <tr key={p.id} className="hover:bg-amber-50/20">
                <td className="py-3 px-4 font-medium text-gray-800">{p.name}</td>
                <td className="py-3 px-4 text-xs text-gray-500">{p.category_name}</td>
                <td className="py-3 px-4 text-right font-bold text-gray-900">{formatCurrency(p.selling_price)}</td>
                <td className="py-3 px-4 text-center">
                  <button
                    onClick={() => toggleStatus(p.id, 'show_in_catalogue')}
                    className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-all ${
                      p.show_in_catalogue ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {p.show_in_catalogue ? 'Visible' : 'Hidden'}
                  </button>
                </td>
                <td className="py-3 px-4 text-center">
                  <button
                    onClick={() => toggleStatus(p.id, 'is_featured')}
                    className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-all ${
                      p.is_featured ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {p.is_featured ? '★ Featured' : 'Normal'}
                  </button>
                </td>
                <td className="py-3 px-4 text-center">
                  <button
                    onClick={() => toggleStatus(p.id, 'is_new_arrival')}
                    className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-all ${
                      p.is_new_arrival ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {p.is_new_arrival ? 'New Arrival' : 'Standard'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* QR Code Standee Modal */}
      <Modal open={showQR} onClose={() => setShowQR(false)} title="Printable Storefront QR Standee" size="sm">
        <div className="flex flex-col items-center text-center p-4">
          <div className="p-4 bg-white border-2 border-amber-800/40 rounded-2xl shadow-sm mb-4">
            <QRCodeSVG value={catalogueUrl} size={180} />
          </div>
          <p className="font-serif font-bold text-gray-900 text-base">Munna Readymade Garments</p>
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Dhobwal Bazzar</p>
          <p className="text-xs text-gray-500 mt-2 max-w-xs">
            Scan with your smartphone camera to view our complete collection and WhatsApp orders!
          </p>
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={() => window.print()}>Print Standee</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
