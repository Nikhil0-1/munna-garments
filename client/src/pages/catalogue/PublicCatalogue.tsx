import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, MapPin, Phone, MessageSquare, ShoppingBag, Sparkles, Filter, ChevronRight } from 'lucide-react';
import { catalogueApi } from '../../api';
import { formatCurrency } from '../../utils';
import Button from '../../components/ui/Button';

export default function PublicCatalogue() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [shopSettings, setShopSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [selectedGender, setSelectedGender] = useState('');
  const navigate = useNavigate();

  const fetchShowroom = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (search) params.search = search;
      if (selectedCat) params.category = selectedCat;
      if (selectedGender) params.gender = selectedGender;

      const res = await catalogueApi.products(params);
      setProducts(res.data.products || []);
      setCategories(res.data.categories || []);
      setShopSettings(res.data.shopSettings || {});
    } catch (err) {
      console.error(err);
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

  const whatsappShopNumber = (shopSettings.shop_whatsapp || '+919876543210').replace(/\D/g, '');

  return (
    <div className="min-h-screen bg-[#FAF9F7] text-gray-800 flex flex-col">
      {/* Top Banner */}
      <div className="bg-[#1A1A2E] text-white py-2 px-4 text-center text-xs tracking-wider uppercase font-semibold">
        ✨ Welcome to {shopSettings.shop_name || 'Munna Readymade Garments'} · Dhobwal Bazzar Collection
      </div>

      {/* Hero Header */}
      <header className="bg-white border-b border-amber-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <span className="font-serif font-bold text-xl md:text-2xl text-gray-900 tracking-tight">
              {shopSettings.shop_name || 'MUNNA READYMADE GARMENTS'}
            </span>
            <p className="text-xs text-amber-800 font-semibold tracking-widest uppercase">
              {shopSettings.shop_location || 'DHOBWAL BAZZAR'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={`https://wa.me/${whatsappShopNumber}?text=Hello%20Munna%20Readymade%20Garments,%20I%20want%20to%20inquire%20about%20your%20collection`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
            >
              <MessageSquare size={14} />
              <span className="hidden sm:inline">WhatsApp Inquiries</span>
            </a>
            <Button size="sm" variant="outline" onClick={() => navigate('/login')}>
              Staff Login
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-gradient-to-b from-amber-50/60 to-transparent py-10 px-4 text-center border-b border-amber-100/50">
        <div className="max-w-2xl mx-auto">
          <span className="px-3 py-1 bg-amber-100/80 text-amber-900 text-xs font-bold rounded-full uppercase tracking-wider mb-3 inline-block">
            Premium Cloth & Apparel
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-gray-900 mt-2">
            Quality Fashion, Affordable Prices
          </h2>
          <p className="text-gray-500 text-sm mt-2 max-w-md mx-auto">
            Browse our latest readymade suits, shirts, kurtis, jeans, and bridal apparel. Visit us at Dhobwal Bazzar or order on WhatsApp!
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="mt-6 flex gap-2 max-w-md mx-auto">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search styles, fabrics, kurtis..."
                className="w-full pl-10 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-amber-600 shadow-sm"
              />
            </div>
            <Button type="submit">Search</Button>
          </form>
        </div>
      </div>

      {/* Category Pills */}
      <div className="max-w-6xl mx-auto px-4 py-6 w-full">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedCat('')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCat === '' ? 'bg-amber-900 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            All Apparel
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCat(c.slug)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCat === c.slug ? 'bg-amber-900 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <main className="max-w-6xl mx-auto px-4 pb-16 flex-1 w-full">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm h-64 shimmer" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-base font-semibold text-gray-700">No styles found</p>
            <p className="text-xs text-gray-400 mt-1">Try changing your search keywords or category filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
            {products.map(p => (
              <motion.div
                key={p.id}
                whileHover={{ y: -4, boxShadow: '0 12px 30px rgba(0,0,0,0.08)' }}
                className="bg-white rounded-2xl overflow-hidden border border-amber-100/70 shadow-sm flex flex-col justify-between transition-all group"
              >
                <div>
                  {/* Thumbnail Banner */}
                  <div className="h-44 bg-gradient-to-br from-amber-50 to-orange-50/40 relative flex items-center justify-center p-4">
                    <span className="font-serif text-3xl font-bold text-amber-900/20 uppercase tracking-widest select-none">
                      {p.name.slice(0, 2)}
                    </span>
                    {p.is_new_arrival === 1 && (
                      <span className="absolute top-3 left-3 px-2 py-0.5 bg-purple-600 text-white text-[10px] font-bold rounded-full tracking-wider uppercase shadow-sm">
                        New
                      </span>
                    )}
                    {p.is_featured === 1 && (
                      <span className="absolute top-3 right-3 px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full tracking-wider uppercase shadow-sm">
                        Featured
                      </span>
                    )}
                  </div>

                  <div className="p-4">
                    <p className="text-[10px] font-semibold text-amber-800 tracking-wider uppercase">{p.category_name}</p>
                    <h3 className="font-semibold text-gray-900 text-sm mt-0.5 line-clamp-1">{p.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{[p.fabric, p.gender].filter(Boolean).join(' · ')}</p>

                    {/* Sizes pill */}
                    {p.sizes?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {p.sizes.map((s: string) => (
                          <span key={s} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 pt-0">
                  <div className="flex items-baseline justify-between mb-3 border-t border-gray-100 pt-2">
                    <span className="text-base font-bold text-gray-900">{formatCurrency(p.selling_price)}</span>
                    {p.mrp > p.selling_price && (
                      <span className="text-xs text-gray-400 line-through">{formatCurrency(p.mrp)}</span>
                    )}
                  </div>

                  <a
                    href={`https://wa.me/${whatsappShopNumber}?text=${encodeURIComponent(`Hello, I want to order/inquire about "${p.name}" (SKU: ${p.sku}) listed on your Dhobwal Bazzar website.`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-amber-50 hover:bg-green-600 hover:text-white text-amber-900 rounded-xl text-xs font-semibold transition-all border border-amber-200/60"
                  >
                    <MessageSquare size={13} />
                    WhatsApp Order
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#1A1A2E] text-white py-10 px-4 border-t border-gray-800">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
          <div>
            <p className="font-serif font-bold text-base text-amber-400">MUNNA READYMADE GARMENTS</p>
            <p className="text-gray-400 mt-1">Dhobwal Bazzar Retail & Wholesale Center</p>
            <p className="text-gray-500 mt-2">Specialists in high quality ready-to-wear daily, casual & festival clothing.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-200 uppercase tracking-wider mb-2">Visit Our Shop</p>
            <p className="text-gray-400 flex items-start gap-1">
              <MapPin size={14} className="flex-shrink-0 mt-0.5 text-amber-400" />
              {shopSettings.shop_address || 'Dhobwal Bazzar, Jalandhar, Punjab'}
            </p>
            {shopSettings.shop_phone && (
              <p className="text-gray-400 flex items-center gap-1 mt-2">
                <Phone size={14} className="text-amber-400" /> {shopSettings.shop_phone}
              </p>
            )}
          </div>
          <div>
            <p className="font-semibold text-gray-200 uppercase tracking-wider mb-2">Shop Hours</p>
            <p className="text-gray-400">Monday - Sunday</p>
            <p className="text-gray-300 font-bold mt-0.5">9:30 AM - 9:00 PM</p>
            <p className="text-gray-500 mt-4">© 2026 Munna Readymade Garments. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
