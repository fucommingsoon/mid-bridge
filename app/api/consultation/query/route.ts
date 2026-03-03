// Query API Routes
// POST /api/consultation/query

import { NextRequest, NextResponse } from 'next/server';
import { vectorService } from '@/lib/qdrant';

interface SymptomInfo {
  cui: string | null;
  summary: string | null;
  full_description: string | null;
  confidence_score: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, top_k = 5 } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Execute vector search
    const results = await vectorService.search(query, top_k);

    // Format results
    const formattedResults: SymptomInfo[] = results.map((result) => ({
      cui: (result.payload?.cui as string) || null,
      summary: (result.payload?.summary as string) || null,
      full_description: (result.payload?.full_description as string) || null,
      confidence_score: result.score,
    }));

    return NextResponse.json({
      query,
      results: formattedResults,
      total_matches: results.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
