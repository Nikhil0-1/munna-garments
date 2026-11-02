/**
 * Munna Readymade Garments — Product Image Utility
 * 
 * Safely resolves direct image URLs (e.g. ImgBB, Postimages, Unsplash, Google Drive)
 * with elegant apparel photo fallbacks so products never display empty or broken tiles.
 */

export function getProductDisplayImage(p: any): string {
  if (!p) return 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=600&auto=format&fit=crop&q=80';

  // 1. Direct array of images
  if (Array.isArray(p.images) && p.images.length > 0) {
    const first = p.images[0];
    if (typeof first === 'string' && first.trim()) return cleanImageUrl(first.trim());
  }

  // 2. String representation of images
  if (typeof p.images === 'string' && p.images.trim()) {
    try {
      const parsed = JSON.parse(p.images);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
        return cleanImageUrl(parsed[0]);
      }
    } catch {}
    return cleanImageUrl(p.images.trim());
  }

  // 3. Alternate field names
  if (typeof p.image_url === 'string' && p.image_url.trim()) return cleanImageUrl(p.image_url.trim());
  if (typeof p.image === 'string' && p.image.trim()) return cleanImageUrl(p.image.trim());
  if (typeof p.imageUrl === 'string' && p.imageUrl.trim()) return cleanImageUrl(p.imageUrl.trim());

  // 4. Fallback based on category / garment name
  return getGarmentCategoryFallback(p.name, p.category_name || p.category);
}

/**
 * Normalizes external image hosting links into direct embeddable links
 */
export function cleanImageUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();

  // ImgBB non-direct viewer page: https://ibb.co/XYZ -> try keep intact or alert
  // Google Drive share link -> direct embed link
  if (trimmed.includes('drive.google.com/file/d/')) {
    const match = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
  }

  return trimmed;
}

/**
 * High-resolution garment apparel photography for default/empty products
 */
export function getGarmentCategoryFallback(name: string = '', category: string = ''): string {
  const n = (name || '').toLowerCase();
  const c = (category || '').toLowerCase();

  if (n.includes('kurta') || c.includes('kurta')) {
    return 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=600&auto=format&fit=crop&q=80';
  }
  if (n.includes('shirt') || c.includes('shirt') || n.includes('t-shirt') || n.includes('polo')) {
    return 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop&q=80';
  }
  if (n.includes('jeans') || n.includes('denim') || c.includes('denim') || n.includes('chino') || n.includes('trouser')) {
    return 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&auto=format&fit=crop&q=80';
  }
  if (n.includes('saree') || c.includes('saree') || n.includes('suit') || c.includes('suit') || n.includes('anarkali') || n.includes('kurti')) {
    return 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80';
  }
  if (n.includes('jacket') || n.includes('modi') || n.includes('blazer') || n.includes('nehru')) {
    return 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&auto=format&fit=crop&q=80';
  }
  if (n.includes('kid') || c.includes('kid') || n.includes('child')) {
    return 'https://images.unsplash.com/photo-1519457431-44ccd64a579b?w=600&auto=format&fit=crop&q=80';
  }

  // Elegant readymade garment store fallback
  return 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=600&auto=format&fit=crop&q=80';
}
