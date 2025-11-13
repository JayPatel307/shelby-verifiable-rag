/**
 * Query Engine - RAG query processing with LLM
 */

import OpenAI from 'openai';
import {
  DatabaseClient,
  EmbeddingProvider,
  QueryRequest,
  QueryResponse,
  Citation,
  ValidationError,
  AppError,
  measureTime,
} from '@shelby-rag/shared';

export interface QueryEngineConfig {
  database: DatabaseClient;
  embeddings: EmbeddingProvider;
  llm: {
    provider: 'openai' | 'anthropic';
    apiKey: string;
    model: string;
  };
  maxResults?: number;
}

export class QueryEngine {
  private database: DatabaseClient;
  private embeddings: EmbeddingProvider;
  private llmClient: OpenAI;
  private llmModel: string;
  private maxResults: number;

  constructor(config: QueryEngineConfig) {
    this.database = config.database;
    this.embeddings = config.embeddings;
    this.maxResults = config.maxResults || 5;

    // Initialize LLM client
    if (config.llm.provider === 'openai') {
      this.llmClient = new OpenAI({ apiKey: config.llm.apiKey });
      this.llmModel = config.llm.model || 'gpt-4o-mini';
    } else {
      throw new AppError(
        'Only OpenAI LLM provider is currently supported',
        'UNSUPPORTED_LLM',
        501
      );
    }
  }

  /**
   * Query private packs (user's own packs or public packs)
   */
  async queryPrivate(
    userId: string,
    request: QueryRequest
  ): Promise<QueryResponse> {
    this.validateQuery(request);

    const { result, durationMs } = await measureTime(async () => {
      // Determine which packs to search
      let packIds: string[];

      if (request.pack_id) {
        // Check if user has access to this pack
        const pack = await this.database.getPack(request.pack_id);
        if (!pack) {
          throw new AppError('Pack not found', 'NOT_FOUND', 404);
        }

        // Allow if owner or public
        if (pack.owner_user_id !== userId && pack.visibility !== 'public') {
          throw new AppError('Access denied', 'FORBIDDEN', 403);
        }

        packIds = [request.pack_id];
      } else {
        // Search all user's packs
        const userPacks = await this.database.listPacks(userId);
        packIds = userPacks.map(p => p.pack_id);

        if (packIds.length === 0) {
          return {
            answer: 'You have no packs yet. Please upload some documents first.',
            citations: [],
            query_time_ms: 0,
          };
        }
      }

      return await this.executeQuery(request.question, packIds, request.max_results);
    });

    return {
      ...result,
      query_time_ms: durationMs,
    };
  }

  /**
   * Query public pack (no authentication required)
   */
  async queryPublic(request: QueryRequest & { pack_id: string }): Promise<QueryResponse> {
    this.validateQuery(request);

    if (!request.pack_id) {
      throw new ValidationError('pack_id is required for public queries');
    }

    const { result, durationMs } = await measureTime(async () => {
      // Verify pack is public
      const pack = await this.database.getPack(request.pack_id);
      if (!pack) {
        throw new AppError('Pack not found', 'NOT_FOUND', 404);
      }

      if (pack.visibility !== 'public') {
        throw new AppError('Pack is not public', 'FORBIDDEN', 403);
      }

      return await this.executeQuery(request.question, [request.pack_id], request.max_results);
    });

    return {
      ...result,
      query_time_ms: durationMs,
    };
  }

  /**
   * Execute the RAG query
   */
  private async executeQuery(
    question: string,
    packIds: string[],
    maxResults?: number
  ): Promise<Omit<QueryResponse, 'query_time_ms'>> {
    const k = maxResults || this.maxResults;

    // 1. Generate question embedding
    console.log('🔍 Generating question embedding...');
    const questionEmbedding = await this.embeddings.embed(question);

    // 2. Search for similar chunks
    console.log(`🔎 Searching ${packIds.length} pack(s)...`);
    const scoredChunks = await this.database.searchChunks(
      questionEmbedding,
      packIds,
      k
    );

    if (scoredChunks.length === 0) {
      return {
        answer: 'No relevant information found in the selected packs.',
        citations: [],
      };
    }

    console.log(`📚 Found ${scoredChunks.length} relevant chunks`);

    // 3. Format context for LLM
    const contexts = scoredChunks.map((chunk, i) => ({
      index: i + 1,
      text: chunk.text,
      blob_id: (chunk as any).shelby_blob_id,
      sha256: (chunk as any).sha256,
      doc_path: (chunk as any).doc_path,
      score: chunk.score,
    }));

    // 4. Call LLM
    console.log('🤖 Generating answer with LLM...');
    const answer = await this.callLLM(question, contexts);

    // 5. Extract citations
    const citations: Citation[] = contexts.map(ctx => ({
      shelby_blob_id: ctx.blob_id,
      sha256: ctx.sha256,
      snippet: ctx.text.substring(0, 220) + (ctx.text.length > 220 ? '...' : ''),
      doc_path: ctx.doc_path,
      score: ctx.score,
    }));

    return {
      answer,
      citations,
    };
  }

  /**
   * Call LLM to generate answer
   */
  private async callLLM(
    question: string,
    contexts: Array<{ index: number; text: string }>
  ): Promise<string> {
    const systemPrompt = `You are a helpful assistant that answers questions based on provided context.

IMPORTANT RULES:
1. ONLY use information from the provided context to answer
2. If the context doesn't contain relevant information, say so
3. Be concise but comprehensive
4. Reference specific context items when making claims (e.g., "According to [1]...")
5. If multiple context items support a claim, mention them all

Do NOT:
- Make up information not in the context
- Use your general knowledge unless the context is insufficient
- Provide citations for general knowledge`;

    const contextText = contexts
      .map(ctx => `[${ctx.index}] ${ctx.text}`)
      .join('\n\n');

    const userPrompt = `Context:\n${contextText}\n\nQuestion: ${question}\n\nAnswer:`;

    try {
      const response = await this.llmClient.chat.completions.create({
        model: this.llmModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 1000,
      });

      return response.choices[0]?.message?.content || 'No answer generated.';
    } catch (error: any) {
      throw new AppError(
        `LLM call failed: ${error.message}`,
        'LLM_ERROR',
        500,
        { originalError: error }
      );
    }
  }

  /**
   * Validate query request
   */
  private validateQuery(request: QueryRequest) {
    if (!request.question || request.question.trim().length === 0) {
      throw new ValidationError('Question is required');
    }

    if (request.question.length > 500) {
      throw new ValidationError('Question is too long (max 500 characters)');
    }
  }
}

