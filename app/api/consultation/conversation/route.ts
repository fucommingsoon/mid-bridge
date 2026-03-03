// Conversation API Routes
// POST /api/consultation/conversation - Create conversation

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const title = body.title || 'Voice Consultation';
    const department = body.department || 'General';

    const conversation = await prisma.conversation.create({
      data: {
        title,
        department,
      },
    });

    return NextResponse.json({
      conversation_id: conversation.id,
      title: conversation.title,
      department: conversation.department,
      created_at: conversation.createdAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to create conversation: ${error}` },
      { status: 500 }
    );
  }
}
