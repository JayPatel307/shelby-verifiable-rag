/**
 * PDF text extractor using pdf-parse
 */

import pdfParse from 'pdf-parse';
import { TextExtractor, ExtractedText } from '@shelby-rag/shared';

export class PDFExtractor implements TextExtractor {
  supports(mimeType: string): boolean {
    return mimeType === 'application/pdf';
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
      const data = await pdfParse(buffer);
      
      return {
        text: data.text || '',
        metadata: {
          pages: data.numpages,
          info: data.info,
        },
      };
    } catch (error: any) {
      throw new Error(`PDF extraction failed: ${error.message}`);
    }
  }
}

