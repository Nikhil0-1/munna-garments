import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, Search, QrCode, Plus, Minus, Trash2, Download, X, Package } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { jsPDF } from 'jspdf';
import { productsApi } from '../../api';
import { formatCurrency, debounce } from '../../utils';
import { useSettingsStore } from '../../store';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import toast from 'react-hot-toast';

interface LabelItem {
  product: any;
  quantity: number;
}

// Render a single barcode SVG and return it
function renderBarcodeSVG(code: string): SVGSVGElement | null {
  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, code, {
      format: 'CODE128',
      width: 1.5,
      height: 40,
      displayValue: true,
      fontSize: 10,
      margin: 4,
      background: '#ffffff',
      lineColor: '#000000',
    });
    return svg;
  } catch {
    return null;
  }
}

export default function Barcode() {
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('sku') || '');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [labelItems, setLabelItems] = useState<LabelItem[]>([]);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const { settings } = useSettingsStore();

  // Pre-select product from URL params
  useEffect(() => {
    const sku = searchParams.get('sku');
    if (sku) {
      productsApi.search(sku).then(res => {
        if (res.data?.length > 0) {
          addProduct(res.data[0]);
        }
      }).catch(() => {});
    }
  }, []);

  const doSearch = useCallback(
    debounce(async (q: string) => {
      if (!q.trim()) { setSearchResults([]); return; }
      setSearching(true);
      try {
        const res = await productsApi.search(q);
        setSearchResults(res.data || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    doSearch(searchQuery);
  }, [searchQuery]);

  const addProduct = (product: any) => {
    const existing = labelItems.find(i => i.product.id === product.id);
    if (existing) {
      setLabelItems(prev => prev.map(i =>
        i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setLabelItems(prev => [...prev, { product, quantity: 1 }]);
    }
    setSearchQuery('');
    setSearchResults([]);
    toast.success(`${product.name} added to label list`);
  };

  const removeItem = (productId: string) => {
    setLabelItems(prev => prev.filter(i => i.product.id !== productId));
  };

  const updateQuantity = (productId: string, qty: number) => {
    if (qty <= 0) { removeItem(productId); return; }
    setLabelItems(prev => prev.map(i =>
      i.product.id === productId ? { ...i, quantity: Math.min(qty, 50) } : i
    ));
  };

  const handleWindowPrint = () => {
    if (labelItems.length === 0) { toast.error('Add at least one product to print'); return; }
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (labelItems.length === 0) { toast.error('Add at least one product to print'); return; }

    setGeneratingPdf(true);
    toast('Generating barcode PDF…', { icon: '⏳' });

    try {
      // A4 dimensions: 210mm × 297mm
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

      const LABEL_W = 48;   // mm per label
      const LABEL_H = 30;   // mm per label
      const COLS = 4;
      const MARGIN_X = 5;
      const MARGIN_Y = 8;
      const GAP_X = 2;
      const GAP_Y = 2;

      const shopName = settings.shop_name || 'MUNNA READYMADE GARMENTS';
      const shopLoc  = settings.shop_location || 'DHOBWAL BAZZAR';

      let col = 0;
      let row = 0;

      const allLabels: { product: any }[] = [];
      labelItems.forEach(item => {
        for (let i = 0; i < item.quantity; i++) {
          allLabels.push({ product: item.product });
        }
      });

      for (let idx = 0; idx < allLabels.length; idx++) {
        const { product } = allLabels[idx];
        const code = product.barcode || product.sku || '';

        const x = MARGIN_X + col * (LABEL_W + GAP_X);
        const y = MARGIN_Y + row * (LABEL_H + GAP_Y);

        // Label border
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.3);
        pdf.rect(x, y, LABEL_W, LABEL_H);

        // Shop name
        pdf.setFontSize(6);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(40, 40, 40);
        pdf.text(shopName.substring(0, 26), x + LABEL_W / 2, y + 4.5, { align: 'center' });

        // Shop location
        pdf.setFontSize(4.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(120, 120, 120);
        pdf.text(shopLoc, x + LABEL_W / 2, y + 7, { align: 'center' });

        // Product name
        pdf.setFontSize(5.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(20, 20, 20);
        const prodName = product.name.length > 28 ? product.name.substring(0, 26) + '…' : product.name;
        pdf.text(prodName, x + LABEL_W / 2, y + 10, { align: 'center' });

        // Barcode image via canvas
        if (code) {
          try {
            const canvas = document.createElement('canvas');
            JsBarcode(canvas, code, {
              format: 'CODE128',
              width: 1.5,
              height: 32,
              displayValue: true,
              fontSize: 8,
              margin: 2,
              background: '#ffffff',
              lineColor: '#000000',
            });
            const imgData = canvas.toDataURL('image/png');
            const barcodeW = 38;
            const barcodeH = 12;
            pdf.addImage(imgData, 'PNG', x + (LABEL_W - barcodeW) / 2, y + 11.5, barcodeW, barcodeH);
          } catch { /* skip barcode if render fails */ }
        }

        // Price & SKU footer
        pdf.setFontSize(5.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(139, 90, 43);
        pdf.text(`MRP: ${formatCurrency(product.mrp || product.selling_price)}`, x + 2, y + LABEL_H - 3);

        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(120, 120, 120);
        pdf.text(product.sku || code, x + LABEL_W - 2, y + LABEL_H - 3, { align: 'right' });

        // Advance grid position
        col++;
        if (col >= COLS) {
          col = 0;
          row++;
          const labelsPerPage = COLS * Math.floor((297 - MARGIN_Y * 2) / (LABEL_H + GAP_Y));
          if (row >= labelsPerPage) {
            row = 0;
            if (idx < allLabels.length - 1) {
              pdf.addPage();
            }
          }
        }
      }

      const totalLabels = allLabels.length;
      const filename = `Munna_Barcode_Labels_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(filename);
      toast.success(`PDF downloaded — ${totalLabels} label${totalLabels !== 1 ? 's' : ''} on ${pdf.getNumberOfPages()} page${pdf.getNumberOfPages() !== 1 ? 's' : ''}`);
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('PDF generation failed. Please try again.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const totalLabels = labelItems.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold font-serif text-gray-900">Barcode Label Generator</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Generate and print retail price tags with barcodes — select products, set quantities, download PDF
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={handleWindowPrint}
            icon={<Printer size={16} />}
            disabled={labelItems.length === 0}
          >
            Browser Print
          </Button>
          <Button
            onClick={handleDownloadPDF}
            icon={<Download size={16} />}
            disabled={labelItems.length === 0 || generatingPdf}
            loading={generatingPdf}
          >
            Download PDF ({totalLabels})
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card className="no-print">
        <div className="relative">
          <label className="text-xs font-semibold text-gray-700 block mb-1.5">Search & Add Products</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by product name, SKU or barcode…"
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {/* Search results dropdown */}
          {searchResults.length > 0 && searchQuery && (
            <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
              {searchResults.map(prod => (
                <button
                  key={prod.id}
                  onClick={() => addProduct(prod)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-50 transition-colors text-left border-b border-gray-50 last:border-0"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#FFF8F0' }}>
                    {prod.images?.[0] ? (
                      <img src={prod.images[0]} alt="" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <Package size={14} className="text-amber-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-800 truncate">{prod.name}</p>
                    <p className="text-xs text-gray-400">{prod.sku} · {formatCurrency(prod.selling_price)}</p>
                  </div>
                  <Plus size={16} className="text-amber-600 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Label list */}
      {labelItems.length > 0 && (
        <Card className="no-print">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Label Queue ({totalLabels} labels)</h2>
            <button
              onClick={() => setLabelItems([])}
              className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
            >
              <X size={12} /> Clear all
            </button>
          </div>
          <div className="space-y-2">
            {labelItems.map(item => (
              <div key={item.product.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/60">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-800 truncate">{item.product.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    SKU: {item.product.sku} · Barcode: {item.product.barcode || 'Not set'} · {formatCurrency(item.product.selling_price)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    className="w-7 h-7 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-red-50 hover:border-red-300 transition-colors"
                  >
                    <Minus size={13} />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={item.quantity}
                    onChange={e => updateQuantity(item.product.id, Number(e.target.value))}
                    className="w-14 text-center text-sm font-semibold border border-gray-200 rounded-lg py-1 outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                    className="w-7 h-7 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-green-50 hover:border-green-300 transition-colors"
                  >
                    <Plus size={13} />
                  </button>
                  <button
                    onClick={() => removeItem(item.product.id)}
                    className="w-7 h-7 rounded-lg border border-red-200 flex items-center justify-center hover:bg-red-50 text-red-500 transition-colors ml-1"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Printable preview sheet */}
      {labelItems.length > 0 ? (
        <div ref={previewRef} className="p-4 bg-gray-100 rounded-2xl">
          <p className="text-xs text-gray-500 mb-3 no-print text-center">
            Preview ({totalLabels} label{totalLabels !== 1 ? 's' : ''}) — Use "Download PDF" for high-quality print output
          </p>
          <div className="bg-white p-4 shadow-sm print-only-content">
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
              {labelItems.flatMap(item =>
                Array.from({ length: item.quantity }, (_, idx) => (
                  <PreviewLabel
                    key={`${item.product.id}-${idx}`}
                    product={item.product}
                    shopName={settings.shop_name || 'MUNNA READYMADE GARMENTS'}
                    shopLoc={settings.shop_location || 'DHOBWAL BAZZAR'}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <Card>
          <div className="py-16 text-center text-gray-400">
            <QrCode size={48} className="mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-gray-500">No products in label queue</p>
            <p className="text-sm mt-1">Search and add garment products above to generate barcode labels.</p>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Preview Label Component ─────────────────────────────────────────────────
function PreviewLabel({ product, shopName, shopLoc }: { product: any; shopName: string; shopLoc: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const code = product.barcode || product.sku || '';

  useEffect(() => {
    if (!svgRef.current || !code) return;
    try {
      JsBarcode(svgRef.current, code, {
        format: 'CODE128',
        width: 1.5,
        height: 36,
        displayValue: true,
        fontSize: 9,
        margin: 3,
        background: '#ffffff',
        lineColor: '#000000',
      });
    } catch { /* ignore invalid barcode strings */ }
  }, [code]);

  return (
    <div
      className="border border-gray-300 rounded-lg p-2.5 flex flex-col items-center text-center bg-white"
      style={{ height: '120px', pageBreakInside: 'avoid' }}
    >
      <p className="font-serif font-bold text-[9px] text-gray-900 uppercase tracking-wide leading-tight">{shopName.substring(0, 24)}</p>
      <p className="text-[7px] text-gray-400 uppercase tracking-widest mb-0.5">{shopLoc}</p>
      <p className="font-semibold text-[10px] text-gray-800 line-clamp-1">{product.name}</p>
      {code ? (
        <svg ref={svgRef} className="max-w-full flex-1" />
      ) : (
        <div className="flex-1 flex items-center justify-center text-[9px] text-red-400">No barcode</div>
      )}
      <div className="w-full flex justify-between items-baseline px-0.5 border-t border-gray-100 pt-1 mt-auto">
        <span className="text-[8px] text-gray-400 font-mono">{product.sku}</span>
        <span className="font-bold text-[10px] text-amber-900">{formatCurrency(product.selling_price)}</span>
      </div>
    </div>
  );
}
