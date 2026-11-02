import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Home, ShoppingBag, ShieldCheck } from 'lucide-react';
import Button from '../components/ui/Button';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(135deg, #FFF8F0 0%, #FAF0DC 40%, #F5EFE6 100%)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full bg-white rounded-3xl p-8 text-center shadow-xl border border-amber-100"
      >
        <div
          className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-lg"
          style={{ background: 'linear-gradient(135deg, #C9A96E, #8B7355)' }}
        >
          <span className="text-white font-serif font-bold text-3xl">404</span>
        </div>

        <h1 className="font-serif text-3xl font-bold text-gray-900 mb-2">Page Not Found</h1>
        <p className="text-xs uppercase tracking-widest text-amber-800 font-semibold mb-4">
          Munna Readymade Garments · Dhobwal Bazzar
        </p>

        <p className="text-sm text-gray-500 mb-8 leading-relaxed">
          The page or route you are looking for does not exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="outline"
            onClick={() => navigate('/catalogue')}
            icon={<ShoppingBag size={15} />}
          >
            Public Showroom
          </Button>
          <Button
            onClick={() => navigate('/dashboard')}
            icon={<Home size={15} />}
          >
            Owner Dashboard
          </Button>
        </div>

        <p className="text-[11px] text-gray-400 mt-8">
          © 2026 Munna Readymade Garments · Dhobwal Bazzar
        </p>
      </motion.div>
    </div>
  );
}

