// Disease by ID API Routes
// GET, PATCH, DELETE /api/postgres/diseases/[id]

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const diseaseId = parseInt(id);

    const disease = await prisma.disease.findUnique({
      where: { id: diseaseId },
      include: {
        symptoms: {
          include: {
            symptom: true,
          },
        },
      },
    });

    if (!disease) {
      return NextResponse.json({ error: 'Disease not found' }, { status: 404 });
    }

    const symptoms = disease.symptoms.map((assoc) => ({
      id: assoc.symptom.id,
      cui: assoc.symptom.cui,
      name: assoc.symptom.name,
      alias: assoc.symptom.alias,
      definition: assoc.symptom.definition,
      external_ids: assoc.symptom.externalIds,
      created_at: assoc.symptom.createdAt,
    }));

    return NextResponse.json({
      id: disease.id,
      cui: disease.cui,
      name: disease.name,
      alias: disease.alias,
      definition: disease.definition,
      external_ids: disease.externalIds,
      created_at: disease.createdAt,
      symptoms,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const diseaseId = parseInt(id);
    const body = await request.json();

    const disease = await prisma.disease.update({
      where: { id: diseaseId },
      data: {
        name: body.name,
        alias: body.alias,
        definition: body.definition,
        externalIds: body.external_ids,
      },
    });

    return NextResponse.json({
      id: disease.id,
      cui: disease.cui,
      name: disease.name,
      alias: disease.alias,
      definition: disease.definition,
      external_ids: disease.externalIds,
      created_at: disease.createdAt,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const diseaseId = parseInt(id);

    await prisma.disease.delete({
      where: { id: diseaseId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
