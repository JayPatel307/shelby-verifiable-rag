/**
 * Delete routes
 */

import { Request, Response } from 'express';
import { db } from '../services/database';

/**
 * DELETE /packs/:id - Delete a pack and all its documents/chunks
 */
export async function deletePack(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    // Verify ownership
    const pack = await db.getPack(id);
    if (!pack) {
      return res.status(404).json({ error: 'Pack not found' });
    }

    if (pack.owner_user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Delete pack (cascade will delete docs and chunks)
    await db.deletePack(id);

    console.log(`🗑️  Deleted pack: ${id}`);

    res.json({ ok: true, message: 'Pack deleted successfully' });
  } catch (error: any) {
    console.error('Delete pack error:', error);
    res.status(500).json({ error: 'Failed to delete pack' });
  }
}

/**
 * DELETE /packs/:packId/docs/:docId - Delete a document
 */
export async function deleteDocument(req: Request, res: Response) {
  try {
    const { packId, docId } = req.params;
    const userId = req.userId!;

    // Verify ownership
    const pack = await db.getPack(packId);
    if (!pack) {
      return res.status(404).json({ error: 'Pack not found' });
    }

    if (pack.owner_user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Verify document exists in this pack
    const doc = await db.getDoc(docId);
    if (!doc || doc.pack_id !== packId) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete document (cascade will delete chunks)
    await db.deleteDoc(docId);

    console.log(`🗑️  Deleted document: ${docId} from pack: ${packId}`);

    res.json({ ok: true, message: 'Document deleted successfully' });
  } catch (error: any) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
}

