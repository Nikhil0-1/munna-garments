/**
 * Munna Readymade Garments — Product Image Utility
 * 
 * Rules:
 * 1. If the product has a real image URL (in images[], image_url, image, or imageUrl),
 *    use THAT exact URL. Never replace a user-entered URL with a random image.
 * 2. Only show a placeholder when the product truly has NO image URL at all.
 * 3. Placeholder = a simple branded text fallback (product initials), NOT a random
 *    Unsplash photo that could be confused for the actual product.
 */

/**
 * Returns the first valid image URL from the product, or null if none exists.
 * NEVER returns a random/fallback image — only the user's actual uploaded URL.
 */
export function getProductImageUrl(p: any): string | null {
  if (!p) return null;

  // 1. Direct array of images
  if (Array.isArray(p.images) && p.images.length > 0) {
    for (const item of p.images) {
      if (typeof item === 'string' && item.trim().length > 0) {
        return cleanImageUrl(item.trim());
      }
      if (item && typeof item === 'object' && typeof item.url === 'string' && item.url.trim().length > 0) {
        return cleanImageUrl(item.url.trim());
      }
    }
  }

  // 2. String representation of images (JSON stringified array)
  if (typeof p.images === 'string' && p.images.trim()) {
    try {
      const parsed = JSON.parse(p.images);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = parsed[0];
        if (typeof first === 'string' && first.trim()) {
          return cleanImageUrl(first.trim());
        }
        if (first && typeof first === 'object' && typeof first.url === 'string' && first.url.trim()) {
          return cleanImageUrl(first.url.trim());
        }
      }
    } catch {}
    // Could be a single URL string
    if (p.images.trim().startsWith('http')) {
      return cleanImageUrl(p.images.trim());
    }
  }

  // 3. Alternate field names
  if (typeof p.image_url === 'string' && p.image_url.trim().length > 0) return cleanImageUrl(p.image_url.trim());
  if (typeof p.image === 'string' && p.image.trim().length > 0) return cleanImageUrl(p.image.trim());
  if (typeof p.imageUrl === 'string' && p.imageUrl.trim().length > 0) return cleanImageUrl(p.imageUrl.trim());
  if (typeof p.primaryImageUrl === 'string' && p.primaryImageUrl.trim().length > 0) return cleanImageUrl(p.primaryImageUrl.trim());

  // No image found
  return null;
}

/**
 * Backward compatibility alias for getProductImageUrl.
 * Returns either the valid image URL or empty string (never random stock photos).
 */
export function getProductDisplayImage(p: any): string {
  return getProductImageUrl(p) || '';
}

/**
 * Normalizes external image hosting links into direct embeddable links.
 * Handles Google Drive, ImgBB viewer pages, etc.
 */
export function cleanImageUrl(url: string): string {
  if (!url) return '';
  let trimmed = url.trim();

  // Google Drive share link -> direct embed link
  if (trimmed.includes('drive.google.com/file/d/')) {
    const match = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
  }

  // ImgBB: If user pasted a viewer page like https://ibb.co/XYZ (without i.ibb.co)
  // We keep it as is, but if it has query params or spaces, trim them
  return trimmed;
}
