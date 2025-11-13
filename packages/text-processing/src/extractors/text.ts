/**
 * Plain text extractor for text-based files
 */

import { TextExtractor, ExtractedText } from '@shelby-rag/shared';

export class TextExtractor implements TextExtractor {
  private supportedMimeTypes = [
    'text/plain',
    'text/markdown',
    'text/html',
    'text/csv',
    'text/xml',
    'application/json',
    'application/javascript',
    'application/typescript',
  ];

  supports(mimeType: string): boolean {
    return this.supportedMimeTypes.includes(mimeType) ||
           mimeType.startsWith('text/');
  }

  async extract(
    buffer: Buffer,
    options: {
      mimeType: string;
      filename?: string;
      ocr?: boolean;
    }
  ): Promise<ExtractedText> {
    try {
      const text = buffer.toString('utf8');
      
      return {
        text,
        metadata: {
          encoding: 'utf8',
          bytes: buffer.length,
        },
      };
    } catch (error: any) {
      throw new Error(`Text extraction failed: ${error.message}`);
    }
  }
}

