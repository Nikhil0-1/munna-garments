import { SelectHTMLAttributes, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
  options: { value: string | number; label: string }[];
  placeholder?: string;
}

export default function Select({ label, error, icon, options, placeholder, className = '', ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-sm font-medium" style={{ color: '#4A4A4A' }}>{label}</label>}
      <div className="relative flex items-center w-full">
        {icon && <span className="absolute left-3 z-10 flex items-center" style={{ color: '#B5A896' }}>{icon}</span>}
        <select
          className={`w-full appearance-none border border-[#E8E0D5] rounded-[10px] py-2.5 bg-[#FDFBF8] text-sm text-[#2D2D2D] outline-none transition-all duration-200 focus:border-[#C9A96E] focus:shadow-[0_0_0_3px_rgba(201,169,110,0.1)] focus:bg-white ${icon ? 'pl-9' : 'pl-3.5'} pr-9 ${error ? 'border-red-400' : ''} ${className}`}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={16} className="absolute right-3 pointer-events-none" style={{ color: '#B5A896' }} />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
