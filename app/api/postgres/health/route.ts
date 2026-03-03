// Health Check API
// GET /api/postgres/health

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // Simple query to check database connection
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'healthy',
      database: 'PostgreSQL',
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      database: 'PostgreSQL',
      error: String(error),
    });
  }
}
