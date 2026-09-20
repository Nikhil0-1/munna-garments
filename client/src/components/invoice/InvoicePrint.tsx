import { useRef } from 'react';
import { Printer, Download, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatCurrency, formatDate } from '../../utils';
import { useSettingsStore } from '../../store';
import Button from '../ui/Button';

interface InvoicePrintProps {
  sale: any;
  items: any[];
  onClose: () => void;
}

export default function InvoicePrint({ sale, items, onClose }: InvoicePrintProps) {
  const { settings } = useSettingsStore();
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const invoiceNumber = sale?.invoice_number || 'INV-0000';
  const invoiceDate = sale?.date ? formatDate(sale.date) : formatDate(new Date().toISOString());
  const customerName = sale?.customer_name || 'Walk-in Customer';
  const customerPhone = sale?.customer_phone || '';

  const subtotal = Number(sale?.subtotal || 0);
  const discountAmount = Number(sale?.discount_amount || 0);
  const gstAmount = Number(sale?.gst_amount || 0);
  const cgstAmount = Number(sale?.cgst_amount || gstAmount / 2);
  const sgstAmount = Number(sale?.sgst_amount || gstAmount / 2);
  const roundOff = Number(sale?.round_off || 0);
  const totalAmount = Number(sale?.total_amount || 0);
  const paidAmount = Number(sale?.paid_amount || 0);
  const dueAmount = Number(sale?.due_amount || 0);
  const paymentMethod = sale?.payment_method || 'Cash';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(26,26,46,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[95vh] overflow-hidden my-auto">
        {/* Modal Controls */}
        <div className="flex items-center justify-between px-6 py-4 no-print" style={{ borderBottom: '1px solid #F0EBE3' }}>
          <h2 className="font-serif font-semibold text-lg">Tax Invoice / Receipt</h2>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handlePrint} icon={<Printer size={15} />}>Print A5</Button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F5EFE6] transition-colors" style={{ color: '#8B7355' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Invoice Printable Area (A5 format) */}
        <div className="flex-1 overflow-y-auto p-8 bg-gray-50 flex justify-center">
          <div
            id="invoice-print"
            ref={printRef}
            className="bg-white p-6 shadow-sm flex flex-col justify-between"
            style={{
              width: '148mm',
              minHeight: '210mm',
              boxSizing: 'border-box',
              fontSize: '11px',
              lineHeight: '1.4',
              color: '#1a1a1a',
              fontFamily: 'Inter, sans-serif'
            }}
          >
            <div>
              {/* Header */}
              <div className="flex justify-between items-start border-b pb-4 border-gray-200">
                <div>
                  <h1 className="font-serif text-xl font-bold tracking-tight text-gray-900">{settings.shop_name || 'MUNNA READYMADE GARMENTS'}</h1>
                  <p className="font-semibold text-xs text-amber-800 tracking-wider uppercase">{settings.shop_location || 'DHOBWAL BAZZAR'}</p>
                  <p className="text-gray-500 mt-1 max-w-[240px] text-[10px]">{settings.shop_address || 'Main Road, Dhobwal Bazzar'}</p>
                  {settings.shop_phone && <p className="text-gray-500 text-[10px]">Ph: {settings.shop_phone}</p>}
                  {settings.shop_gstin && <p className="font-medium text-gray-700 text-[10px]">GSTIN: {settings.shop_gstin}</p>}
                </div>
                <div className="text-right flex flex-col items-end">
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-900 font-bold tracking-widest text-[10px] rounded uppercase mb-2">TAX INVOICE</span>
                  <p className="text-gray-500 text-[10px]">Invoice No:</p>
                  <p className="font-bold text-xs text-gray-900">{invoiceNumber}</p>
                  <p className="text-gray-500 text-[10px] mt-1">Date: <span className="font-medium text-gray-800">{invoiceDate}</span></p>
                </div>
              </div>

              {/* Customer Info */}
              <div className="py-2.5 border-b border-gray-200 flex justify-between text-[10px]">
                <div>
                  <span className="text-gray-400 uppercase font-semibold">Billed To:</span>
                  <p className="font-bold text-gray-800 text-xs mt-0.5">{customerName}</p>
                  {customerPhone && <p className="text-gray-500">Contact: {customerPhone}</p>}
                </div>
                <div className="text-right">
                  <span className="text-gray-400 uppercase font-semibold">Payment Mode:</span>
                  <p className="font-bold text-gray-800 text-xs mt-0.5">{paymentMethod}</p>
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold mt-0.5 ${dueAmount <= 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                    {dueAmount <= 0 ? 'PAID FULL' : 'PARTIAL / DUE'}
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full mt-3 text-left border-collapse text-[10px]">
                <thead>
                  <tr className="border-b border-gray-300 text-gray-600 bg-gray-50 uppercase text-[9px]">
                    <th className="py-1.5 px-2">#</th>
                    <th className="py-1.5 px-2">Item Description</th>
                    <th className="py-1.5 px-1 text-center">Qty</th>
                    <th className="py-1.5 px-2 text-right">Rate</th>
                    <th className="py-1.5 px-1 text-right">Disc</th>
                    <th className="py-1.5 px-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((it: any, index: number) => (
                    <tr key={index}>
                      <td className="py-1.5 px-2 text-gray-400">{index + 1}</td>
                      <td className="py-1.5 px-2">
                        <span className="font-medium text-gray-800">{it.product_name}</span>
                        {(it.size || it.color) && (
                          <span className="text-gray-500 text-[9px] block">
                            {[it.size && `Size: ${it.size}`, it.color && `Color: ${it.color}`].filter(Boolean).join(' | ')}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-1 text-center font-medium">{it.quantity}</td>
                      <td className="py-1.5 px-2 text-right text-gray-600">{formatCurrency(it.selling_price)}</td>
                      <td className="py-1.5 px-1 text-right text-gray-500">{it.discount_amount > 0 ? formatCurrency(it.discount_amount) : '-'}</td>
                      <td className="py-1.5 px-2 text-right font-semibold text-gray-800">{formatCurrency(it.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculations & Footer */}
            <div className="mt-4 pt-2 border-t border-gray-200">
              <div className="flex justify-between items-start">
                <div className="max-w-[200px]">
                  <div className="flex items-center gap-3">
                    <QRCodeSVG value={`https://wa.me/${(settings.shop_whatsapp || '').replace(/\D/g, '')}?text=Invoice%20${invoiceNumber}`} size={56} />
                    <div className="text-[9px] text-gray-500">
                      <p className="font-semibold text-gray-700">Scan for WhatsApp</p>
                      <p>Customer Support & Inquiries</p>
                    </div>
                  </div>
                  <div className="mt-3 text-[8.5px] text-gray-500 italic">
                    <p>{settings.return_policy || 'Goods once sold can be exchanged within 7 days with original invoice.'}</p>
                    <p className="font-medium text-gray-700 mt-0.5">{settings.thank_you_message || 'Thank you for shopping with us!'}</p>
                  </div>
                </div>

                <div className="w-[200px] text-[10px] space-y-1">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount:</span>
                      <span>- {formatCurrency(discountAmount)}</span>
                    </div>
                  )}
                  {gstAmount > 0 && (
                    <>
                      <div className="flex justify-between text-gray-500 text-[9px]">
                        <span>CGST:</span>
                        <span>{formatCurrency(cgstAmount)}</span>
                      </div>
                      <div className="flex justify-between text-gray-500 text-[9px]">
                        <span>SGST:</span>
                        <span>{formatCurrency(sgstAmount)}</span>
                      </div>
                    </>
                  )}
                  {roundOff !== 0 && (
                    <div className="flex justify-between text-gray-500 text-[9px]">
                      <span>Round Off:</span>
                      <span>{roundOff > 0 ? '+' : ''}{formatCurrency(roundOff)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-xs pt-1 border-t border-gray-300 text-gray-900">
                    <span>Net Payable:</span>
                    <span className="text-amber-900">{formatCurrency(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 text-[9px] pt-0.5">
                    <span>Amount Paid:</span>
                    <span>{formatCurrency(paidAmount)}</span>
                  </div>
                  {dueAmount > 0 && (
                    <div className="flex justify-between font-bold text-red-600 text-[9px]">
                      <span>Balance Due:</span>
                      <span>{formatCurrency(dueAmount)}</span>
                    </div>
                  )}
                  <div className="pt-6 text-center text-[9px] text-gray-400">
                    <div className="border-b border-dashed border-gray-300 mb-1 w-24 mx-auto"></div>
                    <span>Authorized Signatory</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
