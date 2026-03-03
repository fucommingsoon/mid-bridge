// API client for consultation services
// Uses relative paths for Next.js API routes

// Types
export interface SymptomMatch {
  cui?: string | null;
  summary?: string | null;
  full_description?: string | null;
  confidence_score: number;
}

export interface VoiceConsultationResponse {
  conversation_id: number;
  message_id: number;
  recognized_text: string;
  query: string;
  results: SymptomMatch[];
  total_matches: number;
}

export interface CreateConversationResponse {
  conversation_id: number;
  title: string;
  department: string;
  created_at: string;
}

/**
 * Create consultation session
 * POST /api/consultation/conversation
 */
export async function createConsultationSession(
  title?: string,
  department?: string
): Promise<CreateConversationResponse> {
  const response = await fetch('/api/consultation/conversation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: title || '语音问诊',
      department: department || 'General',
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '创建会话失败' }));
    throw new Error(error.error || '创建会话失败');
  }

  return response.json();
}

/**
 * Upload audio for voice consultation
 * POST /api/consultation/voice
 */
export async function uploadAudio(
  audioBlob: Blob,
  conversationId: number,
  options?: {
    audioFormat?: string;
    topK?: number;
  }
): Promise<VoiceConsultationResponse> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.wav');
  formData.append('conversation_id', conversationId.toString());
  formData.append('audio_format', options?.audioFormat || 'wav');
  formData.append('top_k', (options?.topK || 5).toString());

  const response = await fetch('/api/consultation/voice', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '音频转录失败' }));
    throw new Error(error.error || '音频转录失败');
  }

  return response.json();
}
