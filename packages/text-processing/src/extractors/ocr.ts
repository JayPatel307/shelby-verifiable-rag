/**
 * OCR text extractor using Tesseract.js
 */

import { createWorker } from 'tesseract.js';
import { TextExtractor, ExtractedText } from '@shelby-rag/shared';

export class OCRExtractor implements TextExtractor {
  private supportedMimeTypes = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/tiff',
    'image/bmp',
  ];

  supports(mimeType: string): boolean {
    return this.supportedMimeTypes.includes(mimeType);
  }

  async extract(
    buffer: Buffer,
    options: {
      mimeType: string;
      filename?: string;
      ocr?: boolean;
    }
  ): Promise<ExtractedText> {
    // Only run if OCR is explicitly enabled
    if (!options.ocr) {
      return {
        text: '',
        metadata: {
          skipped: true,
          reason: 'OCR not enabled',
        },
      };
    }

    try {
      const worker = await createWorker();
      
      try {
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        
        const { data } = await worker.recognize(buffer);
        
        return {
          text: data.text || '',
          metadata: {
            confidence: data.confidence,
            language: 'eng',
          },
        };
      } finally {
        await worker.terminate();
      }
    } catch (error: any) {
      throw new Error(`OCR extraction failed: ${error.message}`);
    }
  }
}

