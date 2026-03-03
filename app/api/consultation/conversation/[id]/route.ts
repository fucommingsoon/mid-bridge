// Conversation by ID API Routes
// GET /api/consultation/conversation/[id]

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const conversationId = parseInt(id);

    if (isNaN(conversationId)) {
      return NextResponse.json(
        { error: 'Invalid conversation ID' },
        { status: 400 }
      );
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: `Conversation ${conversationId} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      conversation_id: conversation.id,
      title: conversation.title,
      department: conversation.department,
      message_count: conversation.messages.length,
      created_at: conversation.createdAt,
      updated_at: conversation.updatedAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
