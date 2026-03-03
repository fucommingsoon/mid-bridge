// Embedding API Routes
// Migrated from Python app/api/v1/embedding.py

import { NextRequest, NextResponse } from 'next/server';
import { embeddingService } from '@/lib/bailian/embedding';
import { vectorService } from '@/lib/qdrant';

// GET /api/embedding/search
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  const topK = parseInt(searchParams.get('top_k') || '5');

  if (!query) {
    return NextResponse.json(
      { error: 'Query parameter is required' },
      { status: 400 }
    );
  }

  try {
    // Execute vector search (includes embedding and retrieval)
    const results = await vectorService.search(query, topK);

    return NextResponse.json({
      query,
      total_matches: results.length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/embedding/embed
export async function POST(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Route: /api/embedding/store
  if (path.endsWith('/store')) {
    return handleStore(request);
  }

  // Route: /api/embedding/embed
  try {
    const body = await request.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const embedding = await embeddingService.embedText(text);

    return NextResponse.json({
      text,
      embedding,
      dimension: embedding.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

// Handle store embedding
async function handleStore(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { text, metadata } = body;

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Generate ID based on timestamp
    const pointId = Date.now().toString();

    // Store in vector database
    await vectorService.store(pointId, text, metadata || {});

    return NextResponse.json({
      point_id: pointId,
      text,
      dimension: 1024,
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
