import { forwardRef, InputHTMLAttributes, ReactNode } from 'react';
import { motion } from 'framer-motion';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
  rightElement?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>((
  { label, error, icon, rightElement, className = '', ...props }, ref
) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-sm font-medium" style={{ color: '#4A4A4A' }}>{label}</label>}
      <div className="relative flex items-center w-full">
        {icon && <span className="absolute left-3 flex items-center" style={{ color: '#B5A896' }}>{icon}</span>}
        <input
          ref={ref}
          className={`w-full border border-[#E8E0D5] rounded-[10px] py-2.5 bg-[#FDFBF8] text-sm text-[#2D2D2D] placeholder:text-[#C5B9AC] outline-none transition-all duration-200 focus:border-[#C9A96E] focus:shadow-[0_0_0_3px_rgba(201,169,110,0.1)] focus:bg-white ${icon ? 'pl-9' : 'pl-3.5'} ${rightElement ? 'pr-10' : 'pr-3.5'} ${error ? 'border-red-400 focus:border-red-400 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.1)]' : ''} ${className}`}
          {...props}
        />
        {rightElement && <span className="absolute right-3 flex items-center">{rightElement}</span>}
      </div>
      {error && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-red-500">
          {error}
        </motion.p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
