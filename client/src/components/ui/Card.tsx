import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
  padding?: 'sm' | 'md' | 'lg' | 'none';
  onClick?: () => void;
}

export default function Card({ children, className = '', hoverable = false, padding = 'md', onClick }: CardProps) {
  const pads = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' };
  return (
    <motion.div
      whileHover={hoverable ? { y: -2, boxShadow: '0 8px 40px rgba(0,0,0,0.10)' } : undefined}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={`bg-white rounded-2xl ${pads[padding]} ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid rgba(201,169,110,0.12)' }}
    >
      {children}
    </motion.div>
  );
}
