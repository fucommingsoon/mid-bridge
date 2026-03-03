// Application Configuration
// Migrated from Python app/core/config.py

export const config = {
  // Application
  appName: 'Medi-Bridge',
  appVersion: '0.1.0',
  debug: process.env.NODE_ENV === 'development',

  // Qdrant Vector Database
  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    collection: process.env.QDRANT_COLLECTION || 'medical_knowledge',
    apiKey: process.env.QDRANT_API_KEY || undefined,
  },

  // Vector Search
  vector: {
    size: parseInt(process.env.VECTOR_SIZE || '1024'),
    topK: parseInt(process.env.TOP_K_RESULTS || '5'),
    similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD || '0.7'),
  },

  // Bailian ASR
  asr: {
    apiKey: process.env.BAILIAN_API_KEY || '',
    model: process.env.BAILIAN_ASR_MODEL || 'fun-asr-realtime',
    sampleRate: 16000,
    format: 'wav',
  },

  // Bailian Embedding
  embedding: {
    apiKey: process.env.BAILIAN_API_KEY || '',
    model: process.env.BAILIAN_EMBEDDING_MODEL || 'text-embedding-v4',
    dimension: 1024,
  },

  // Database
  database: {
    url: process.env.DATABASE_URL || '',
  },
} as const;

export type Config = typeof config;
