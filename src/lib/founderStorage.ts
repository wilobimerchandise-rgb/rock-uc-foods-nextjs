/**
 * ROCK UC FOODS - Founder Image Storage Module
 * MASTER RULE: FOUNDER PHOTO IS SACRED - USE EXACT UPLOAD, NO AI FACE.
 *
 * Checks Supabase Storage bucket `founders` for `founder-original.jpg`
 * and supports persistent direct upload by the owner.
 */

const FOUNDER_BUCKET = 'founders';
const FOUNDER_FILENAME = 'founder.jpg';
const LOCAL_STORAGE_KEY = 'rock_uc_founder_photo_data';

// Isomorphic in-memory fallback cache for SSR and test execution
let memoryCache: string | null = null;

/**
 * Returns the public URL for the founder photo in Supabase Storage.
 */
export function getSupabaseFounderUrl(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (supabaseUrl) {
    return `${supabaseUrl}/storage/v1/object/public/${FOUNDER_BUCKET}/${FOUNDER_FILENAME}`;
  }
  return `/founders/${FOUNDER_FILENAME}`;
}

/**
 * Retrieves the currently active founder photo URL.
 * Checks client local cache first, then in-memory fallback.
 */
export function getActiveFounderPhotoUrl(): string | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cached = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        return cached;
      }
    } catch {
      // local storage access blocked or private browsing
    }
  }
  return memoryCache;
}

/**
 * Saves the exact uploaded founder photo without any crop, filter, or beautification.
 */
export function saveFounderPhoto(dataUrl: string): void {
  memoryCache = dataUrl;
  if (typeof window !== 'undefined') {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, dataUrl);
      }
      window.dispatchEvent(new Event('founder-photo-updated'));
    } catch {
      // quota or storage error
    }
  }
}

/**
 * Removes the custom founder photo and reverts to the mandatory sacred default.
 */
export function removeFounderPhoto(): void {
  memoryCache = null;
  if (typeof window !== 'undefined') {
    try {
      if (window.localStorage) {
        window.localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
      window.dispatchEvent(new Event('founder-photo-updated'));
    } catch {
      // ignore
    }
  }
}
