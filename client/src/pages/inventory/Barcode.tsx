import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, Search, QrCode } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { productsApi } from '../../api';
import { formatCurrency } from '../../utils';
import { useSettingsStore } from '../../store';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import toast from 'react-hot-toast';

export default function Barcode() {
  const [searchParams] = useSearchParams();
  const [sku, setSku] = useState(searchParams.get('sku') || '');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [labelQty, setLabelQty] = useState(8);
  const barcodeRefs = useRef<(SVGSVGElement | null)[]>([]);
  const { settings } = useSettingsStore();

  useEffect(() => {
    if (sku) {
      productsApi.search(sku).then(res => {
        if (res.data?.length > 0) setSelectedProduct(res.data[0]);
      }).catch(() => {});
    }
  }, [sku]);

  useEffect(() => {
    if (selectedProduct) {
      const code = selectedProduct.barcode || selectedProduct.sku;
      barcodeRefs.current.forEach(el => {
        if (el) {
          try {
            JsBarcode(el, code, {
              format: 'CODE128',
              width: 1.5,
              height: 40,
              displayValue: true,
              fontSize: 10,
              margin: 4,
            });
          } catch (e) {}
        }
      });
    }
  }, [selectedProduct, labelQty]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold font-serif text-gray-900">Garment Tag & Barcode Generator</h1>
          <p className="text-sm text-gray-500 mt-0.5">Generate and print retail price tags with barcode for cloth hangers & packaging</p>
        </div>
        <Button onClick={handlePrint} icon={<Printer size={16} />} disabled={!selectedProduct}>
          Print Tags
        </Button>
      </div>

      <Card className="no-print">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-gray-700 block mb-1">Search Product SKU or Name</label>
            <div className="flex gap-2">
              <input
                value={sku}
                onChange={e => setSku(e.target.value)}
                placeholder="Enter SKU (e.g. MRG-KUR-01)..."
                className="flex-1 py-2 px-3 text-sm rounded-xl border border-gray-200 outline-none focus:border-amber-600"
              />
              <Button onClick={() => {
                productsApi.search(sku).then(res => {
                  if (res.data?.length > 0) setSelectedProduct(res.data[0]);
                  else toast.error('Product not found');
                });
              }} icon={<Search size={15} />}>
                Find
              </Button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">Labels to Print</label>
            <input
              type="number"
              min="1"
              max="40"
              value={labelQty}
              onChange={e => setLabelQty(Number(e.target.value))}
              className="w-full py-2 px-3 text-sm rounded-xl border border-gray-200 outline-none focus:border-amber-600"
            />
          </div>
        </div>
      </Card>

      {/* Printable Sheet */}
      {selectedProduct ? (
        <div className="p-4 bg-gray-100 rounded-2xl flex justify-center">
          <div className="bg-white p-6 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-4" style={{ width: '100%', maxWidth: '210mm' }}>
            {Array.from({ length: labelQty }).map((_, idx) => (
              <div
                key={idx}
                className="border border-gray-300 rounded-lg p-2.5 flex flex-col items-center justify-between text-center bg-white"
                style={{ height: '50mm', pageBreakInside: 'avoid' }}
              >
                <div>
                  <p className="font-serif font-bold text-[10px] text-gray-900 leading-tight uppercase tracking-wider">{settings.shop_name || 'MUNNA READYMADE'}</p>
                  <p className="text-[8px] text-gray-400 uppercase tracking-widest">{settings.shop_location || 'DHOBWAL BAZZAR'}</p>
                  <p className="font-semibold text-xs text-gray-800 mt-1 line-clamp-1">{selectedProduct.name}</p>
                </div>

                <svg ref={el => { barcodeRefs.current[idx] = el; }} className="max-w-full" />

                <div className="w-full flex justify-between items-baseline px-1 border-t border-gray-100 pt-1">
                  <span className="text-[9px] text-gray-500 font-mono">{selectedProduct.sku}</span>
                  <span className="font-bold text-xs text-amber-900">{formatCurrency(selectedProduct.selling_price)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Card className="no-print">
          <div className="py-12 text-center text-gray-400">
            <QrCode size={40} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Search and select a garment product above to generate retail price & barcode tags.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
