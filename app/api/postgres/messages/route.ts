// Messages API Routes
// GET, POST /api/postgres/messages

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// POST /api/postgres/messages - Create message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = await prisma.message.create({
      data: {
        conversationId: body.conversation_id,
        content: body.content,
        role: body.role,
      },
    });

    return NextResponse.json(
      {
        id: message.id,
        conversation_id: message.conversationId,
        content: message.content,
        sent_at: message.sentAt,
        role: message.role,
        created_at: message.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
