// Consultation API Routes
// Migrated from Python app/api/v1/consultation.py

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { asrService } from '@/lib/bailian/asr';
import { vectorService } from '@/lib/qdrant';

// Types
interface SymptomInfo {
  cui: string | null;
  summary: string | null;
  full_description: string | null;
  confidence_score: number;
}

// POST /api/consultation/conversation - Create conversation
export async function POST(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Route: /api/consultation/conversation
  if (path.endsWith('/conversation')) {
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

  // Route: /api/consultation/query
  if (path.endsWith('/query')) {
    try {
      const body = await request.json();
      const { query, top_k = 5 } = body;

      if (!query) {
        return NextResponse.json(
          { error: 'Query is required' },
          { status: 400 }
        );
      }

      // Execute vector search
      const results = await vectorService.search(query, top_k);

      // Format results
      const formattedResults: SymptomInfo[] = results.map((result) => ({
        cui: (result.payload?.cui as string) || null,
        summary: (result.payload?.summary as string) || null,
        full_description: (result.payload?.full_description as string) || null,
        confidence_score: result.score,
      }));

      return NextResponse.json({
        query,
        results: formattedResults,
        total_matches: results.length,
      });
    } catch (error) {
      return NextResponse.json(
        { error: String(error) },
        { status: 500 }
      );
    }
  }

  // Route: /api/consultation/voice
  if (path.endsWith('/voice')) {
    return handleVoiceConsultation(request);
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// GET /api/consultation/conversation/[id] - Get conversation
export async function GET(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const pathParts = path.split('/');
  const conversationIdStr = pathParts[pathParts.length - 1];
  const conversationId = parseInt(conversationIdStr);

  // Route: /api/consultation/health
  if (path.endsWith('/health')) {
    const isHealthy = await vectorService.healthCheck();
    return NextResponse.json({
      status: isHealthy.status === 'healthy' ? 'healthy' : 'unhealthy',
    });
  }

  // Route: /api/consultation/conversation/[id]
  if (!isNaN(conversationId)) {
    try {
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

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// Handle voice consultation
async function handleVoiceConsultation(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const conversationIdStr = formData.get('conversation_id') as string | null;
    const audioFormat = (formData.get('audio_format') as string) || 'wav';
    const topK = parseInt((formData.get('top_k') as string) || '5');

    if (!file) {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      );
    }

    // Step 1: Get or create conversation
    let conversation;
    if (conversationIdStr) {
      const conversationId = parseInt(conversationIdStr);
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });
      if (!conversation) {
        return NextResponse.json(
          { error: `Conversation ${conversationId} not found` },
          { status: 404 }
        );
      }
    } else {
      conversation = await prisma.conversation.create({
        data: {
          title: 'Voice Consultation',
          department: 'General',
        },
      });
    }

    // Step 2: ASR - Recognize voice to text
    const audioBuffer = Buffer.from(await file.arrayBuffer());
    const format = audioFormat || asrService.getAudioFormat(file.name || 'audio.wav');

    let recognizedText: string;
    try {
      const asrResult = await asrService.recognizeBuffer(audioBuffer, format);
      recognizedText = asrResult.text;
    } catch (error) {
      return NextResponse.json(
        { error: `Speech recognition failed: ${error}` },
        { status: 500 }
      );
    }

    if (!recognizedText) {
      return NextResponse.json(
        { error: 'No speech recognized from audio' },
        { status: 400 }
      );
    }

    // Step 3: Vector search on recognized text
    let searchResults: Array<{ id: string | number; score: number; payload?: Record<string, unknown> }> = [];
    try {
      searchResults = await vectorService.search(recognizedText, topK);
    } catch {
      // Vector search failed, but still save the message
    }

    // Format search results
    const formattedResults: SymptomInfo[] = searchResults.map((result) => ({
      cui: (result.payload?.cui as string) || null,
      summary: (result.payload?.summary as string) || null,
      full_description: (result.payload?.full_description as string) || null,
      confidence_score: result.score,
    }));

    // Step 4: Save message to database
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        content: recognizedText,
      },
    });

    // Step 5: Return complete response
    return NextResponse.json({
      conversation_id: conversation.id,
      message_id: message.id,
      recognized_text: recognizedText,
      query: recognizedText,
      results: formattedResults,
      total_matches: searchResults.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
