/**
 * Verification routes
 */

import { Request, Response } from 'express';
import { verifier } from '../services';

/**
 * GET /verify/:blob_id - Verify blob integrity
 */
export async function verifyBlob(req: Request, res: Response) {
  try {
    const { blob_id } = req.params;
    const { expected_sha256 } = req.query;

    if (!blob_id) {
      return res.status(400).json({ error: 'blob_id is required' });
    }

    console.log(`\n🔍 Verifying blob: ${blob_id}`);
    if (expected_sha256) {
      console.log(`   Expected: ${expected_sha256}`);
    }

    const result = await verifier.verify({
      blob_id: decodeURIComponent(blob_id),
      expected_sha256: expected_sha256 as string | undefined,
    });

    console.log(`✅ Verification complete`);
    console.log(`   Computed: ${result.computed_sha256}`);
    console.log(`   Match: ${result.matched !== undefined ? result.matched : 'N/A'}`);

    res.json(result);
  } catch (error: any) {
    console.error('Verification error:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Verification failed',
    });
  }
}

