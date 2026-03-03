// Diseases API Routes
// Migrated from Python app/api/v1/postgres.py

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/postgres/diseases - List diseases
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const skip = parseInt(searchParams.get('skip') || '0');
  const limit = parseInt(searchParams.get('limit') || '100');

  try {
    const [total, diseases] = await Promise.all([
      prisma.disease.count(),
      prisma.disease.findMany({
        skip,
        take: limit,
        orderBy: { id: 'asc' },
      }),
    ]);

    return NextResponse.json({
      total,
      items: diseases.map((d) => ({
        id: d.id,
        cui: d.cui,
        name: d.name,
        alias: d.alias,
        definition: d.definition,
        external_ids: d.externalIds,
        created_at: d.createdAt,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// POST /api/postgres/diseases - Create disease
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const disease = await prisma.disease.create({
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
        id: disease.id,
        cui: disease.cui,
        name: disease.name,
        alias: disease.alias,
        definition: disease.definition,
        external_ids: disease.externalIds,
        created_at: disease.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
