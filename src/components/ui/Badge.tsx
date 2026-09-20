interface BadgeProps {
  children: React.ReactNode;
  color?: 'gold' | 'green' | 'red' | 'blue' | 'purple' | 'orange' | 'gray';
  size?: 'sm' | 'md';
}

export default function Badge({ children, color = 'gold', size = 'sm' }: BadgeProps) {
  const colors = {
    gold: 'bg-amber-50 text-amber-700 border-amber-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    gray: 'bg-gray-50 text-gray-600 border-gray-200',
  };
  const sizes = {
    sm: 'px-2.5 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  };
  return (
    <span className={`inline-flex items-center rounded-full font-semibold border ${colors[color]} ${sizes[size]}`}>
      {children}
    </span>
  );
}
