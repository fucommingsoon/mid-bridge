// ASR API Routes
// Migrated from Python app/api/v1/asr.py

import { NextRequest, NextResponse } from 'next/server';
import { asrService } from '@/lib/bailian/asr';

// POST /api/asr/recognize
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const detail = formData.get('detail') === 'true';

    if (!file) {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      );
    }

    // Get audio format from filename
    const format = asrService.getAudioFormat(file.name || 'audio.wav');
    const audioBuffer = Buffer.from(await file.arrayBuffer());

    const result = await asrService.recognizeBuffer(audioBuffer, format);

    if (detail) {
      return NextResponse.json(result);
    } else {
      // Simplified response
      return NextResponse.json({
        text: result.text,
        request_id: result.requestId,
        begin_time: result.beginTime || 0,
        end_time: result.endTime || 0,
        words: [],
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

// GET /api/asr/health
export async function GET() {
  try {
    // Check if API key is configured
    const hasApiKey = !!process.env.BAILIAN_API_KEY;
    return NextResponse.json({
      status: hasApiKey ? 'healthy' : 'unhealthy',
      service: 'bailian-asr',
      error: hasApiKey ? undefined : 'BAILIAN_API_KEY not configured',
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      service: 'bailian-asr',
      error: String(error),
    });
  }
}
