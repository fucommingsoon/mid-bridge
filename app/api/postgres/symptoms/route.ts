// Symptoms API Routes
// GET, POST /api/postgres/symptoms

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/postgres/symptoms - List symptoms
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const skip = parseInt(searchParams.get('skip') || '0');
  const limit = parseInt(searchParams.get('limit') || '100');

  try {
    const [total, symptoms] = await Promise.all([
      prisma.symptom.count(),
      prisma.symptom.findMany({
        skip,
        take: limit,
        orderBy: { id: 'asc' },
      }),
    ]);

    return NextResponse.json({
      total,
      items: symptoms.map((s) => ({
        id: s.id,
        cui: s.cui,
        name: s.name,
        alias: s.alias,
        definition: s.definition,
        external_ids: s.externalIds,
        created_at: s.createdAt,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// POST /api/postgres/symptoms - Create symptom
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const symptom = await prisma.symptom.create({
      data: {
        cui: body.cui,
        name: body.name,
        alias: body.alias,
        definition: body.definition,
        externalIds: body.external_ids,
      },
    });

    return NextResponse.json(
      {
        id: symptom.id,
        cui: symptom.cui,
        name: symptom.name,
        alias: symptom.alias,
        definition: symptom.definition,
        external_ids: symptom.externalIds,
        created_at: symptom.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
