// Embedding Store API Routes
// POST /api/embedding/store

import { NextRequest, NextResponse } from 'next/server';
import { vectorService } from '@/lib/qdrant';

export async function POST(request: NextRequest) {
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
