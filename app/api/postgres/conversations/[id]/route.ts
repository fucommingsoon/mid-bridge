// Conversation by ID API Routes
// GET, PATCH, DELETE /api/postgres/conversations/[id]

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const conversationId = parseInt(id);

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { sentAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const messages = conversation.messages.map((m) => ({
      id: m.id,
      conversation_id: m.conversationId,
      content: m.content,
      sent_at: m.sentAt,
      role: m.role,
      created_at: m.createdAt,
    }));

    return NextResponse.json({
      id: conversation.id,
      title: conversation.title,
      department: conversation.department,
      progress: conversation.progress,
      user_id: conversation.userId,
      patient_id: conversation.patientId,
      started_at: conversation.startedAt,
      created_at: conversation.createdAt,
      updated_at: conversation.updatedAt,
      messages,
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
    const conversationId = parseInt(id);
    const body = await request.json();

    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        title: body.title,
        department: body.department,
        progress: body.progress,
        userId: body.user_id,
        patientId: body.patient_id,
      },
    });

    return NextResponse.json({
      id: conversation.id,
      title: conversation.title,
      department: conversation.department,
      progress: conversation.progress,
      user_id: conversation.userId,
      patient_id: conversation.patientId,
      started_at: conversation.startedAt,
      created_at: conversation.createdAt,
      updated_at: conversation.updatedAt,
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
    const conversationId = parseInt(id);

    await prisma.conversation.delete({
      where: { id: conversationId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
