/**
 * Main text processing module
 * Coordinates extractors and provides chunking functionality
 */

import { TextExtractor, ExtractedText } from '@shelby-rag/shared';
import { PDFExtractor } from './extractors/pdf';
import { TextExtractor as PlainTextExtractor } from './extractors/text';
import { OCRExtractor } from './extractors/ocr';

export class TextProcessor {
  private extractors: TextExtractor[];

  constructor(extractors?: TextExtractor[]) {
    // Default extractors
    this.extractors = extractors || [
      new PDFExtractor(),
      new PlainTextExtractor(),
      new OCRExtractor(),
    ];
  }

  /**
   * Extract text from file buffer
   */
  async extractText(
    buffer: Buffer,
    mimeType: string,
    options: {
      filename?: string;
      ocr?: boolean;
    } = {}
  ): Promise<ExtractedText> {
    // Find appropriate extractor
    const extractor = this.extractors.find(e => e.supports(mimeType));
    
    if (!extractor) {
      return {
        text: '',
        metadata: {
          unsupported: true,
          mimeType,
        },
      };
    }

    // Extract text
    return await extractor.extract(buffer, {
      mimeType,
      ...options,
    });
  }

  /**
   * Check if MIME type is supported
   */
  isSupported(mimeType: string): boolean {
    return this.extractors.some(e => e.supports(mimeType));
  }

  /**
   * Chunk text into smaller pieces for embedding
   * Uses word-based chunking with overlap
   */
  chunkText(
    text: string,
    options: {
      maxTokens?: number;
      overlap?: number;
      minChunkLength?: number;
    } = {}
  ): string[] {
    const {
      maxTokens = 1000,
      overlap = 200,
      minChunkLength = 50,
    } = options;

    // Clean text
    const cleanedText = text
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanedText.length < minChunkLength) {
      return cleanedText.length > 0 ? [cleanedText] : [];
    }

    // Split into words
    const words = cleanedText.split(/\s+/);
    
    if (words.length === 0) return [];
    if (words.length <= maxTokens) return [cleanedText];

    // Create overlapping chunks
    const chunks: string[] = [];
    const windowSize = maxTokens - overlap;

    for (let i = 0; i < words.length; i += windowSize) {
      const chunkWords = words.slice(i, i + maxTokens);
      const chunk = chunkWords.join(' ');
      
      if (chunk.length >= minChunkLength) {
        chunks.push(chunk);
      }
    }

    return chunks.length > 0 ? chunks : [cleanedText];
  }

  /**
   * Chunk text using sentence boundaries (more semantic)
   */
  chunkBySentences(
    text: string,
    options: {
      maxChars?: number;
      overlap?: number;
    } = {}
  ): string[] {
    const {
      maxChars = 5000,
      overlap = 500,
    } = options;

    // Split into sentences
    const sentences = text
      .split(/[.!?]+\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (sentences.length === 0) return [];

    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentLength = 0;

    for (const sentence of sentences) {
      const sentenceLength = sentence.length;

      // If adding this sentence would exceed max, save current chunk
      if (currentLength + sentenceLength > maxChars && currentChunk.length > 0) {
        chunks.push(currentChunk.join('. ') + '.');
        
        // Keep last few sentences for overlap
        const overlapSentences: string[] = [];
        let overlapLength = 0;
        for (let i = currentChunk.length - 1; i >= 0; i--) {
          const s = currentChunk[i];
          if (overlapLength + s.length <= overlap) {
            overlapSentences.unshift(s);
            overlapLength += s.length;
          } else {
            break;
          }
        }
        
        currentChunk = overlapSentences;
        currentLength = overlapLength;
      }

      currentChunk.push(sentence);
      currentLength += sentenceLength;
    }

    // Add remaining chunk
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('. ') + '.');
    }

    return chunks;
  }

  /**
   * Get statistics about text
   */
  getTextStats(text: string) {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);

    return {
      characters: text.length,
      words: words.length,
      sentences: sentences.length,
      paragraphs: paragraphs.length,
      avgWordLength: words.length > 0
        ? words.reduce((sum, w) => sum + w.length, 0) / words.length
        : 0,
      avgSentenceLength: sentences.length > 0
        ? sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length
        : 0,
    };
  }
}

// Export singleton instance
export const textProcessor = new TextProcessor();

