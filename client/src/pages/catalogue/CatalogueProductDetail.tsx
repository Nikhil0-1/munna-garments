import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, MessageSquare, MapPin, Phone, Check, Clock,
  ShieldCheck, Sparkles, AlertCircle, Plus, Minus, Tag
} from 'lucide-react';
import { catalogueApi } from '../../api';
import { formatCurrency } from '../../utils';
import { getGarmentCategoryFallback, cleanImageUrl } from '../../utils/productImages';
import Button from '../../components/ui/Button';

export default function CatalogueProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<any>(null);
  const [shopSettings, setShopSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [imageError, setImageError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    catalogueApi.product(slug)
      .then(res => {
        const prod = res.data;
        setProduct(prod);
        if (prod?.sizes && prod.sizes.length > 0) {
          setSelectedSize(prod.sizes[0]);
        }
        if (prod?.colors && prod.colors.length > 0) {
          setSelectedColor(prod.colors[0]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Fetch shop settings for WhatsApp number and contact info
    catalogueApi.products({ limit: 1 })
      .then(res => {
        if (res.data?.shopSettings) {
          setShopSettings(res.data.shopSettings);
        }
      })
      .catch(() => {});
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-serif text-sm text-gray-600">Loading garment details…</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-sm border border-amber-100">
          <AlertCircle size={48} className="mx-auto text-amber-800/40 mb-3" />
          <h2 className="font-serif text-2xl font-bold text-gray-900">Garment Not Found</h2>
          <p className="text-sm text-gray-500 mt-1">This item may have been moved or removed from our published catalogue.</p>
          <div className="mt-6">
            <Button onClick={() => navigate('/catalogue')} icon={<ArrowLeft size={16} />}>
              Return to Public Showroom
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const fallbackImage = getGarmentCategoryFallback(product.name, product.category_name);
  const rawImages: string[] = Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : (product.image_url ? [product.image_url] : [fallbackImage]);
  const images = rawImages.map(img => cleanImageUrl(img));
  const currentImage = images[selectedImageIndex] || fallbackImage;
  const sellingPrice = Number(product.selling_price) || 0;
  const mrp = Number(product.mrp) || 0;
  const hasDiscount = mrp > sellingPrice;
  const savings = hasDiscount ? mrp - sellingPrice : 0;
  const discountPercent = hasDiscount && mrp > 0 ? Math.round((savings / mrp) * 100) : 0;
  const inStock = product.in_stock !== false;

  const handleWhatsAppEnquiry = () => {
    const rawPhone = shopSettings.shop_whatsapp || shopSettings.shop_phone || '+919876543210';
    const whatsappNum = rawPhone.replace(/\D/g, '');
    const productUrl = window.location.href;

    const messageLines = [
      `Hello Munna Readymade Garments,`,
      ``,
      `I am interested in the following product:`,
      ``,
      `Product: ${product.name}`,
      `Price: ₹${sellingPrice.toLocaleString('en-IN')}`,
      hasDiscount ? `MRP: ₹${mrp.toLocaleString('en-IN')}` : null,
      selectedSize ? `Size: ${selectedSize}` : null,
      selectedColor ? `Color: ${selectedColor}` : null,
      `Quantity: ${quantity}`,
      `SKU: ${product.sku || product.id}`,
      ``,
      `Product Link: ${productUrl}`,
      ``,
      `Please confirm availability.`,
      ``,
      `Thank you.`
    ].filter(line => line !== null);

    const fullMessage = messageLines.join('\n');
    const waUrl = `https://wa.me/${whatsappNum}?text=${encodeURIComponent(fullMessage)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#FAF9F7] text-gray-800 flex flex-col">
      {/* Top Banner */}
      <div className="bg-[#1A1A2E] text-white py-2 px-4 text-center text-xs tracking-wider uppercase font-semibold">
        ✨ Munna Readymade Garments · Dhobwal Bazzar Premium Retail Collection
      </div>

      {/* Header */}
      <header className="bg-white border-b border-amber-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <button
            onClick={() => navigate('/catalogue')}
            className="flex items-center gap-2 text-xs font-semibold text-amber-900 hover:text-amber-700 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Back to Showroom</span>
          </button>

          <div className="text-center">
            <span className="font-serif font-bold text-base md:text-lg text-gray-900 tracking-tight">
              {shopSettings.shop_name || 'MUNNA READYMADE GARMENTS'}
            </span>
            <span className="hidden sm:inline text-xs text-amber-800 font-semibold ml-2 tracking-widest uppercase">
              · {shopSettings.shop_location || 'DHOBWAL BAZZAR'}
            </span>
          </div>

          <Button
            size="sm"
            onClick={handleWhatsAppEnquiry}
            className="bg-green-600 hover:bg-green-700 text-white"
            icon={<MessageSquare size={14} />}
          >
            <span className="hidden sm:inline">WhatsApp</span> Enquiry
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full">
        <div className="bg-white rounded-3xl p-6 md:p-10 border border-amber-100/80 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Left Column: Image Showcase */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            {/* Main Stage Image */}
            <div className="aspect-[4/5] rounded-3xl overflow-hidden bg-gradient-to-br from-amber-50 to-orange-50/30 border border-amber-100/70 relative flex items-center justify-center shadow-inner group">
              {currentImage && !imageError ? (
                <img
                  key={currentImage}
                  src={currentImage}
                  alt={product.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="text-center p-6">
                  <span className="font-serif text-6xl font-bold text-amber-900/20 uppercase tracking-widest block mb-2">
                    {product.name ? product.name.slice(0, 2) : 'MRG'}
                  </span>
                  <p className="text-xs font-medium text-amber-900/50">Munna Readymade Garments</p>
                  <p className="text-[11px] text-gray-400 mt-1">Dhobwal Bazzar Collection</p>
                </div>
              )}

              {/* Status Badges */}
              <div className="absolute top-4 left-4 flex flex-col gap-1.5">
                {product.is_new_arrival && (
                  <span className="px-3 py-1 bg-purple-700 text-white text-[11px] font-bold rounded-full uppercase tracking-wider shadow-sm">
                    New Arrival
                  </span>
                )}
                {product.is_featured && (
                  <span className="px-3 py-1 bg-amber-600 text-white text-[11px] font-bold rounded-full uppercase tracking-wider shadow-sm">
                    Featured Style
                  </span>
                )}
                {hasDiscount && (
                  <span className="px-3 py-1 bg-rose-600 text-white text-[11px] font-bold rounded-full uppercase tracking-wider shadow-sm">
                    {discountPercent}% OFF
                  </span>
                )}
              </div>

              {/* Stock Indicator */}
              <div className="absolute bottom-4 right-4">
                <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${
                  inStock
                    ? 'bg-emerald-600 text-white'
                    : 'bg-red-600 text-white'
                }`}>
                  {inStock ? '✓ In Stock' : 'Out of Stock'}
                </span>
              </div>
            </div>

            {/* Thumbnail Strip (if multiple photos) */}
            {images.length > 1 && (
              <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedImageIndex(idx);
                      setImageError(false);
                    }}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${
                      selectedImageIndex === idx
                        ? 'border-amber-700 scale-105 shadow-md'
                        : 'border-gray-200 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Garment Information & Conversion Form */}
          <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
            <div>
              {/* Category & SKU */}
              <div className="flex items-center justify-between text-xs text-amber-800 font-semibold tracking-wider uppercase mb-1">
                <span>{product.category_name || 'Apparel'}</span>
                <span className="font-mono text-gray-400 normal-case">SKU: {product.sku}</span>
              </div>

              {/* Product Title */}
              <h1 className="text-3xl font-serif font-bold text-gray-900 tracking-tight leading-snug">
                {product.name}
              </h1>

              {/* Attributes: Fabric, Brand, Gender */}
              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-500">
                {product.brand && (
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-900 rounded-lg font-medium">
                    {product.brand}
                  </span>
                )}
                {product.fabric && (
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg">
                    Fabric: {product.fabric}
                  </span>
                )}
                {product.gender && (
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg">
                    {product.gender}
                  </span>
                )}
              </div>

              {/* Price & Savings Display */}
              <div className="mt-5 p-4 rounded-2xl bg-amber-50/50 border border-amber-200/50">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-extrabold text-gray-900">
                    {formatCurrency(sellingPrice)}
                  </span>
                  {hasDiscount && (
                    <span className="text-base text-gray-400 line-through">
                      MRP: {formatCurrency(mrp)}
                    </span>
                  )}
                </div>
                {hasDiscount && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-700">
                      You Save {formatCurrency(savings)} ({discountPercent}% OFF)
                    </span>
                    <span className="text-[11px] text-gray-400">Inclusive of all taxes</span>
                  </div>
                )}
              </div>

              {/* Size Selector */}
              {product.sizes && product.sizes.length > 0 && (
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">
                      Select Size:
                    </label>
                    <span className="text-xs font-semibold text-amber-800">{selectedSize || 'Choose size'}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.sizes.map((s: string) => {
                      const isSelected = selectedSize === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSelectedSize(s)}
                          className={`min-w-[44px] h-10 px-3 rounded-xl text-xs font-bold transition-all ${
                            isSelected
                              ? 'bg-amber-900 text-white shadow-md scale-105'
                              : 'bg-white border border-gray-200 text-gray-700 hover:border-amber-700 hover:bg-amber-50/30'
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Color Selector */}
              {product.colors && product.colors.length > 0 && (
                <div className="mt-5">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">
                      Select Color:
                    </label>
                    <span className="text-xs font-semibold text-amber-800">{selectedColor || 'Choose color'}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.colors.map((c: string) => {
                      const isSelected = selectedColor === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setSelectedColor(c)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                            isSelected
                              ? 'bg-amber-900 text-white shadow-md'
                              : 'bg-white border border-gray-200 text-gray-700 hover:border-amber-700'
                          }`}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quantity Counter */}
              <div className="mt-5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-700 block mb-2">
                  Quantity:
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-gray-200 rounded-xl bg-white shadow-xs">
                    <button
                      type="button"
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      className="p-2 text-gray-600 hover:text-amber-900 hover:bg-gray-50 rounded-l-xl transition-colors"
                      disabled={quantity <= 1}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-12 text-center text-sm font-bold text-gray-900 select-none">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(q => q + 1)}
                      className="p-2 text-gray-600 hover:text-amber-900 hover:bg-gray-50 rounded-r-xl transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <span className="text-xs text-gray-400">
                    Total: {formatCurrency(sellingPrice * quantity)}
                  </span>
                </div>
              </div>

              {/* Description */}
              {product.description && (
                <div className="mt-6 pt-5 border-t border-gray-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    About this Garment:
                  </p>
                  <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">
                    {product.description}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Actions & Conversion CTA */}
            <div className="pt-6 border-t border-gray-100 space-y-4">
              <Button
                onClick={handleWhatsAppEnquiry}
                size="lg"
                className="w-full bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20 text-sm font-bold py-3.5"
                icon={<MessageSquare size={18} />}
              >
                Enquire on WhatsApp (Instant Order)
              </Button>

              <p className="text-[11px] text-center text-gray-400">
                Tap above to open WhatsApp with your chosen size, color, quantity &amp; product SKU prefilled.
              </p>

              {/* Trust & Location Box */}
              <div className="p-4 rounded-2xl bg-amber-50/30 border border-amber-100 text-xs text-gray-600 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-gray-800">
                  <ShieldCheck size={16} className="text-amber-800" />
                  <span>Munna Readymade Garments · Dhobwal Bazzar</span>
                </div>
                <p className="text-[11px] text-gray-500 pl-6">
                  {shopSettings.shop_address || 'Main Road, Dhobwal Bazzar, Jalandhar, Punjab'}
                </p>
                <div className="flex items-center gap-4 pl-6 text-[11px] text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock size={12} className="text-amber-700" /> Open 9:30 AM – 9:00 PM
                  </span>
                  {shopSettings.shop_phone && (
                    <span className="flex items-center gap-1">
                      <Phone size={12} className="text-amber-700" /> {shopSettings.shop_phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#1A1A2E] text-white py-8 px-4 border-t border-gray-800 text-center text-xs">
        <p className="font-serif font-bold text-sm text-amber-400">MUNNA READYMADE GARMENTS</p>
        <p className="text-gray-400 mt-1">Dhobwal Bazzar Retail &amp; Wholesale Center</p>
        <p className="text-gray-500 mt-3">© 2026 Munna Readymade Garments. All rights reserved.</p>
      </footer>
    </div>
  );
}
