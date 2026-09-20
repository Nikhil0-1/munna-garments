import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, MapPin, Share2 } from 'lucide-react';
import { catalogueApi } from '../../api';
import { formatCurrency } from '../../utils';
import Button from '../../components/ui/Button';

export default function CatalogueProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!slug) return;
    catalogueApi.product(slug).then(res => {
      setProduct(res.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="p-12 text-center text-gray-500">Loading garment details...</div>;
  if (!product) return <div className="p-12 text-center text-gray-500">Product not found</div>;

  return (
    <div className="min-h-screen bg-[#FAF9F7] text-gray-800">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate('/catalogue')} icon={<ArrowLeft size={16} />}>
          Back to Showroom
        </Button>

        <div className="mt-4 bg-white rounded-3xl p-6 md:p-8 border border-amber-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="h-80 bg-amber-50 rounded-2xl flex items-center justify-center font-serif text-5xl font-bold text-amber-900/30 uppercase">
            {product.name.slice(0, 2)}
          </div>

          <div className="flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold text-amber-800 uppercase tracking-widest">{product.category_name}</span>
              <h1 className="text-2xl font-serif font-bold text-gray-900 mt-1">{product.name}</h1>
              <p className="text-xs text-gray-400 font-mono mt-0.5">SKU: {product.sku}</p>

              <div className="mt-4 flex items-baseline gap-3">
                <span className="text-3xl font-bold text-gray-900">{formatCurrency(product.selling_price)}</span>
                {product.mrp > product.selling_price && (
                  <span className="text-sm text-gray-400 line-through">{formatCurrency(product.mrp)}</span>
                )}
              </div>

              {product.sizes?.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Available Sizes:</p>
                  <div className="flex gap-1.5">
                    {product.sizes.map((s: string) => (
                      <span key={s} className="px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-xs font-bold">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {product.description && (
                <div className="mt-4 text-xs text-gray-600 leading-relaxed">
                  <p className="font-semibold text-gray-800 mb-0.5">About this Garment:</p>
                  <p>{product.description}</p>
                </div>
              )}
            </div>

            <div className="pt-6 border-t mt-6 border-gray-100">
              <a
                href={product.whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold shadow-md transition-all"
              >
                <MessageSquare size={16} />
                Order via WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
