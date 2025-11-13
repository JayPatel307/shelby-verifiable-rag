/**
 * Verifier - Verify blob integrity against Shelby storage
 */

import {
  StorageProvider,
  VerificationRequest,
  VerificationResponse,
  AppError,
  sha256,
} from '@shelby-rag/shared';

export class Verifier {
  private storage: StorageProvider;

  constructor(storage: StorageProvider) {
    this.storage = storage;
  }

  /**
   * Verify a blob's integrity
   * Re-fetches from Shelby and re-computes hash
   */
  async verify(request: VerificationRequest): Promise<VerificationResponse> {
    try {
      console.log(`🔍 Verifying blob: ${request.blob_id}`);

      // Re-fetch blob from Shelby
      const data = await this.storage.download(request.blob_id);

      // Re-compute hash
      const computedSha256 = sha256(data);

      // Compare if expected hash was provided
      let matched: boolean | undefined;
      if (request.expected_sha256) {
        matched = computedSha256 === request.expected_sha256;
      }

      console.log(
        matched !== undefined
          ? matched
            ? '✅ Hash matched!'
            : '❌ Hash mismatch!'
          : '✅ Hash computed'
      );

      return {
        ok: matched === undefined ? true : matched,
        blob_id: request.blob_id,
        computed_sha256: computedSha256,
        expected_sha256: request.expected_sha256,
        matched,
      };
    } catch (error: any) {
      throw new AppError(
        `Verification failed: ${error.message}`,
        'VERIFICATION_ERROR',
        500,
        { originalError: error }
      );
    }
  }

  /**
   * Batch verify multiple blobs
   */
  async verifyBatch(
    requests: VerificationRequest[]
  ): Promise<VerificationResponse[]> {
    const results: VerificationResponse[] = [];

    for (const request of requests) {
      try {
        const result = await this.verify(request);
        results.push(result);
      } catch (error: any) {
        // Continue with other verifications
        results.push({
          ok: false,
          blob_id: request.blob_id,
          computed_sha256: '',
          expected_sha256: request.expected_sha256,
          matched: false,
        });
      }
    }

    return results;
  }
}

