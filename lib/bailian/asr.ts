// Bailian ASR Service (OpenAI compatible mode)
// Using DashScope Qwen-ASR model

import { config } from '../config';

// OpenAI compatible endpoint for Qwen-ASR
const BAILIAN_ASR_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

// MIME type mapping
const FORMAT_TO_MIME: Record<string, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  pcm: 'audio/pcm',
  opus: 'audio/opus',
  speex: 'audio/speex',
  aac: 'audio/aac',
  amr: 'audio/amr',
};

export interface ASRResult {
  text: string;
  requestId: string;
  beginTime?: number;
  endTime?: number;
  words?: Array<{
    text: string;
    beginTime?: number;
    endTime?: number;
    punctuation?: string;
  }>;
}

class ASRService {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = config.asr.apiKey;
    // Use qwen3-asr-flash model (OpenAI compatible)
    this.model = 'qwen3-asr-flash';
  }

  /**
   * Recognize audio from buffer using OpenAI compatible API
   */
  async recognizeBuffer(
    audioBuffer: Buffer,
    format: string = 'wav'
  ): Promise<ASRResult> {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Audio buffer is empty');
    }

    if (!this.apiKey) {
      throw new Error('BAILIAN_API_KEY not configured');
    }

    // Validate format
    const supportedFormats = ['pcm', 'wav', 'mp3', 'opus', 'speex', 'aac', 'amr'];
    const normalizedFormat = format.toLowerCase();
    if (!supportedFormats.includes(normalizedFormat)) {
      throw new Error(
        `Unsupported audio format: ${format}. Supported: ${supportedFormats.join(', ')}`
      );
    }

    try {
      // Convert buffer to base64 Data URL format
      const base64Audio = audioBuffer.toString('base64');
      const mimeType = FORMAT_TO_MIME[normalizedFormat] || 'audio/wav';
      const dataUri = `data:${mimeType};base64,${base64Audio}`;

      const response = await fetch(BAILIAN_ASR_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_audio',
                  input_audio: {
                    data: dataUri,
                  },
                },
              ],
            },
          ],
          stream: false,
        }),
      });

      if (!response.ok) {
        const error = await response.json() as { error?: { message?: string } };
        throw new Error(`ASR API error: ${error.error?.message || response.statusText}`);
      }

      const result = await response.json() as {
        id: string;
        choices: Array<{
          message: {
            content: string;
            annotations?: Array<{
              language?: string;
              emotion?: string;
            }>;
          };
        }>;
        usage?: {
          seconds?: number;
        };
      };

      const content = result.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('ASR returned no results');
      }

      return {
        text: content,
        requestId: result.id,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`ASR recognition failed: ${String(error)}`);
    }
  }

  /**
   * Get audio format from filename
   */
  getAudioFormat(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const supportedFormats = ['pcm', 'wav', 'mp3', 'opus', 'speex', 'aac', 'amr'];

    if (!supportedFormats.includes(ext)) {
      throw new Error(
        `Unsupported audio format: ${ext}. Supported: ${supportedFormats.join(', ')}`
      );
    }
    return ext;
  }
}

// Singleton instance
export const asrService = new ASRService();
