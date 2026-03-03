// Conversations API Routes
// GET, POST /api/postgres/conversations

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/postgres/conversations - List conversations
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const skip = parseInt(searchParams.get('skip') || '0');
  const limit = parseInt(searchParams.get('limit') || '100');

  try {
    const [total, conversations] = await Promise.all([
      prisma.conversation.count(),
      prisma.conversation.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return NextResponse.json({
      total,
      items: conversations.map((c) => ({
        id: c.id,
        title: c.title,
        department: c.department,
        progress: c.progress,
        user_id: c.userId,
        patient_id: c.patientId,
        started_at: c.startedAt,
        created_at: c.createdAt,
        updated_at: c.updatedAt,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// POST /api/postgres/conversations - Create conversation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const conversation = await prisma.conversation.create({
      data: {
        title: body.title,
        department: body.department,
        progress: body.progress,
        userId: body.user_id,
        patientId: body.patient_id,
      },
    });

    return NextResponse.json(
      {
        id: conversation.id,
        title: conversation.title,
        department: conversation.department,
        progress: conversation.progress,
        user_id: conversation.userId,
        patient_id: conversation.patientId,
        started_at: conversation.startedAt,
        created_at: conversation.createdAt,
        updated_at: conversation.updatedAt,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
