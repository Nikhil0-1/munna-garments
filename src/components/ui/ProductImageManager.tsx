import React, { useState } from 'react';
import { Image as ImageIcon, Plus, Trash2, Star, ArrowUp, ArrowDown, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react';
import Button from './Button';
import Input from './Input';
import { cleanImageUrl } from '../../utils/productImages';

interface ProductImageManagerProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

export default function ProductImageManager({
  images = [],
  onChange,
  maxImages = 6,
}: ProductImageManagerProps) {
  const [urlInput, setUrlInput] = useState('');
  const [previewError, setPreviewError] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});

  const isValidUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url.trim());
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const addUrl = (rawUrl: string) => {
    const cleaned = cleanImageUrl(rawUrl.trim());
    if (!cleaned) return false;

    if (!isValidUrl(cleaned)) {
      alert('Please enter a valid HTTP or HTTPS image URL.');
      return false;
    }

    if (images.includes(cleaned)) {
      alert('This image URL has already been added.');
      return false;
    }

    if (images.length >= maxImages) {
      alert(`Maximum of ${maxImages} images allowed per product.`);
      return false;
    }

    onChange([...images, cleaned]);
    setUrlInput('');
    setPreviewError(false);
    return true;
  };

  const handleAdd = () => {
    if (!urlInput.trim()) return;
    addUrl(urlInput);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').trim();
    if (isValidUrl(pasted) && !images.includes(pasted) && images.length < maxImages) {
      // Auto-add on paste for seamless UX
      e.preventDefault();
      addUrl(pasted);
    }
  };

  const handleBlur = () => {
    // If user typed/pasted a valid URL and moved to the next field without clicking Add
    if (urlInput.trim() && isValidUrl(urlInput.trim()) && !images.includes(urlInput.trim()) && images.length < maxImages) {
      addUrl(urlInput);
    }
  };

  const handleRemove = (index: number) => {
    const updated = images.filter((_, i) => i !== index);
    onChange(updated);
    setFailedImages(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const handleMakePrimary = (index: number) => {
    if (index === 0) return;
    const selected = images[index];
    const remaining = images.filter((_, i) => i !== index);
    onChange([selected, ...remaining]);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;
    const copy = [...images];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;
    onChange(copy);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
          <ImageIcon size={14} className="text-amber-700" />
          Product Images (Web URL System)
        </label>
        <span className="text-[11px] text-gray-400 font-medium">
          {images.length}/{maxImages} images attached
        </span>
      </div>

      {/* URL Input Box */}
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            value={urlInput}
            onChange={e => {
              setUrlInput(e.target.value);
              setPreviewError(false);
            }}
            onPaste={handlePaste}
            onBlur={handleBlur}
            placeholder="Paste image URL (e.g. https://i.ibb.co/xyz/shirt.jpg)"
            className="w-full py-2 px-3 text-sm rounded-xl border border-gray-200 outline-none focus:border-amber-600 focus:bg-white transition-all"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
        </div>
        <Button
          type="button"
          size="sm"
          onClick={handleAdd}
          disabled={!urlInput.trim() || images.length >= maxImages}
          icon={<Plus size={14} />}
        >
          Add Image
        </Button>
      </div>

      {/* Live Preview for currently typed URL before adding */}
      {urlInput.trim() && isValidUrl(urlInput.trim()) && (
        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-14 h-14 rounded-lg bg-white border border-amber-200 overflow-hidden flex items-center justify-center flex-shrink-0">
              {previewError ? (
                <div className="text-center p-1">
                  <AlertCircle size={16} className="text-red-500 mx-auto" />
                  <span className="text-[9px] text-red-500 block leading-tight">Failed</span>
                </div>
              ) : (
                <img
                  src={cleanImageUrl(urlInput.trim())}
                  alt="URL Preview"
                  className="w-full h-full object-cover"
                  onError={() => setPreviewError(true)}
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-800">Preview Before Adding</p>
              <p className="text-[11px] text-gray-500 truncate max-w-xs">{urlInput.trim()}</p>
              {previewError && (
                <p className="text-[10px] text-red-600 mt-0.5">
                  Could not load image. Check the URL and verify it is public.
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="px-3 py-1.5 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-semibold shadow-xs flex-shrink-0 flex items-center gap-1 transition-colors"
          >
            <CheckCircle size={12} />
            Attach Image
          </button>
        </div>
      )}

      {/* Image Gallery / Attached Thumbnails List */}
      {images.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {images.map((imgUrl, idx) => {
            const isFailed = failedImages[idx];
            const isPrimary = idx === 0;

            return (
              <div
                key={idx}
                className={`p-2 rounded-xl border flex items-center gap-3 transition-all ${
                  isPrimary
                    ? 'bg-amber-50/80 border-amber-300 shadow-xs ring-1 ring-amber-300/50'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Thumbnail */}
                <div className="w-14 h-14 rounded-lg bg-gray-50 border border-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0 relative">
                  {isFailed ? (
                    <div className="text-center p-1">
                      <AlertCircle size={16} className="text-gray-400 mx-auto" />
                      <span className="text-[8px] text-gray-400 block leading-tight">Broken Link</span>
                    </div>
                  ) : (
                    <img
                      src={imgUrl}
                      alt={`Product ${idx + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={() =>
                        setFailedImages(prev => ({ ...prev, [idx]: true }))
                      }
                    />
                  )}
                  {isPrimary && (
                    <span className="absolute bottom-0 inset-x-0 bg-amber-800 text-white text-[8px] font-bold text-center py-0.5 tracking-wider uppercase">
                      Primary
                    </span>
                  )}
                </div>

                {/* Details & Actions */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-gray-800">
                      {isPrimary ? 'Primary Photo' : `Photo #${idx + 1}`}
                    </span>
                    <a
                      href={imgUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-gray-400 hover:text-amber-800"
                      title="Open image in new tab"
                    >
                      <ExternalLink size={11} />
                    </a>
                  </div>
                  <p className="text-[10px] text-gray-400 truncate mt-0.5 font-mono">{imgUrl}</p>

                  <div className="flex items-center gap-1 mt-1.5">
                    {!isPrimary && (
                      <button
                        type="button"
                        onClick={() => handleMakePrimary(idx)}
                        className="text-[10px] font-semibold text-amber-800 hover:text-amber-900 bg-amber-100/70 hover:bg-amber-100 px-2 py-0.5 rounded flex items-center gap-1 transition-colors"
                      >
                        <Star size={10} className="fill-amber-800" />
                        Make Primary
                      </button>
                    )}
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => handleMove(idx, 'up')}
                        className="p-1 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                        title="Move up"
                      >
                        <ArrowUp size={12} />
                      </button>
                    )}
                    {idx < images.length - 1 && (
                      <button
                        type="button"
                        onClick={() => handleMove(idx, 'down')}
                        className="p-1 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                        title="Move down"
                      >
                        <ArrowDown size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemove(idx)}
                      className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-50 ml-auto"
                      title="Remove image"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-4 px-3 rounded-xl border border-dashed border-amber-200/80 text-center bg-amber-50/30">
          <ImageIcon size={22} className="mx-auto text-amber-700/50 mb-1" />
          <p className="text-xs text-gray-600 font-medium">No product images attached yet</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Paste any direct image URL above (ImgBB, Postimages, etc.) to preview and attach.
          </p>
        </div>
      )}
    </div>
  );
}
