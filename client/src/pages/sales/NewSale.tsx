import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Minus, Trash2, User, CreditCard, Printer,
  CheckCircle, ShoppingCart, Package, X, Download, RotateCcw, Barcode
} from 'lucide-react';
import toast from 'react-hot-toast';
import { productsApi, salesApi, customersApi } from '../../api';
import { formatCurrency, debounce } from '../../utils';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { useSettingsStore } from '../../store';
import InvoicePrint from '../../components/invoice/InvoicePrint';

interface CartItem {
  product_id: string | number;
  variant_id: string | number | null;
  product_name: string;
  size: string;
  color: string;
  quantity: number;
  mrp: number;
  selling_price: number;
  purchase_price: number;
  discount_percent: number;
  discount_amount: number;
  gst_rate: number;
  gst_amount: number;
  total_amount: number;
  max_stock: number;
}

interface Product {
  id: string | number;
  name: string;
  sku: string;
  barcode?: string;
  selling_price: number;
  mrp: number;
  gst_rate: number;
  category_name: string;
  total_stock: number;
  variants: { id: string | number; size: string; color: string; stock: number; selling_price: number; purchase_price: number; barcode?: string }[];
}

const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Credit'];

export default function NewSale() {
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<{ id: number | null; name: string; phone: string }>({
    id: null, name: 'Walk-in Customer', phone: ''
  });
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [splitPayment, setSplitPayment] = useState(false);
  const [paymentMethod2, setPaymentMethod2] = useState('UPI');
  const [paidAmount2, setPaidAmount2] = useState('');
  const [notes, setNotes] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [loading, setLoading] = useState(false);
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });
  const searchRef = useRef<HTMLInputElement>(null);
  const { settings } = useSettingsStore();

  // Product search
  const debouncedSearch = useCallback(
    debounce(async (q: string) => {
      if (q.length < 1) { setProducts([]); return; }
      try {
        const res = await productsApi.search(q);
        setProducts(res.data);
      } catch {}
    }, 250),
    []
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery]);

  // Customer search
  const debouncedCustomerSearch = useCallback(
    debounce(async (q: string) => {
      if (q.length < 2) { setCustomerResults([]); return; }
      try {
        const res = await customersApi.list({ search: q, limit: 5 });
        setCustomerResults(res.data.customers);
      } catch {}
    }, 300),
    []
  );

  useEffect(() => {
    debouncedCustomerSearch(customerSearch);
  }, [customerSearch]);

  // Calculate totals
  const cartSubtotal = cart.reduce((sum, item) => sum + item.selling_price * item.quantity, 0);
  const cartDiscount = cart.reduce((sum, item) => sum + item.discount_amount, 0);
  const extraDiscount = discountPercent ? (cartSubtotal - cartDiscount) * parseFloat(discountPercent) / 100 : 0;
  const totalDiscount = cartDiscount + extraDiscount;
  const baseAmount = cartSubtotal - totalDiscount;
  const gstAmount = cart.reduce((sum, item) => sum + item.gst_amount, 0);
  const grandTotal = baseAmount + gstAmount;
  const roundOff = Math.round(grandTotal) - grandTotal;
  const finalTotal = Math.round(grandTotal);
  const paid = parseFloat(paidAmount || '0') + parseFloat(paidAmount2 || '0');
  const due = Math.max(0, finalTotal - paid);
  const cgst = gstAmount / 2;
  const sgst = gstAmount / 2;

  function addToCart(product: Product, variant: Product['variants'][0] | null) {
    const itemKey = `${product.id}_${variant?.id || 0}`;
    setCart(prev => {
      const existing = prev.find(i => `${i.product_id}_${i.variant_id || 0}` === itemKey);
      if (existing) {
        if (existing.quantity >= (variant?.stock || product.total_stock)) {
          toast.error('Insufficient stock');
          return prev;
        }
        return prev.map(i =>
          `${i.product_id}_${i.variant_id || 0}` === itemKey
            ? recalcItem({ ...i, quantity: i.quantity + 1 })
            : i
        );
      }
      const sp = variant?.selling_price || product.selling_price;
      const pp = variant?.purchase_price || 0;
      const newItem: CartItem = recalcItem({
        product_id: product.id,
        variant_id: variant?.id || null,
        product_name: product.name,
        size: variant?.size || '',
        color: variant?.color || '',
        quantity: 1,
        mrp: product.mrp || sp,
        selling_price: sp,
        purchase_price: pp,
        discount_percent: 0,
        discount_amount: 0,
        gst_rate: product.gst_rate || 0,
        gst_amount: 0,
        total_amount: 0,
        max_stock: variant?.stock || product.total_stock,
      });
      return [...prev, newItem];
    });
    setSearchQuery('');
    setProducts([]);
  }

  const [barcodeInput, setBarcodeInput] = useState('');
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);

  const handleBarcodeScan = useCallback(async (code: string) => {
    if (!code || !code.trim()) return;
    const cleanCode = code.trim();
    try {
      const res = await productsApi.search(cleanCode);
      const matches = res.data;
      if (!matches || matches.length === 0) {
        setNotFoundBarcode(cleanCode);
        toast.error(`Product not found for barcode: ${cleanCode}`);
        return;
      }

      let targetProduct = matches.find((p: any) => p.barcode === cleanCode || p.sku === cleanCode) || matches[0];
      let targetVariant: any = null;

      if (targetProduct.variants && targetProduct.variants.length > 0) {
        targetVariant = targetProduct.variants.find((v: any) => v.barcode === cleanCode) || targetProduct.variants[0];
      }

      const availableStock = targetVariant ? targetVariant.stock : targetProduct.total_stock;
      if (availableStock <= 0) {
        toast.error(`Insufficient stock for ${targetProduct.name} (${targetVariant?.size || 'Default'})`);
        return;
      }

      addToCart(targetProduct, targetVariant);
      toast.success(`Scanned: ${targetProduct.name} ${targetVariant?.size ? `(${targetVariant.size})` : ''}`);
    } catch {
      toast.error('Failed to scan barcode');
    }
  }, [addToCart]);

  // Global USB Barcode Scanner Keyboard Listener
  useEffect(() => {
    let buffer = '';
    let lastTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      const now = Date.now();
      if (e.key === 'Enter') {
        if (buffer.length >= 3 && now - lastTime < 300) {
          handleBarcodeScan(buffer);
          buffer = '';
        }
        return;
      }

      if (e.key.length === 1) {
        if (now - lastTime > 150) {
          buffer = '';
        }
        buffer += e.key;
        lastTime = now;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleBarcodeScan]);

  function recalcItem(item: CartItem): CartItem {
    const discAmt = (item.selling_price * item.quantity * item.discount_percent) / 100;
    const baseAmt = item.selling_price * item.quantity - discAmt;
    const gstAmt = (baseAmt * item.gst_rate) / 100;
    const totalAmt = baseAmt + gstAmt;
    return { ...item, discount_amount: discAmt, gst_amount: gstAmt, total_amount: totalAmt };
  }

  function updateCartItem(idx: number, updates: Partial<CartItem>) {
    setCart(prev => prev.map((item, i) => i === idx ? recalcItem({ ...item, ...updates }) : item));
  }

  function removeFromCart(idx: number) {
    setCart(prev => prev.filter((_, i) => i !== idx));
  }

  async function createCustomer() {
    if (!newCustomer.name) { toast.error('Name is required'); return; }
    try {
      const res = await customersApi.create(newCustomer);
      setCustomer({ id: res.data.id, name: newCustomer.name, phone: newCustomer.phone });
      setShowCustomerModal(false);
      setNewCustomer({ name: '', phone: '', email: '' });
      toast.success('Customer added');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add customer');
    }
  }

  async function completeSale() {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }

    const actualPaid = paidAmount !== ''
      ? (parseFloat(paidAmount || '0') + parseFloat(paidAmount2 || '0'))
      : (paymentMethod === 'Credit' ? 0 : finalTotal);
    const actualDue = Math.max(0, finalTotal - actualPaid);

    setLoading(true);
    try {
      const saleData = {
        customer_id: customer.id,
        customer_name: customer.name,
        customer_phone: customer.phone,
        items: cart.map(item => ({
          ...item,
          discount_amount: item.discount_amount + (extraDiscount * item.total_amount / (baseAmount || 1)),
        })),
        subtotal: cartSubtotal,
        discount_amount: totalDiscount,
        gst_amount: gstAmount,
        cgst_amount: cgst,
        sgst_amount: sgst,
        igst_amount: 0,
        round_off: roundOff,
        total_amount: finalTotal,
        paid_amount: actualPaid,
        due_amount: actualDue,
        payment_method: paymentMethod,
        payment_method_2: splitPayment ? paymentMethod2 : null,
        paid_amount_2: splitPayment ? parseFloat(paidAmount2 || '0') : 0,
        notes,
      };

      const res = await salesApi.create(saleData);
      const resData = res.data as any;
      const invoiceNum = resData?.invoiceNumber || resData?.invoice_number || resData?.sale?.invoice_number;
      setCompletedSale({
        ...res.data,
        invoiceNumber: invoiceNum,
        sale: res.data.sale || res.data,
        items: res.data.items || res.data.sale?.items || cart,
        shopSettings: settings,
      });
      setShowSuccess(true);
      toast.success(`Sale completed! Invoice: ${invoiceNum}`, { duration: 5000 });

      // Reset cart
      setTimeout(() => {
        setCart([]);
        setCustomer({ id: null, name: 'Walk-in Customer', phone: '' });
        setPaidAmount('');
        setPaidAmount2('');
        setDiscountPercent('');
        setPaymentMethod('Cash');
        setSplitPayment(false);
        setNotes('');
      }, 500);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Sale failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-[calc(100vh-72px)] flex flex-col lg:flex-row gap-4 -m-4 md:-m-6 p-4 md:p-4">
      {/* Left: Product Search & Barcode Entry */}
      <div className="flex-1 flex flex-col min-h-0 lg:max-w-lg">
        {/* Barcode Scanner Direct Input */}
        <div className="relative mb-3 flex gap-2">
          <div className="relative flex-1">
            <Barcode size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-700" />
            <input
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && barcodeInput.trim()) {
                  handleBarcodeScan(barcodeInput.trim());
                  setBarcodeInput('');
                }
              }}
              placeholder="Scan or Enter Barcode (Auto-Add)..."
              className="w-full pl-11 pr-4 py-2.5 text-sm rounded-xl border border-amber-300 bg-amber-50/40 outline-none focus:border-amber-600 focus:bg-white font-mono transition-all placeholder:text-amber-800/50"
            />
          </div>
          <Button
            size="sm"
            onClick={() => {
              if (barcodeInput.trim()) {
                handleBarcodeScan(barcodeInput.trim());
                setBarcodeInput('');
              }
            }}
          >
            Scan
          </Button>
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#B5A896' }} />
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, SKU, fabric..."
            className="w-full pl-11 pr-4 py-2.5 text-sm rounded-xl border border-[#E8E0D5] bg-white outline-none focus:border-[#C9A96E] transition-all"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); setProducts([]); }} className="absolute right-3.5 top-1/2 -translate-y-1/2">
              <X size={16} style={{ color: '#B5A896' }} />
            </button>
          )}
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence>
            {products.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                {products.map((product, i) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="bg-white rounded-xl p-3.5 cursor-pointer hover:shadow-md transition-all"
                    style={{ border: '1px solid rgba(201,169,110,0.15)' }}
                  >
                    <div className="flex items-start gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(201,169,110,0.1)' }}>
                        <Package size={18} style={{ color: '#C9A96E' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{product.name}</p>
                        <p className="text-xs" style={{ color: '#8B8B8B' }}>
                          SKU: {product.sku} · {product.category_name}
                          {product.gst_rate > 0 && ` · GST ${product.gst_rate}%`}
                        </p>
                        <p className="font-bold text-sm mt-0.5" style={{ color: '#C9A96E' }}>{formatCurrency(product.selling_price)}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${product.total_stock > 10 ? 'bg-green-50 text-green-600' : product.total_stock > 0 ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-500'}`}>
                        {product.total_stock > 0 ? `${product.total_stock} pcs` : 'Out'}
                      </span>
                    </div>

                    {product.variants?.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {product.variants.filter(v => v.stock > 0).map(v => (
                          <motion.button
                            key={v.id}
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => addToCart(product, v)}
                            className="text-xs px-2.5 py-1.5 rounded-lg font-medium border transition-all"
                            style={{ borderColor: '#E8E0D5', color: '#6B6B6B', background: '#FDFBF8' }}
                          >
                            {v.size}{v.color ? `/${v.color.substring(0, 3)}` : ''} ({v.stock})
                          </motion.button>
                        ))}
                        {product.variants.filter(v => v.stock > 0).length === 0 && (
                          <span className="text-xs" style={{ color: '#DC2626' }}>Out of stock</span>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(product, null)}
                        disabled={product.total_stock === 0}
                        className="w-full py-1.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg,#C9A96E,#8B7355)' }}
                      >
                        Add to Cart
                      </button>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {!searchQuery && cart.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'rgba(201,169,110,0.08)' }}>
                <Search size={28} style={{ color: '#C9A96E' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: '#8B8B8B' }}>Search for products to add to cart</p>
              <p className="text-xs mt-1" style={{ color: '#B5A896' }}>Search by name, SKU, or scan barcode</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="lg:w-[420px] flex flex-col bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid rgba(201,169,110,0.12)' }}>
        {/* Cart Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #F0EBE3' }}>
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} style={{ color: '#C9A96E' }} />
            <span className="font-semibold" style={{ color: '#2D2D2D' }}>Cart</span>
            {cart.length > 0 && (
              <span className="w-5 h-5 rounded-full text-xs flex items-center justify-center text-white font-bold" style={{ background: '#C9A96E' }}>{cart.length}</span>
            )}
          </div>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-xs flex items-center gap-1 hover:text-red-500 transition-colors" style={{ color: '#8B8B8B' }}>
              <RotateCcw size={12} /> Clear
            </button>
          )}
        </div>

        {/* Customer */}
        <div className="px-4 py-3 relative" style={{ borderBottom: '1px solid #F5EFE6', background: 'rgba(201,169,110,0.03)' }}>
          <div className="flex items-center gap-2">
            <User size={15} style={{ color: '#C9A96E' }} />
            <div className="flex-1">
              <input
                value={customerSearch || customer.name}
                onChange={e => {
                  setCustomerSearch(e.target.value);
                  if (!e.target.value) setCustomer({ id: null, name: 'Walk-in Customer', phone: '' });
                }}
                placeholder="Walk-in Customer"
                className="w-full text-sm bg-transparent outline-none"
                style={{ color: customer.id ? '#2D2D2D' : '#8B8B8B' }}
              />
            </div>
            <button onClick={() => setShowCustomerModal(true)} className="text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(201,169,110,0.1)', color: '#8B7355' }}>
              New
            </button>
          </div>
          {customer.id && (
            <p className="text-xs mt-0.5 pl-5" style={{ color: '#8B8B8B' }}>{customer.phone}</p>
          )}

          {customerResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white rounded-xl shadow-xl z-20 mt-1 mx-2 overflow-hidden" style={{ border: '1px solid rgba(201,169,110,0.15)' }}>
              {customerResults.map(c => (
                <button key={c.id} onClick={() => { setCustomer({ id: c.id, name: c.name, phone: c.phone }); setCustomerSearch(''); setCustomerResults([]); }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#FDFBF8] transition-colors">
                  <span className="font-medium">{c.name}</span>
                  {c.phone && <span className="ml-2 text-xs" style={{ color: '#8B8B8B' }}>{c.phone}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence>
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center p-4">
                <ShoppingCart size={28} style={{ color: '#D4C9BC' }} />
                <p className="text-sm mt-2" style={{ color: '#B5A896' }}>Cart is empty</p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <motion.div
                  key={`${item.product_id}_${item.variant_id}_${idx}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="px-4 py-3"
                  style={{ borderBottom: '1px solid #FAF6F2' }}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product_name}</p>
                      <p className="text-xs" style={{ color: '#8B8B8B' }}>
                        {[item.size, item.color].filter(Boolean).join(' / ')}
                        {item.gst_rate > 0 && ` · GST ${item.gst_rate}%`}
                      </p>
                    </div>
                    <button onClick={() => removeFromCart(idx)} className="p-1 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={13} className="text-red-400" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Qty */}
                    <div className="flex items-center gap-1 rounded-lg overflow-hidden" style={{ border: '1px solid #E8E0D5' }}>
                      <button onClick={() => updateCartItem(idx, { quantity: Math.max(1, item.quantity - 1) })} className="p-1.5 hover:bg-[#F5EFE6] transition-colors">
                        <Minus size={13} style={{ color: '#8B7355' }} />
                      </button>
                      <span className="px-2 text-sm font-medium w-8 text-center">{item.quantity}</span>
                      <button onClick={() => {
                        if (item.quantity >= item.max_stock) { toast.error('Insufficient stock'); return; }
                        updateCartItem(idx, { quantity: item.quantity + 1 });
                      }} className="p-1.5 hover:bg-[#F5EFE6] transition-colors">
                        <Plus size={13} style={{ color: '#8B7355' }} />
                      </button>
                    </div>

                    {/* Rate */}
                    <input
                      type="number"
                      value={item.selling_price}
                      onChange={e => updateCartItem(idx, { selling_price: parseFloat(e.target.value) || 0 })}
                      className="w-20 text-sm text-center border border-[#E8E0D5] rounded-lg py-1.5 outline-none focus:border-[#C9A96E] bg-[#FDFBF8]"
                    />

                    {/* Discount % */}
                    <input
                      type="number"
                      value={item.discount_percent || ''}
                      onChange={e => updateCartItem(idx, { discount_percent: parseFloat(e.target.value) || 0 })}
                      placeholder="Disc%"
                      className="w-16 text-sm text-center border border-[#E8E0D5] rounded-lg py-1.5 outline-none focus:border-[#C9A96E] bg-[#FDFBF8]"
                    />

                    <span className="ml-auto text-sm font-semibold" style={{ color: '#2D2D2D', minWidth: 64, textAlign: 'right' }}>
                      {formatCurrency(item.total_amount)}
                    </span>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Bill Summary */}
        {cart.length > 0 && (
          <div className="px-4 py-3 space-y-2 text-sm" style={{ borderTop: '1px solid #F0EBE3', background: '#FDFBF8' }}>
            <div className="flex justify-between">
              <span style={{ color: '#6B6B6B' }}>Subtotal</span>
              <span>{formatCurrency(cartSubtotal)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>- {formatCurrency(totalDiscount)}</span>
              </div>
            )}
            {gstAmount > 0 && (
              <>
                <div className="flex justify-between text-xs" style={{ color: '#8B8B8B' }}>
                  <span>CGST</span><span>{formatCurrency(cgst)}</span>
                </div>
                <div className="flex justify-between text-xs" style={{ color: '#8B8B8B' }}>
                  <span>SGST</span><span>{formatCurrency(sgst)}</span>
                </div>
              </>
            )}
            {roundOff !== 0 && (
              <div className="flex justify-between text-xs" style={{ color: '#8B8B8B' }}>
                <span>Round Off</span><span>{roundOff > 0 ? '+' : ''}{formatCurrency(Math.abs(roundOff))}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1" style={{ borderTop: '1px solid #E8E0D5', color: '#1A1A2E' }}>
              <span>Total</span><span style={{ color: '#C9A96E' }}>{formatCurrency(finalTotal)}</span>
            </div>

            {/* Extra Discount */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs" style={{ color: '#8B8B8B' }}>Extra Discount %</span>
              <input
                type="number"
                value={discountPercent}
                onChange={e => setDiscountPercent(e.target.value)}
                placeholder="0"
                className="w-16 text-sm text-center border border-[#E8E0D5] rounded-lg py-1 outline-none focus:border-[#C9A96E]"
              />
            </div>

            {/* Payment */}
            <div className="space-y-2 pt-1">
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full text-sm border border-[#E8E0D5] rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E] bg-[#FDFBF8]"
              >
                {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
              </select>

              <div className="flex gap-2">
                <input
                  type="number"
                  value={paidAmount}
                  onChange={e => setPaidAmount(e.target.value)}
                  placeholder={`Paid Amount (${formatCurrency(finalTotal)})`}
                  className="flex-1 text-sm border border-[#E8E0D5] rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E] bg-[#FDFBF8]"
                />
                <button
                  onClick={() => setPaidAmount(String(finalTotal))}
                  className="text-xs px-2 rounded-lg font-medium"
                  style={{ background: 'rgba(201,169,110,0.1)', color: '#8B7355' }}
                >
                  Full
                </button>
              </div>

              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: '#8B8B8B' }}>
                <input type="checkbox" checked={splitPayment} onChange={e => setSplitPayment(e.target.checked)} className="rounded" />
                Split Payment
              </label>

              {splitPayment && (
                <div className="flex gap-2">
                  <select
                    value={paymentMethod2}
                    onChange={e => setPaymentMethod2(e.target.value)}
                    className="text-sm border border-[#E8E0D5] rounded-lg px-2 py-1.5 outline-none focus:border-[#C9A96E]"
                  >
                    {PAYMENT_METHODS.filter(m => m !== paymentMethod).map(m => <option key={m}>{m}</option>)}
                  </select>
                  <input
                    type="number"
                    value={paidAmount2}
                    onChange={e => setPaidAmount2(e.target.value)}
                    placeholder="Amount"
                    className="flex-1 text-sm border border-[#E8E0D5] rounded-lg px-3 py-1.5 outline-none focus:border-[#C9A96E]"
                  />
                </div>
              )}

              {due > 0 && (
                <div className="flex justify-between text-sm font-semibold" style={{ color: '#ef4444' }}>
                  <span>Due / Credit</span><span>{formatCurrency(due)}</span>
                </div>
              )}
            </div>

            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={1}
              className="w-full text-xs border border-[#E8E0D5] rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E] resize-none bg-[#FDFBF8]"
            />

            <Button
              className="w-full"
              size="lg"
              loading={loading}
              onClick={completeSale}
              icon={<CheckCircle size={18} />}
            >
              Complete Sale · {formatCurrency(finalTotal)}
            </Button>
          </div>
        )}
      </div>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccess && completedSale && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div className="absolute inset-0" style={{ background: 'rgba(26,26,46,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowSuccess(false)} />
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', damping: 20 }}
              className="relative bg-white rounded-3xl p-8 text-center max-w-sm w-full"
              style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.15)' }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', damping: 15 }}
                className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}
              >
                <CheckCircle size={36} className="text-white" />
              </motion.div>
              <h2 className="text-xl font-bold mb-1">Sale Complete! 🎉</h2>
              <p className="text-2xl font-bold mb-1" style={{ color: '#C9A96E' }}>{completedSale.invoiceNumber}</p>
              <p className="text-lg font-semibold mb-4" style={{ color: '#2D2D2D' }}>{formatCurrency(finalTotal)}</p>
              {due > 0 && (
                <p className="text-sm mb-4 font-medium" style={{ color: '#ef4444' }}>Due: {formatCurrency(due)}</p>
              )}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" icon={<Printer size={15} />} onClick={() => { setShowSuccess(false); setShowInvoice(true); }}>
                  Print Invoice
                </Button>
                <Button className="flex-1" onClick={() => setShowSuccess(false)}>
                  New Sale
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invoice Print Modal */}
      {showInvoice && completedSale && (
        <InvoicePrint
          sale={completedSale.sale || completedSale || {}}
          items={completedSale.items || completedSale.sale?.items || []}
          onClose={() => setShowInvoice(false)}
        />
      )}

      {/* New Customer Modal */}
      <Modal open={showCustomerModal} onClose={() => setShowCustomerModal(false)} title="Add New Customer" size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCustomerModal(false)}>Cancel</Button>
            <Button onClick={createCustomer}>Add Customer</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Name *" placeholder="Customer name" value={newCustomer.name} onChange={e => setNewCustomer(p => ({ ...p, name: e.target.value }))} />
          <Input label="Phone" placeholder="Mobile number" value={newCustomer.phone} onChange={e => setNewCustomer(p => ({ ...p, phone: e.target.value }))} />
          <Input label="Email" placeholder="Email address" value={newCustomer.email} onChange={e => setNewCustomer(p => ({ ...p, email: e.target.value }))} />
        </div>
      </Modal>
    </div>
  );
}
