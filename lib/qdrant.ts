// Qdrant Vector Database Client
// Migrated from Python app/services/vector_service.py

import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from './config';
import { embeddingService } from './bailian/embedding';

export interface SearchResult {
  id: string | number;
  score: number;
  payload?: Record<string, unknown>;
}

class VectorService {
  private client: QdrantClient;
  private collectionName: string;
  private initialized: boolean = false;

  constructor() {
    this.client = new QdrantClient({
      url: config.qdrant.url,
      apiKey: config.qdrant.apiKey,
    });
    this.collectionName = config.qdrant.collection;
  }

  /**
   * Ensure collection exists
   */
  async ensureCollection(): Promise<void> {
    if (this.initialized) return;

    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(
        (c) => c.name === this.collectionName
      );

      if (!exists) {
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: config.vector.size,
            distance: 'Cosine',
          },
        });
      }

      this.initialized = true;
    } catch (error) {
      console.error('Failed to ensure collection:', error);
      throw error;
    }
  }

  /**
   * Search for similar vectors
   */
  async search(
    query: string,
    topK: number = config.vector.topK,
    threshold: number = config.vector.similarityThreshold
  ): Promise<SearchResult[]> {
    await this.ensureCollection();

    // Generate embedding for query
    const queryVector = await embeddingService.embedText(query);

    // Search in Qdrant
    const results = await this.client.search(this.collectionName, {
      vector: queryVector,
      limit: topK,
      score_threshold: threshold,
    });

    return results.map((result) => ({
      id: result.id,
      score: result.score,
      payload: result.payload as Record<string, unknown>,
    }));
  }

  /**
   * Store a vector with payload
   */
  async store(
    id: string | number,
    text: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    await this.ensureCollection();

    // Generate embedding
    const vector = await embeddingService.embedText(text);

    // Store in Qdrant
    await this.client.upsert(this.collectionName, {
      wait: true,
      points: [
        {
          id: id,
          vector: vector,
          payload: {
            text,
            ...payload,
          },
        },
      ],
    });
  }

  /**
   * Store multiple vectors (batch)
   */
  async storeBatch(
    items: Array<{
      id: string | number;
      text: string;
      payload?: Record<string, unknown>;
    }>
  ): Promise<void> {
    await this.ensureCollection();

    // Generate embeddings in batch
    const texts = items.map((item) => item.text);
    const embeddings = await embeddingService.embedBatch(texts);

    // Prepare points
    const points = items.map((item, index) => ({
      id: item.id,
      vector: embeddings[index],
      payload: {
        text: item.text,
        ...item.payload,
      },
    }));

    // Store in Qdrant
    await this.client.upsert(this.collectionName, {
      wait: true,
      points: points,
    });
  }

  /**
   * Delete a vector by ID
   */
  async delete(id: string | number): Promise<void> {
    await this.client.delete(this.collectionName, {
      wait: true,
      points: [id],
    });
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; collections: number }> {
    try {
      const collections = await this.client.getCollections();
      return {
        status: 'healthy',
        collections: collections.collections.length,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        collections: 0,
      };
    }
  }
}

// Singleton instance
export const vectorService = new VectorService();
