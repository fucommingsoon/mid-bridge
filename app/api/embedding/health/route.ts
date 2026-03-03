// Embedding Health API Routes
// GET /api/embedding/health

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check if API key is configured
    const hasApiKey = !!process.env.BAILIAN_API_KEY;
    return NextResponse.json({
      status: hasApiKey ? 'healthy' : 'unhealthy',
      service: 'bailian-embedding',
      error: hasApiKey ? undefined : 'BAILIAN_API_KEY not configured',
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      service: 'bailian-embedding',
      error: String(error),
    });
  }
}
