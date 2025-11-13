/**
 * Query routes
 */

import { Request, Response } from 'express';
import { queryEngine } from '../services';

/**
 * POST /query - Query private packs
 */
export async function queryPrivate(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const { question, pack_id, max_results } = req.body;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Question is required' });
    }

    console.log(`\n🔍 Query from user ${userId}: "${question}"`);
    if (pack_id) {
      console.log(`   Pack: ${pack_id}`);
    } else {
      console.log(`   Searching all user packs`);
    }

    const result = await queryEngine.queryPrivate(userId, {
      question,
      pack_id,
      max_results,
    });

    console.log(`✅ Query completed in ${result.query_time_ms}ms`);
    console.log(`   Citations: ${result.citations.length}`);

    res.json(result);
  } catch (error: any) {
    console.error('Query error:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Query failed',
    });
  }
}

/**
 * POST /public_query - Query public pack
 */
export async function queryPublic(req: Request, res: Response) {
  try {
    const { question, pack_id, max_results } = req.body;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Question is required' });
    }

    if (!pack_id) {
      return res.status(400).json({ error: 'pack_id is required' });
    }

    console.log(`\n🔍 Public query: "${question}"`);
    console.log(`   Pack: ${pack_id}`);

    const result = await queryEngine.queryPublic({
      question,
      pack_id,
      max_results,
    });

    console.log(`✅ Query completed in ${result.query_time_ms}ms`);
    console.log(`   Citations: ${result.citations.length}`);

    res.json(result);
  } catch (error: any) {
    console.error('Public query error:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Query failed',
    });
  }
}

