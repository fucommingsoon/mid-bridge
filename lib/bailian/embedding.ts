// Bailian Text Embedding Service (HTTP API wrapper)
// Migrated from Python app/services/embedding_service.py

import { config } from '../config';

const BAILIAN_EMBEDDING_URL = 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding';

export interface EmbeddingResult {
  embedding: number[];
  textIndex: number;
}

export interface EmbeddingResponse {
  embeddings: EmbeddingResult[];
  requestId: string;
  usage: {
    totalTokens: number;
  };
}

class EmbeddingService {
  private apiKey: string;
  private model: string;
  private dimension: number;

  constructor() {
    this.apiKey = config.embedding.apiKey;
    this.model = config.embedding.model;
    this.dimension = config.embedding.dimension;
  }

  /**
   * Convert text to embedding vector
   */
  async embedText(text: string): Promise<number[]> {
    if (!text || !text.trim()) {
      throw new Error('Input text cannot be empty');
    }

    if (!this.apiKey) {
      throw new Error('BAILIAN_API_KEY not configured');
    }

    try {
      const response = await fetch(BAILIAN_EMBEDDING_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: {
            texts: [text],
          },
          parameters: {
            text_type: 'query',
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json() as { message?: string };
        throw new Error(`Embedding API error: ${error.message || response.statusText}`);
      }

      const result = await response.json() as {
        output: {
          embeddings: Array<{
            text_index: number;
            embedding: number[];
          }>;
        };
        request_id: string;
        usage: { total_tokens: number };
      };

      const embedding = result.output?.embeddings?.[0]?.embedding;
      if (!embedding) {
        throw new Error('Embedding returned no results');
      }

      return embedding;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Embedding failed: ${String(error)}`);
    }
  }

  /**
   * Convert multiple texts to embedding vectors (batch processing)
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      throw new Error('Input texts list cannot be empty');
    }

    if (!this.apiKey) {
      throw new Error('BAILIAN_API_KEY not configured');
    }

    try {
      const response = await fetch(BAILIAN_EMBEDDING_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: {
            texts: texts,
          },
          parameters: {
            text_type: 'query',
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json() as { message?: string };
        throw new Error(`Batch embedding API error: ${error.message || response.statusText}`);
      }

      const result = await response.json() as {
        output: {
          embeddings: Array<{
            text_index: number;
            embedding: number[];
          }>;
        };
        request_id: string;
      };

      // Sort by text_index to ensure correct order
      const embeddings = result.output?.embeddings
        ?.sort((a, b) => a.text_index - b.text_index)
        ?.map((item) => item.embedding) || [];

      if (embeddings.length === 0) {
        throw new Error('Batch embedding returned no results');
      }

      return embeddings;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Batch embedding failed: ${String(error)}`);
    }
  }

  /**
   * Get the embedding dimension
   */
  getDimension(): number {
    return this.dimension;
  }
}

// Singleton instance
export const embeddingService = new EmbeddingService();
