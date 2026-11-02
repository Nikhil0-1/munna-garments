import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search, MapPin, Phone, MessageSquare, ShoppingBag,
  Sparkles, Filter, ChevronRight, Eye, Tag, AlertCircle, X
} from 'lucide-react';
import { catalogueApi } from '../../api';
import { formatCurrency } from '../../utils';
import { getProductImageUrl } from '../../utils/productImages';
import Button from '../../components/ui/Button';

export default function PublicCatalogue() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [shopSettings, setShopSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [selectedGender, setSelectedGender] = useState('');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();

  const fetchShowroom = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (search.trim()) params.search = search.trim();
      if (selectedCat) params.category = selectedCat;
      if (selectedGender) params.gender = selectedGender;

      const res = await catalogueApi.products(params);
      setProducts(res.data.products || []);
      setCategories(res.data.categories || []);
      setShopSettings(res.data.shopSettings || {});
    } catch (err) {
      console.error('Failed to load catalogue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShowroom();
  }, [selectedCat, selectedGender]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchShowroom();
  };

  const whatsappShopNumber = (shopSettings.shop_whatsapp || shopSettings.shop_phone || '+919876543210').replace(/\D/g, '');

  const buildWhatsAppLink = (p: any) => {
    const hasDiscount = p.mrp > p.selling_price;
    const msg = [
      `Hello Munna Readymade Garments,`,
      ``,
      `I would like to inquire about the following product from your Dhobwal Bazzar showroom:`,
      ``,
      `Product: ${p.name}`,
      `Price: ₹${Number(p.selling_price).toLocaleString('en-IN')}`,
      hasDiscount ? `MRP: ₹${Number(p.mrp).toLocaleString('en-IN')}` : null,
      p.sku ? `SKU: ${p.sku}` : null,
      ``,
      `Catalogue Link: ${window.location.origin}/catalogue/product/${p.slug || p.id}`,
      ``,
      `Please let me know if this garment is available in my size. Thank you!`
    ].filter(Boolean).join('\n');

    return `https://wa.me/${whatsappShopNumber}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="min-h-screen bg-[#FAF9F7] text-gray-800 flex flex-col">
      {/* Top Banner — slim on mobile */}
      <div className="bg-[#1A1A2E] text-white py-1.5 px-3 text-center text-[10px] sm:text-xs tracking-wider uppercase font-semibold">
        ✨ {shopSettings.shop_name || 'Munna Readymade Garments'} · Dhobwal Bazzar
      </div>

      {/* Header — compact on mobile */}
      <header className="bg-white border-b border-amber-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="font-serif font-bold text-base sm:text-xl md:text-2xl text-gray-900 tracking-tight leading-tight truncate">
              Munna Readymade Garments
            </h1>
            <p className="text-[10px] sm:text-xs text-amber-800 font-semibold tracking-widest uppercase">
              DHOBWAL BAZZAR
            </p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <a
              href={`https://wa.me/${whatsappShopNumber}?text=${encodeURIComponent(`Hello Munna Readymade Garments, I would like to inquire about your collection at Dhobwal Bazzar.`)}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-semibold shadow-sm transition-all"
            >
              <MessageSquare size={12} />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>
            <button
              onClick={() => navigate('/login')}
              className="px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-200 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-all"
            >
              Login
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section — smaller on mobile */}
      <div className="bg-gradient-to-b from-amber-50/70 to-transparent py-6 sm:py-10 px-3 sm:px-4 text-center border-b border-amber-100/50">
        <div className="max-w-2xl mx-auto">
          <span className="px-2.5 py-0.5 bg-amber-100/90 text-amber-900 text-[10px] sm:text-xs font-bold rounded-full uppercase tracking-wider inline-block">
            Quality Ready-to-Wear Apparel
          </span>
          <h2 className="font-serif text-xl sm:text-3xl md:text-4xl font-bold text-gray-900 mt-2">
            Quality Fashion, Affordable Prices
          </h2>
          <p className="text-gray-500 text-xs sm:text-sm mt-1.5 sm:mt-2 max-w-md mx-auto leading-relaxed">
            Browse our latest readymade suits, shirts, kurtis, jeans & ethnic clothing. Visit us or order on WhatsApp!
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="mt-4 sm:mt-6 flex gap-1.5 sm:gap-2 max-w-md mx-auto">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search kurtis, shirts, jeans..."
                className="w-full pl-8 sm:pl-10 pr-8 py-2 sm:py-2.5 bg-white border border-gray-200 rounded-lg sm:rounded-xl text-xs sm:text-sm outline-none focus:border-amber-600 shadow-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    fetchShowroom();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-3 sm:px-4 py-2 bg-amber-900 text-white rounded-lg sm:rounded-xl text-xs font-semibold hover:bg-amber-800 transition-colors flex-shrink-0"
            >
              Search
            </button>
          </form>

          {/* Gender Filter Pills */}
          <div className="flex justify-center gap-1.5 sm:gap-2 mt-3 sm:mt-4 flex-wrap">
            {['', 'Men', 'Women', 'Kids'].map(g => (
              <button
                key={g}
                type="button"
                onClick={() => setSelectedGender(g)}
                className={`text-[10px] sm:text-xs px-2.5 sm:px-3 py-1 rounded-full font-medium transition-colors ${
                  selectedGender === g
                    ? 'bg-amber-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-amber-50'
                }`}
              >
                {g || 'All'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-6 w-full">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCat('')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCat === ''
                ? 'bg-amber-900 text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCat(c.slug || c.id)}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCat === (c.slug || c.id)
                  ? 'bg-amber-900 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <main className="max-w-6xl mx-auto px-3 sm:px-4 pb-10 sm:pb-16 flex-1 w-full">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-4 md:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-gray-100 shadow-sm animate-pulse">
                <div className="aspect-[3/4] bg-gray-100 rounded-lg sm:rounded-xl" />
                <div className="space-y-1.5 mt-2 sm:mt-3">
                  <div className="h-3 sm:h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-2.5 sm:h-3 bg-gray-100 rounded w-1/2" />
                </div>
                <div className="h-7 sm:h-8 bg-gray-100 rounded mt-2 sm:mt-3" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 sm:py-20 bg-white rounded-2xl sm:rounded-3xl border border-gray-100 p-6 sm:p-8">
            <ShoppingBag size={40} className="mx-auto text-amber-900/30 mb-3" />
            <h3 className="text-base sm:text-lg font-serif font-bold text-gray-800">No garments found</h3>
            <p className="text-[11px] sm:text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              {search || selectedCat || selectedGender
                ? 'No products matched your search or filters.'
                : 'Products are being updated. Visit our shop at Dhobwal Bazzar or contact us on WhatsApp.'}
            </p>
            {(search || selectedCat || selectedGender) && (
              <button
                onClick={() => { setSearch(''); setSelectedCat(''); setSelectedGender(''); }}
                className="mt-3 text-xs font-semibold text-amber-800 underline"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-4 md:gap-6">
            {products.map(p => {
              const imageUrl = getProductImageUrl(p);
              const hasImage = !!imageUrl && !failedImages[p.id];
              const hasDiscount = p.mrp > p.selling_price;
              const savings = hasDiscount ? p.mrp - p.selling_price : 0;
              const discountPercent = hasDiscount && p.mrp > 0 ? Math.round((savings / p.mrp) * 100) : 0;
              const inStock = p.in_stock !== false;

              return (
                <motion.div
                  key={p.id}
                  whileHover={{ y: -3 }}
                  className="bg-white rounded-xl sm:rounded-2xl overflow-hidden border border-gray-100 shadow-sm flex flex-col group"
                >
                  {/* Product Image */}
                  <div
                    onClick={() => navigate(`/catalogue/product/${p.slug || p.id}`)}
                    className="relative aspect-[3/4] bg-gradient-to-br from-amber-50/60 to-orange-50/30 overflow-hidden cursor-pointer"
                  >
                    {hasImage ? (
                      <img
                        src={imageUrl}
                        alt={p.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                        onError={() => setFailedImages(prev => ({ ...prev, [p.id]: true }))}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-3 select-none">
                        <span className="font-serif text-2xl sm:text-3xl font-bold text-amber-900/15 uppercase tracking-widest">
                          {(p.name || 'MG').slice(0, 2)}
                        </span>
                        <span className="text-[9px] sm:text-[10px] text-amber-900/30 mt-1">Munna Garments</span>
                      </div>
                    )}

                    {/* Badges */}
                    <div className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 flex flex-col gap-0.5 sm:gap-1">
                      {p.is_new_arrival && (
                        <span className="px-1.5 sm:px-2 py-0.5 bg-purple-700 text-white text-[8px] sm:text-[9px] font-bold rounded-full uppercase">
                          New
                        </span>
                      )}
                    </div>

                    {hasDiscount && (
                      <span className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 px-1.5 sm:px-2 py-0.5 bg-rose-600 text-white text-[8px] sm:text-[9px] font-bold rounded-full">
                        {discountPercent}% OFF
                      </span>
                    )}

                    <span className={`absolute bottom-1.5 sm:bottom-2 right-1.5 sm:right-2 px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-bold ${
                      inStock ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                    }`}>
                      {inStock ? 'In Stock' : 'Out'}
                    </span>
                  </div>

                  {/* Card Content */}
                  <div className="p-2.5 sm:p-3.5 flex-1 flex flex-col">
                    <p className="text-[9px] sm:text-[10px] font-bold text-amber-800 tracking-wider uppercase">
                      {p.category_name || 'GARMENT'}
                    </p>
                    <h3
                      onClick={() => navigate(`/catalogue/product/${p.slug || p.id}`)}
                      className="font-semibold text-gray-900 text-xs sm:text-sm mt-0.5 line-clamp-1 cursor-pointer hover:text-amber-800 transition-colors"
                      title={p.name}
                    >
                      {p.name}
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 truncate">
                      {[p.fabric, p.gender].filter(Boolean).join(' · ')}
                    </p>

                    {/* Sizes */}
                    {p.sizes && p.sizes.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 sm:gap-1 mt-1.5 sm:mt-2">
                        {p.sizes.slice(0, 3).map((s: string) => (
                          <span key={s} className="px-1 sm:px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[8px] sm:text-[9px] font-semibold">
                            {s}
                          </span>
                        ))}
                        {p.sizes.length > 3 && (
                          <span className="text-[8px] sm:text-[9px] text-gray-400 self-center">
                            +{p.sizes.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Price */}
                    <div className="mt-2 sm:mt-2.5 pt-1.5 sm:pt-2 border-t border-gray-100">
                      <div className="flex items-baseline gap-1 flex-wrap">
                        <span className="text-sm sm:text-base font-extrabold text-gray-900">
                          {formatCurrency(p.selling_price)}
                        </span>
                        {hasDiscount && (
                          <span className="text-[10px] sm:text-xs text-gray-400 line-through">
                            {formatCurrency(p.mrp)}
                          </span>
                        )}
                      </div>
                      {hasDiscount && (
                        <span className="text-[9px] sm:text-[10px] font-bold text-emerald-700">
                          Save {formatCurrency(savings)}
                        </span>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-1 sm:gap-1.5 mt-2 sm:mt-2.5">
                      <button
                        onClick={() => navigate(`/catalogue/product/${p.slug || p.id}`)}
                        className="py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-[10px] sm:text-xs font-semibold flex items-center justify-center gap-1 transition-colors border border-gray-200"
                      >
                        <Eye size={11} />
                        Details
                      </button>
                      <a
                        href={buildWhatsAppLink(p)}
                        target="_blank"
                        rel="noreferrer"
                        className="py-1.5 bg-amber-50 hover:bg-green-600 hover:text-white text-amber-900 rounded-lg text-[10px] sm:text-xs font-semibold flex items-center justify-center gap-1 transition-all border border-amber-200/80"
                      >
                        <MessageSquare size={11} />
                        WhatsApp
                      </a>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#1A1A2E] text-white py-8 sm:py-10 px-3 sm:px-4 border-t border-gray-800">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-xs">
          <div>
            <p className="font-serif font-bold text-sm sm:text-base text-amber-400">MUNNA READYMADE GARMENTS</p>
            <p className="text-gray-400 mt-1">Dhobwal Bazzar Retail &amp; Wholesale Center</p>
            <p className="text-gray-500 mt-1.5 sm:mt-2 text-[11px]">Quality ready-to-wear daily, casual &amp; festival clothing for the entire family.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-200 uppercase tracking-wider mb-1.5 sm:mb-2 text-[11px]">Visit Our Shop</p>
            <p className="text-gray-400 flex items-start gap-1 text-[11px]">
              <MapPin size={13} className="flex-shrink-0 mt-0.5 text-amber-400" />
              {shopSettings.shop_address || 'Main Road, Dhobwal Bazzar, Jalandhar, Punjab'}
            </p>
            {shopSettings.shop_phone && (
              <p className="text-gray-400 flex items-center gap-1 mt-1.5 text-[11px]">
                <Phone size={13} className="text-amber-400" /> {shopSettings.shop_phone}
              </p>
            )}
          </div>
          <div>
            <p className="font-semibold text-gray-200 uppercase tracking-wider mb-1.5 sm:mb-2 text-[11px]">Business Hours</p>
            <p className="text-gray-400 text-[11px]">Monday – Sunday</p>
            <p className="text-gray-300 font-bold mt-0.5 text-[11px]">9:30 AM – 9:00 PM</p>
            <p className="text-gray-500 mt-3 sm:mt-4 text-[10px]">© 2026 Munna Readymade Garments. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
