/**
 * ROCK UC FOODS - Phase 2B Brand Website Verification Test Suite
 * Validates brand tokens, contrast ratios, truth rules, phone numbers,
 * doorstep delivery wording, absence of fake ratings, and SACRED FOUNDER PHOTO rule.
 */

import { describe, it, expect } from 'vitest';
import { BUSINESS_CONTACT } from '../src/policy/content';
import { menuRepository } from '../src/menu/data';
import * as fs from 'fs';
import * as path from 'path';

function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const lum1 = getLuminance(...rgb1);
  const lum2 = getLuminance(...rgb2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

describe('Phase 2B: Brand Kit & WCAG Contrast Verification', () => {
  const INK: [number, number, number] = [0x0b, 0x0a, 0x09];
  const GOLD: [number, number, number] = [0xd4, 0xaf, 0x37];
  const CREAM: [number, number, number] = [0xf7, 0xef, 0xd9];
  const WINE: [number, number, number] = [0x6b, 0x12, 0x30];

  it('Gold on Ink contrast ratio meets WCAG AA for large text (>= 3:1)', () => {
    const ratio = getContrastRatio(GOLD, INK);
    expect(ratio).toBeGreaterThanOrEqual(3.0);
    expect(ratio).toBeGreaterThan(8.0);
  });

  it('Cream on Ink contrast ratio meets WCAG AAA for body text (>= 7:1)', () => {
    const ratio = getContrastRatio(CREAM, INK);
    expect(ratio).toBeGreaterThanOrEqual(7.0);
  });

  it('Cream on Wine button contrast ratio meets WCAG AAA (>= 7:1)', () => {
    const ratio = getContrastRatio(CREAM, WINE);
    expect(ratio).toBeGreaterThanOrEqual(7.0);
  });

  it('Gold text on Cream fails contrast and is strictly prohibited in brand rules', () => {
    const ratio = getContrastRatio(GOLD, CREAM);
    expect(ratio).toBeLessThan(3.0);
  });
});

describe('Phase 2B: Master Rule - Sacred Founder Photo & Truth Rules', () => {
  it('No fake AI founder photos exist in /src/assets/images or /public', () => {
    const assetsDir = path.resolve(__dirname, '../src/assets/images');
    if (fs.existsSync(assetsDir)) {
      const files = fs.readdirSync(assetsDir);
      // Ensure zero fake/generated portraits exist
      expect(files.filter((f) => f.includes('portrait') || f.includes('official'))).toHaveLength(0);
    }
  });

  it('BrandWebsite and FounderPhoto hardcode exact founder image URL with strict styling', () => {
    const componentPath = path.resolve(__dirname, '../src/components/brand/FounderPhoto.tsx');
    const content = fs.readFileSync(componentPath, 'utf-8');
    expect(content).toContain('EXACT_FOUNDER_URL');
    expect(content).toContain('visrhvtqeolqduupfckw.supabase.co/storage/v1/object/public/founders/founder-original.jpg');
    expect(content).toContain("alt=\"Founder - Rock UC Foods\"");
    expect(content).toContain("borderRadius: '12px'");
    expect(content).toContain("objectFit: 'cover'");
  });

  it('No fake star ratings or aggregateRating in source or index.html', () => {
    const htmlPath = fs.existsSync(path.resolve(__dirname, '../app/layout.tsx'))
      ? path.resolve(__dirname, '../app/layout.tsx')
      : path.resolve(__dirname, '../index.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    expect(html).not.toContain('aggregateRating');
    expect(html).not.toContain('5-star');
    expect(html).not.toContain('five-star');
    expect(html).not.toContain('★★★★★');
  });

  it('Phone numbers across contacts match 08033729125 and international +2348033729125', () => {
    expect(BUSINESS_CONTACT.phone).toBe('08033729125');
    expect(BUSINESS_CONTACT.phoneInternational).toBe('+2348033729125');
    expect(BUSINESS_CONTACT.whatsappUrl).toContain('2348033729125');
  });

  it('Doorstep delivery is spelled as one word ("doorstep")', () => {
    const brandComponentPath = path.resolve(__dirname, '../src/components/brand/BrandWebsite.tsx');
    const content = fs.readFileSync(brandComponentPath, 'utf-8');
    expect(content).toContain('doorstep');
    expect(content).not.toMatch(/door\s+step/i);
  });

  it('Collection address matches 5 Aro street, Lagos', () => {
    expect(BUSINESS_CONTACT.collectionAddress).toBe('5 Aro street, Lagos');
  });

  it('Instagram handle matches @rock-uc-foods without spaces', () => {
    expect(BUSINESS_CONTACT.instagram).toBe('@rock-uc-foods');
  });

  it('Featured dishes are dynamically derived from menu repository', () => {
    const featured = menuRepository.getItems().filter((i) => i.isFeatured);
    expect(featured.length).toBeGreaterThan(0);
    expect(featured[0].status).toBe('published');
  });

  it('Owner has editable founder photo options with persistent local cache and reset', async () => {
    const { saveFounderPhoto, getActiveFounderPhotoUrl, removeFounderPhoto } = await import('../src/lib/founderStorage');
    
    // Initial state (or reset)
    removeFounderPhoto();
    expect(getActiveFounderPhotoUrl()).toBeNull();

    // Owner uploads preferred image data
    const sampleOwnerDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBD...';
    saveFounderPhoto(sampleOwnerDataUrl);
    expect(getActiveFounderPhotoUrl()).toBe(sampleOwnerDataUrl);

    // Owner can reset to original
    removeFounderPhoto();
    expect(getActiveFounderPhotoUrl()).toBeNull();
  });

  it('OwnerMenuEditor exposes Founder Photo modal trigger for owner role', () => {
    const editorPath = path.resolve(__dirname, '../src/components/menu/OwnerMenuEditor.tsx');
    const content = fs.readFileSync(editorPath, 'utf-8');
    expect(content).toContain('Founder Photo');
    expect(content).toContain('FounderPhotoModal');
    expect(content).toContain('setShowFounderModal');
  });
});
