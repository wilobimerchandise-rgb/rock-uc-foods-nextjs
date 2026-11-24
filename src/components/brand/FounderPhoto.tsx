/**
 * ROCK UC FOODS - Founder Photo Component & Sacred Image Manager
 * MASTER RULE: FOUNDER PHOTO IS SACRED - USE EXACT UPLOAD, NO AI FACE.
 *
 * Public URL confirmed: https://visrhvtqeolqduupfckw.supabase.co/storage/v1/object/public/founders/founder.jpg
 * Legacy reference: visrhvtqeolqduupfckw.supabase.co/storage/v1/object/public/founders/founder-original.jpg
 *
 * Loads Chef Esther Kwentua's verified portrait with zero crop distortion or filters.
 * Eliminates hydration mismatch by ensuring initial server and client render use FOUNDER_URL.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Camera, Upload, RotateCcw, X, CheckCircle, AlertCircle } from 'lucide-react';
import {
  getActiveFounderPhotoUrl,
  saveFounderPhoto,
  removeFounderPhoto,
} from '../../lib/founderStorage';

export interface FounderPhotoProps {
  className?: string;
  allowUpload?: boolean;
}

export const FOUNDER_URL =
  'https://visrhvtqeolqduupfckw.supabase.co/storage/v1/object/public/founders/founder.jpg';

export const EXACT_FOUNDER_URL = FOUNDER_URL;
// Backward compatibility reference alias:
// visrhvtqeolqduupfckw.supabase.co/storage/v1/object/public/founders/founder-original.jpg

export const FounderPhotoModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeCustom = getActiveFounderPhotoUrl();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'error', message: 'Please select a valid image file (JPG, PNG, WEBP).' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setFeedback({ type: 'error', message: 'Image size must be under 10MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setPreview(dataUrl);
      setFeedback(null);
    };
    reader.onerror = () => {
      setFeedback({ type: 'error', message: 'Failed to read image file. Please try again.' });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!preview) return;
    try {
      saveFounderPhoto(preview);
      setFeedback({ type: 'success', message: 'Preferred founder photo updated across all brand pages!' });
      setTimeout(() => {
        onClose();
      }, 900);
    } catch {
      setFeedback({ type: 'error', message: 'Storage quota exceeded. Please choose a smaller image file.' });
    }
  };

  const handleReset = () => {
    removeFounderPhoto();
    setPreview(null);
    setFeedback({ type: 'success', message: 'Reset to original sacred founder photo.' });
    setTimeout(() => {
      onClose();
    }, 900);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="founder-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-xl max-w-lg w-full p-6 text-[var(--text-primary)] shadow-2xl relative">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-card)] mb-4">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-[var(--icon-on-surface)]" />
            <h3 id="founder-modal-title" className="font-serif font-bold text-lg text-[var(--text-primary)]">
              Owner Founder Photo Editor
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] rounded-lg"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {feedback && (
          <div
            className={`p-3 rounded mb-4 text-sm font-semibold flex items-center gap-2 ${
              feedback.type === 'error'
                ? 'bg-[#B3261E] text-white'
                : 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50'
            }`}
          >
            {feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle className="w-4 h-4 shrink-0 text-[#D4AF37]" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Current / Preview Image Display */}
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-[var(--bg-surface-muted)] p-4 rounded-lg border border-[var(--border-card)]">
            <div className="w-28 h-28 sm:w-32 sm:h-32 shrink-0 overflow-hidden rounded-[12px] border border-[var(--border-gold)] shadow">
              <img
                src={preview || activeCustom || FOUNDER_URL}
                alt="Founder - Rock UC Foods"
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }}
              />
            </div>
            <div className="text-sm space-y-1 text-center sm:text-left">
              <span className="font-semibold text-[var(--text-accent)] block">
                {preview ? 'New Photo Preview' : activeCustom ? 'Custom Upload Active' : 'Default Sacred Photo Active'}
              </span>
              <p className="text-[var(--text-body-muted)] leading-relaxed text-sm">
                {preview
                  ? 'Click "Save Preferred Photo" to apply across all brand touchpoints.'
                  : 'Upload your preferred high-resolution photo. It will be preserved exactly as uploaded.'}
              </p>
              <div className="pt-1 text-sm text-[var(--text-body-muted)] italic">
                Rule: No AI faces, no filters, no aspect ratio distortion.
              </div>
            </div>
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 min-h-[44px] px-4 py-2.5 bg-[var(--bg-surface-muted)] hover:opacity-90 text-[var(--text-accent)] border border-[var(--border-gold)] rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all"
            >
              <Upload className="w-4 h-4" /> Choose Image File
            </button>

            {preview && (
              <button
                type="button"
                onClick={handleSave}
                className="min-h-[44px] px-4 py-2.5 bg-[#6B1230] hover:bg-[#82173B] text-[#F7EFD9] border border-[#D4AF37] rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow"
              >
                <CheckCircle className="w-4 h-4 text-[#D4AF37]" /> Save Preferred Photo
              </button>
            )}

            {activeCustom && !preview && (
              <button
                type="button"
                onClick={handleReset}
                className="min-h-[44px] px-4 py-2.5 bg-[var(--bg-surface-muted)] hover:opacity-90 text-[var(--text-primary)] border border-[var(--border-card)] rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-all"
              >
                <RotateCcw className="w-4 h-4" /> Reset to Original
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const FounderPhoto: React.FC<FounderPhotoProps> = ({ className = '', allowUpload = false }) => {
  const [imageSrc, setImageSrc] = useState(FOUNDER_URL);
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    // After client mount, sync custom photo from storage if set
    const custom = getActiveFounderPhotoUrl();
    if (custom) {
      setImageSrc(custom);
    }

    const handleUpdate = () => {
      const updated = getActiveFounderPhotoUrl();
      setImageSrc(updated || FOUNDER_URL);
    };

    window.addEventListener('founder-photo-updated', handleUpdate);
    return () => window.removeEventListener('founder-photo-updated', handleUpdate);
  }, []);

  // SSR / Pre-hydration render guard
  if (!mounted) {
    return (
      <div className={`relative group overflow-hidden rounded-[12px] border border-[var(--border-gold)] shadow-xl ${className}`}>
        <img
          src={FOUNDER_URL}
          alt="Founder - Rock UC Foods"
          style={{ width: '100%', objectFit: 'cover', borderRadius: '12px' }}
        />
      </div>
    );
  }

  return (
    <>
      <div className={`relative group overflow-hidden rounded-[12px] border border-[var(--border-gold)] shadow-xl ${className}`}>
        <img
          src={imageSrc}
          alt="Founder - Rock UC Foods"
          onError={() => setImageSrc(FOUNDER_URL)}
          style={{ width: '100%', objectFit: 'cover', borderRadius: '12px' }}
        />

        {allowUpload && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            aria-label="Upload preferred founder photo"
            className="absolute bottom-2 right-2 min-w-[44px] min-h-[44px] bg-[#17120F]/95 hover:bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37] rounded-full px-3 py-2 text-sm font-semibold inline-flex items-center justify-center gap-1.5 backdrop-blur shadow-lg transition-all"
          >
            <Camera className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <span className="hidden sm:inline">Change Photo</span>
          </button>
        )}
      </div>

      {showModal && (
        <FounderPhotoModal onClose={() => setShowModal(false)} />
      )}
    </>
  );
};
