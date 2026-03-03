// Voice Consultation API Routes
// POST /api/consultation/voice

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { asrService } from '@/lib/bailian/asr';
import { vectorService } from '@/lib/qdrant';

interface SymptomInfo {
  cui: string | null;
  summary: string | null;
  full_description: string | null;
  confidence_score: number;
}

export async function POST(request: NextRequest) {
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
