import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { ReactNode, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

export default function Button({
  variant = 'primary', size = 'md', loading, icon, children, disabled, className = '', ...props
}: ButtonProps) {
  const baseStyle = 'inline-flex items-center justify-center gap-2 font-semibold rounded-[10px] transition-all duration-200 cursor-pointer select-none outline-none focus:ring-2 focus:ring-offset-2';

  const variants = {
    primary: 'text-white focus:ring-amber-400',
    secondary: 'bg-[#F5EFE6] text-[#8B7355] hover:bg-[#EDE5D8] focus:ring-amber-400',
    ghost: 'bg-transparent text-[#8B7355] hover:bg-[#F5EFE6] focus:ring-amber-400',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100 focus:ring-red-400',
    outline: 'bg-transparent border border-[#E8E0D5] text-[#6B6B6B] hover:border-[#C9A96E] hover:text-[#8B7355] focus:ring-amber-400',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5',
  };

  const primaryGradient = variant === 'primary' ? { background: 'linear-gradient(135deg,#C9A96E,#8B7355)' } : {};

  return (
    <motion.button
      whileHover={{ scale: disabled || loading ? 1 : 1.02, boxShadow: disabled || loading ? undefined : variant === 'primary' ? '0 4px 16px rgba(201,169,110,0.35)' : undefined }}
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${disabled || loading ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
      style={primaryGradient}
      disabled={disabled || loading}
      {...(props as any)}
    >
      {loading ? <Loader2 size={size === 'sm' ? 12 : 16} className="animate-spin" /> : icon}
      {children}
    </motion.button>
  );
}
