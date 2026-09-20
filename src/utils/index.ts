// Format currency in INR
export const formatCurrency = (amount: number | string, symbol = '₹'): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return `${symbol}0`;
  return `${symbol}${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Format number
export const formatNumber = (num: number): string => {
  return num.toLocaleString('en-IN');
};

// Format date
export const formatDate = (date: string | Date): string => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (date: string | Date): string => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Today's date
export const today = (): string => new Date().toISOString().split('T')[0];

// Month start
export const monthStart = (): string => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
};

// Download blob
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// Debounce
export const debounce = <T extends (...args: any[]) => any>(fn: T, delay: number) => {
  let timer: any;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

// Calculate GST amounts
export const calculateGST = (baseAmount: number, gstRate: number, gstType: 'CGST_SGST' | 'IGST' = 'CGST_SGST') => {
  const gstAmount = (baseAmount * gstRate) / 100;
  if (gstType === 'IGST') {
    return { igst: gstAmount, cgst: 0, sgst: 0, total: gstAmount };
  }
  const halfGst = gstAmount / 2;
  return { cgst: halfGst, sgst: halfGst, igst: 0, total: gstAmount };
};

// Generate slug
export const slugify = (text: string): string => {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
};

// Status colors
export const getStatusColor = (status: string): string => {
  const map: Record<string, string> = {
    Completed: 'bg-green-100 text-green-700',
    Pending: 'bg-yellow-100 text-yellow-700',
    Cancelled: 'bg-red-100 text-red-700',
    Partial: 'bg-blue-100 text-blue-700',
    Draft: 'bg-gray-100 text-gray-600',
  };
  return map[status] || 'bg-gray-100 text-gray-600';
};

// Payment method colors
export const getPaymentColor = (method: string): string => {
  const map: Record<string, string> = {
    Cash: 'bg-green-100 text-green-700',
    UPI: 'bg-purple-100 text-purple-700',
    Card: 'bg-blue-100 text-blue-700',
    'Bank Transfer': 'bg-indigo-100 text-indigo-700',
    Credit: 'bg-orange-100 text-orange-700',
    'Split Payment': 'bg-pink-100 text-pink-700',
  };
  return map[method] || 'bg-gray-100 text-gray-600';
};

// Greet based on time
export const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

// Chart color palette
export const CHART_COLORS = [
  '#C9A96E', '#8B7355', '#F4A460', '#DEB887', '#D2691E',
  '#BC8F5F', '#A0522D', '#8B6914', '#CD853F', '#F5DEB3',
];

// Format size for display
export const formatFileSize = (bytes: number): string => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// Truncate text
export const truncate = (text: string, maxLength: number): string => {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};
