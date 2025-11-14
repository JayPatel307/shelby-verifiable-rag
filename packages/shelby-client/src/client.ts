/**
 * Shelby Storage Client - Real SDK Integration
 * 
 * This wraps the official Shelby SDK to provide a simpler interface
 * that matches our StorageProvider interface
 */

import { ShelbyNodeClient } from '@shelby-protocol/sdk/node';
import { Account, Ed25519Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';
import {
  StorageProvider,
  StorageUploadResult,
  StorageMetadata,
  AppError,
  sha256,
} from '@shelby-rag/shared';

export interface ShelbyClientConfig {
  apiKey?: string;                // Optional: For rate limiting only
  privateKey?: string;            // Aptos private key (if not provided, generates new)
  expirationDays?: number;        // Default: 30 days
}

export class ShelbyClient implements StorageProvider {
  private client: ShelbyNodeClient;
  private account: Account;
  private expirationDays: number;

  constructor(config: ShelbyClientConfig = {}) {
    // Minimal SDK initialization - exactly as per Shelby docs
    // No network needed for shelbynet - it's the default!
    this.client = new ShelbyNodeClient({
      apiKey: config.apiKey, // Optional - only for rate limiting
    });

    // Initialize or generate Aptos account
    if (config.privateKey) {
      this.account = new Ed25519Account({
        privateKey: new Ed25519PrivateKey(config.privateKey),
      });
    } else {
      // Generate new account (dev mode)
      this.account = Account.generate();
      console.warn('⚠️  Generated new Aptos account. Save this private key:', 
        this.account.privateKey.toString());
    }

    this.expirationDays = config.expirationDays || 30;
  }

  /**
   * Upload a blob to Shelby
   */
  async upload(
    data: Buffer,
    options: {
      contentType?: string;
      metadata?: Record<string, string>;
    } = {}
  ): Promise<StorageUploadResult> {
    try {
      // Generate unique blob name from hash
      const hash = sha256(data);
      const blobName = options.metadata?.path || `blobs/${hash}`;

      // Calculate expiration (default 30 days from now)
      const expirationMicros = (Date.now() + this.expirationDays * 24 * 60 * 60 * 1000) * 1000;

      // Upload using Shelby SDK
      const { transaction, blobCommitments } = await this.client.upload({
        signer: this.account,
        blobData: data,
        blobName,
        expirationMicros,
      });

      // Get blob metadata from transaction
      const blobId = `${this.account.accountAddress.toString()}/${blobName}`;

      console.log(`✅ Uploaded to Shelby: ${blobId} (tx: ${transaction.hash})`);

      return {
        blob_id: blobId,
        sha256: hash,
        bytes: data.length,
      };
    } catch (error: any) {
      throw new AppError(
        `Failed to upload to Shelby: ${error.message}`,
        'SHELBY_UPLOAD_ERROR',
        500,
        { originalError: error }
      );
    }
  }

  /**
   * Download a blob from Shelby
   */
  async download(blobId: string): Promise<Buffer> {
    try {
      // Parse blob_id format: "account_address/blob_name"
      const parts = blobId.split('/');
      if (parts.length < 2) {
        throw new Error('Invalid blob_id format. Expected: account_address/blob_name');
      }

      const [accountAddress, ...pathParts] = parts;
      const blobName = pathParts.join('/');

      // Download using Shelby SDK
      const blob = await this.client.download({
        account: accountAddress,
        blobName,
      });

      // Convert stream to buffer
      return await this.streamToBuffer(blob.stream);
    } catch (error: any) {
      throw new AppError(
        `Failed to download from Shelby: ${error.message}`,
        'SHELBY_DOWNLOAD_ERROR',
        500,
        { originalError: error }
      );
    }
  }

  /**
   * Check if a blob exists
   */
  async exists(blobId: string): Promise<boolean> {
    try {
      await this.download(blobId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get blob metadata
   */
  async getMetadata(blobId: string): Promise<StorageMetadata> {
    try {
      const parts = blobId.split('/');
      if (parts.length < 2) {
        throw new Error('Invalid blob_id format');
      }

      const [accountAddress, ...pathParts] = parts;
      const blobName = pathParts.join('/');

      // Get blob metadata from blockchain
      const metadata = await this.client.coordination.getBlobMetadata({
        account: accountAddress,
        name: blobName,
      });

      return {
        blob_id: blobId,
        bytes: metadata.size,
        content_type: undefined, // Shelby doesn't store content type
        created_at: undefined,   // Could be derived from blockchain timestamp
      };
    } catch (error: any) {
      throw new AppError(
        `Failed to get metadata from Shelby: ${error.message}`,
        'SHELBY_METADATA_ERROR',
        500,
        { originalError: error }
      );
    }
  }

  /**
   * Get account address (for reference)
   */
  getAccountAddress(): string {
    return this.account.accountAddress.toString();
  }

  /**
   * Get all blobs for an account
   */
  async listAccountBlobs(accountAddress?: string): Promise<any[]> {
    try {
      const address = accountAddress || this.account.accountAddress.toString();
      return await this.client.coordination.getAccountBlobs({
        account: address,
      });
    } catch (error: any) {
      throw new AppError(
        `Failed to list blobs: ${error.message}`,
        'SHELBY_LIST_ERROR',
        500,
        { originalError: error }
      );
    }
  }

  /**
   * Verify a blob's integrity
   */
  async verifyBlob(blobId: string, expectedSha256?: string): Promise<{
    ok: boolean;
    computedSha256: string;
    matched: boolean;
  }> {
    try {
      // Download and re-hash
      const data = await this.download(blobId);
      const computedSha256 = sha256(data);
      
      const matched = expectedSha256 
        ? computedSha256 === expectedSha256 
        : true;

      return {
        ok: matched,
        computedSha256,
        matched,
      };
    } catch (error: any) {
      throw new AppError(
        `Failed to verify blob: ${error.message}`,
        'SHELBY_VERIFY_ERROR',
        500,
        { originalError: error }
      );
    }
  }

  // ====================================================================
  // Helper Methods
  // ====================================================================

  /**
   * Convert Node.js stream to Buffer
   */
  private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      
      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      stream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      
      stream.on('error', reject);
    });
  }
}

