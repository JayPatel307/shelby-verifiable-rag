/**
 * Pack routes
 */

import { Request, Response } from 'express';
import AdmZip from 'adm-zip';
import mime from 'mime-types';
import { packManager } from '../services';
import { db } from '../services/database';
import { parseBoolean, normalizeTags } from '@shelby-rag/shared';

/**
 * POST /packs - Create new pack with file uploads
 */
export async function createPack(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const title = req.body?.title?.trim();
    const summary = req.body?.summary?.trim();
    const tags = normalizeTags(req.body?.tags);
    const ocr = parseBoolean(req.body?.ocr, false);

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Process uploaded files
    const files: Array<{ path: string; mime: string; buffer: Buffer }> = [];
    const multerFiles = req.files as Express.Multer.File[];

    if (!multerFiles || multerFiles.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Check for zip file
    const zipFile = multerFiles.find(f => f.fieldname === 'archive' || f.originalname.endsWith('.zip'));

    if (zipFile) {
      console.log('📦 Extracting ZIP archive...');
      const zip = new AdmZip(zipFile.buffer);
      const entries = zip.getEntries();

      for (const entry of entries) {
        if (entry.isDirectory) continue;

        const relativePath = entry.entryName.replace(/^\/+|^\\+/, '');
        const ext = relativePath.split('.').pop() || '';
        const mimeType = mime.lookup(ext) || 'application/octet-stream';

        files.push({
          path: relativePath,
          mime: String(mimeType),
          buffer: entry.getData(),
        });
      }

      console.log(`   Extracted ${files.length} files`);
    } else {
      // Individual files
      for (const file of multerFiles) {
        files.push({
          path: file.originalname,
          mime: file.mimetype || 'application/octet-stream',
          buffer: file.buffer,
        });
      }
    }

    if (files.length === 0) {
      return res.status(400).json({ error: 'No files found' });
    }

    const totalSize = files.reduce((sum, f) => sum + f.buffer.length, 0);
    const totalMB = (totalSize / 1024 / 1024).toFixed(2);
    
    console.log(`\n📤 Creating pack: "${title}"`);
    console.log(`   Files: ${files.length}`);
    console.log(`   Total size: ${totalMB} MB`);
    console.log(`   OCR: ${ocr ? 'enabled' : 'disabled'}`);
    
    // Log individual large files
    files.forEach(f => {
      const sizeMB = (f.buffer.length / 1024 / 1024).toFixed(2);
      if (parseFloat(sizeMB) > 1) {
        console.log(`   📄 ${f.path}: ${sizeMB} MB`);
      }
    });

    // Create pack (this may take a while for large PDFs)
    console.log(`⏳ Starting pack creation (this may take a few minutes for large files)...`);
    const result = await packManager.createPack(userId, {
      title,
      summary,
      tags,
      ocr,
      files,
    });

    console.log(`✅ Pack created successfully: ${result.pack_id}`);
    res.json(result);
  } catch (error: any) {
    console.error('Pack creation error:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Pack creation failed',
    });
  }
}

/**
 * GET /packs/:id - Get pack details
 */
export async function getPack(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const result = await packManager.getPack(id);

    if (!result) {
      return res.status(404).json({ error: 'Pack not found' });
    }

    res.json(result);
  } catch (error: any) {
    console.error('Get pack error:', error);
    res.status(500).json({ error: 'Failed to get pack' });
  }
}

/**
 * PATCH /packs/:id/visibility - Update pack visibility
 */
export async function updateVisibility(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { visibility } = req.body;
    const userId = req.userId!;

    if (!['private', 'public', 'unlisted'].includes(visibility)) {
      return res.status(400).json({
        error: 'Invalid visibility. Must be: private, public, or unlisted',
      });
    }

    await packManager.updateVisibility(id, userId, visibility);

    res.json({ ok: true });
  } catch (error: any) {
    console.error('Update visibility error:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to update visibility',
    });
  }
}

/**
 * GET /discover - List public packs
 */
export async function discoverPacks(req: Request, res: Response) {
  try {
    const query = req.query.q as string | undefined;

    const packs = await db.listPublicPacks(query);

    res.json({ items: packs });
  } catch (error: any) {
    console.error('Discover error:', error);
    res.status(500).json({ error: 'Failed to list packs' });
  }
}

/**
 * GET /packs - List user's packs
 */
export async function listMyPacks(req: Request, res: Response) {
  try {
    const userId = req.userId!;

    const packs = await db.listPacks(userId);

    res.json({ items: packs });
  } catch (error: any) {
    console.error('List packs error:', error);
    res.status(500).json({ error: 'Failed to list packs' });
  }
}

