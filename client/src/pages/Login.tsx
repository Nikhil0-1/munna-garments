import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Sparkles, ShieldCheck, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../api';
import { useAuthStore } from '../store';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '', name: 'Munna Readymade Garments Owner' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isFirstTime, setIsFirstTime] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    authApi.isInitialized().then(res => {
      setIsFirstTime(!res.data.initialized);
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() || !form.password.trim()) {
      setError('Please enter Owner Email and password');
      return;
    }
    setLoading(true);
    setError('');

    try {
      if (isFirstTime) {
        const res = await authApi.setupInitial({
          email: form.email.trim(),
          password: form.password.trim(),
          name: form.name || 'Munna Readymade Garments Owner',
        });
        login(res.data.user, res.data.token);
        toast.success(`Owner account created! Welcome, ${res.data.user.name}`);
        navigate('/dashboard');
      } else {
        const res = await authApi.login({
          email: form.email.trim(),
          password: form.password.trim(),
        });
        login(res.data.user, res.data.token);
        toast.success(`Welcome back, ${res.data.user.name || 'Owner'}!`);
        navigate('/dashboard');
      }
    } catch (err: any) {
      const msg = err.message || err.response?.data?.error || 'Authentication failed. Please check your credentials.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #FFF8F0 0%, #FAF0DC 40%, #F5EFE6 100%)' }}>
      {/* Left panel - Branding */}
      <div className="hidden lg:flex flex-col items-center justify-center flex-1 relative overflow-hidden p-12">
        <div className="absolute top-[-100px] left-[-100px] w-[400px] h-[400px] rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #C9A96E, transparent)' }} />
        <div className="absolute bottom-[-80px] right-[-80px] w-[350px] h-[350px] rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #8B7355, transparent)' }} />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="relative text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', damping: 20 }}
            className="w-24 h-24 rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-2xl"
            style={{ background: 'linear-gradient(135deg, #C9A96E, #8B7355)' }}
          >
            <span className="text-white font-serif font-bold text-4xl">M</span>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            <h1 className="font-serif text-4xl font-bold mb-2" style={{ color: '#2D2D2D', letterSpacing: '0.05em' }}>MUNNA</h1>
            <h2 className="font-serif text-2xl font-medium mb-1" style={{ color: '#8B7355', letterSpacing: '0.08em' }}>READYMADE GARMENTS</h2>
            <p className="text-sm font-medium tracking-widest mb-8" style={{ color: '#B5A896' }}>DHOBWAL BAZZAR</p>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
            <p className="text-lg italic" style={{ color: '#8B7355' }}>"Quality Fashion, Affordable Prices"</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mt-12 grid grid-cols-3 gap-6"
          >
            {[
              { label: 'POS Billing', emoji: '🧾' },
              { label: 'Cloud Inventory', emoji: '☁️' },
              { label: 'Barcode Scanning', emoji: '🏷️' },
              { label: 'Public Showroom', emoji: '🛍️' },
              { label: 'Khata Ledgers', emoji: '👥' },
              { label: 'Owner-Only Access', emoji: '🔒' },
            ].map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.9 + i * 0.08 }}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(201,169,110,0.2)' }}
              >
                <span className="text-2xl">{f.emoji}</span>
                <span className="text-xs font-medium" style={{ color: '#8B7355' }}>{f.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* Right panel - Login form */}
      <div className="flex flex-col items-center justify-center flex-1 lg:max-w-md p-8">
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #C9A96E, #8B7355)' }}>
              <span className="text-white font-serif font-bold text-2xl">M</span>
            </div>
            <h1 className="font-serif text-2xl font-bold" style={{ color: '#2D2D2D' }}>MUNNA READYMADE GARMENTS</h1>
            <p className="text-sm mt-1" style={{ color: '#8B7355' }}>Dhobwal Bazzar</p>
          </div>

          <div className="mb-8">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="text-amber-700" size={20} />
              <span className="text-xs font-bold tracking-widest text-amber-800 uppercase">Shop Administration</span>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900">
              {isFirstTime ? 'Owner Initialization' : 'Owner Sign In'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {isFirstTime
                ? 'Create the primary Owner credentials for Munna Garments'
                : 'Enter your credentials to access POS billing and inventory'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isFirstTime && (
              <Input
                label="Owner Name"
                placeholder="Munna Garments Owner"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            )}

            <Input
              label="Email Address"
              type="email"
              placeholder="owner@munnagarments.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              autoComplete="username"
              autoFocus
              required
            />

            <Input
              label="Password"
              type={showPwd ? 'text' : 'password'}
              placeholder="Enter your password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              autoComplete="current-password"
              required
              rightElement={
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="p-1" style={{ color: '#B5A896' }}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl text-xs text-center font-medium"
                style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
              >
                {error}
              </motion.div>
            )}

            <Button type="submit" className="w-full" size="lg" loading={loading} icon={<Sparkles size={16} />}>
              {isFirstTime ? 'Initialize Owner Account' : 'Sign In as Owner'}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <button
              onClick={() => navigate('/catalogue')}
              className="text-xs text-amber-800 font-semibold hover:underline"
            >
              Browse Public Catalogue →
            </button>
          </div>

          <p className="text-center text-xs mt-6 text-gray-400">
            Munna Readymade Garments © 2026 · Dhobwal Bazzar
          </p>
        </motion.div>
      </div>
    </div>
  );
}
