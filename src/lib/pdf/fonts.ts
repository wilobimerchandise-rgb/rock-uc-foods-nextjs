/**
 * ROCK UC FOODS - PDF Font Registration
 * Playbook v4 Sections 21 & 22
 * 
 * Embeds Inter (latin) for digits/letters and InterExt (latin-ext) for the ₦ sign (U+20A6).
 * Both fonts are registered and embedded into generated PDFs.
 */

import { Font } from '@react-pdf/renderer';
import * as path from 'path';

let fontsRegistered = false;

export function registerPdfFonts() {
  if (fontsRegistered) return;

  const basePath = path.resolve(process.cwd(), 'assets/fonts');

  Font.register({
    family: 'Inter',
    fonts: [
      {
        src: path.join(basePath, 'inter-latin-400-normal.woff'),
        fontWeight: 'normal',
      },
      {
        src: path.join(basePath, 'inter-latin-700-normal.woff'),
        fontWeight: 'bold',
      },
    ],
  });

  Font.register({
    family: 'InterExt',
    fonts: [
      {
        src: path.join(basePath, 'inter-latin-ext-400-normal.woff'),
        fontWeight: 'normal',
      },
      {
        src: path.join(basePath, 'inter-latin-ext-700-normal.woff'),
        fontWeight: 'bold',
      },
    ],
  });

  fontsRegistered = true;
}
