import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-8 text-center"
    >
      {icon && (
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg,rgba(201,169,110,0.1),rgba(201,169,110,0.05))' }}>
          <div style={{ color: '#C9A96E' }}>{icon}</div>
        </div>
      )}
      <h3 className="text-lg font-semibold mb-2" style={{ color: '#2D2D2D' }}>{title}</h3>
      {description && <p className="text-sm mb-6 max-w-xs" style={{ color: '#8B8B8B' }}>{description}</p>}
      {action}
    </motion.div>
  );
}
