'use client';

import { useState, useEffect, useRef } from 'react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { createConsultationSession, uploadAudio, SymptomMatch } from '@/lib/api/consultation';
import { AudioWaveform } from '@/components/AudioWaveform';

type PageState = 'home' | 'consulting';

interface TranscriptionMessage {
  id: string;
  content: string;
  timestamp: Date;
}

interface VoiceClip {
  id: string;
  blob: Blob;
  blobSize: number;
  duration: number;
  submitTime: Date;
  transcription?: string;
}

interface MatchedSymptom {
  cui: string;
  summary: string;
  confidence: number;
  description: string;
}

export default function Home() {
  const [pageState, setPageState] = useState<PageState>('home');
  const [messages, setMessages] = useState<TranscriptionMessage[]>([]);
  const [symptoms, setSymptoms] = useState<MatchedSymptom[]>([]);
  const [voiceClips, setVoiceClips] = useState<VoiceClip[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [showVoiceClipsPanel, setShowVoiceClipsPanel] = useState(false);

  const conversationIdRef = useRef<number | null>(null);
  const pendingClipIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, voiceClips]);

  const {
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    isRecording,
    isPaused,
    analyser: recorderAnalyser,
  } = useAudioRecorder({
    onDataAvailable: async (audioBlob) => {
      const currentConversationId = conversationIdRef.current;
      if (!currentConversationId) return;

      try {
        const result = await uploadAudio(audioBlob, currentConversationId);

        if (result.recognized_text) {
          setMessages((prev) => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random()}`,
              content: result.recognized_text,
              timestamp: new Date(),
            },
          ]);
        }

        if (pendingClipIdRef.current) {
          setVoiceClips((prev) =>
            prev.map((clip) =>
              clip.id === pendingClipIdRef.current
                ? { ...clip, transcription: result.recognized_text }
                : clip
            )
          );
          pendingClipIdRef.current = null;
        }

        if (result.results && result.results.length > 0) {
          setSymptoms(
            result.results.map((r: SymptomMatch) => ({
              cui: r.cui || '',
              summary: r.summary || '',
              confidence: r.confidence_score,
              description: r.full_description || '',
            }))
          );
        }
      } catch (error) {
        console.error('API request failed:', error);
      }
    },
    onError: (error) => {
      console.error('Recording error:', error);
    },
    onSpeechStart: () => {
      setIsSpeaking(true);
    },
    onSpeechEnd: () => {
      setIsSpeaking(false);
    },
    onSilenceSubmit: (blob, blobSize, duration) => {
      const clipId = `${Date.now()}-${Math.random()}`;
      const clip: VoiceClip = {
        id: clipId,
        blob: blob,
        blobSize: blobSize,
        duration: duration,
        submitTime: new Date(),
      };
      setVoiceClips((prev) => [...prev, clip]);
      pendingClipIdRef.current = clipId;
    },
    silenceThreshold: 0.1,
    silenceDuration: 2000,
    minSpeechDuration: 800,
  });

  useEffect(() => {
    setAnalyser(recorderAnalyser);
  }, [recorderAnalyser]);

  const handleStartConsultation = async () => {
    try {
      // 检查浏览器环境
      if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        alert('请在浏览器中访问此页面');
        return;
      }

      // 检查 getUserMedia API 支持
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('您的浏览器不支持音频录制，请使用现代浏览器（Chrome、Firefox、Safari 等）');
        return;
      }

      const session = await createConsultationSession('语音问诊', 'General');
      const cid = session.conversation_id;

      conversationIdRef.current = cid;
      setConversationId(cid);

      const started = await startRecording();
      if (started) {
        setPageState('consulting');
      } else {
        alert('启动录音失败，请检查麦克风权限');
      }
    } catch (error) {
      console.error('Failed to start consultation:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      alert(`启动问诊失败：${errorMessage}\n\n请确保：\n1. 允许麦克风权限\n2. 使用 HTTPS 或 localhost 访问\n3. 浏览器支持音频录制`);
    }
  };

  const handleEndConsultation = () => {
    stopRecording();
    setPageState('home');
    setMessages([]);
    setSymptoms([]);
    setVoiceClips([]);
    setConversationId(null);
    conversationIdRef.current = null;
    pendingClipIdRef.current = null;
  };

  const handlePauseResume = () => {
    if (isPaused) {
      resumeRecording();
    } else {
      pauseRecording();
    }
  };

  // Home page
  if (pageState === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex flex-col">
        <header className="px-6 pt-12 pb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Medi Bridge</h1>
              <p className="text-gray-600">智能诊室辅助系统</p>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-sm">
            <div className="bg-white rounded-3xl shadow-xl p-8 mb-6">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-10 h-10 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">开始辅助问诊</h2>
                <p className="text-gray-500 text-sm">
                  系统将自动录制对话并实时转录，
                  <br />
                  同时智能分析可能的病症
                </p>
              </div>

              <button
                onClick={handleStartConsultation}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold py-4 rounded-2xl shadow-lg hover:shadow-xl active:scale-[0.98] transition-all"
              >
                开始问诊
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/60 backdrop-blur rounded-2xl p-4 text-center">
                <div className="text-2xl mb-2">🎤</div>
                <p className="text-xs text-gray-600">实时录音</p>
              </div>
              <div className="bg-white/60 backdrop-blur rounded-2xl p-4 text-center">
                <div className="text-2xl mb-2">📝</div>
                <p className="text-xs text-gray-600">对话转录</p>
              </div>
              <div className="bg-white/60 backdrop-blur rounded-2xl p-4 text-center">
                <div className="text-2xl mb-2">🔍</div>
                <p className="text-xs text-gray-600">病症分析</p>
              </div>
            </div>
          </div>
        </main>

        <footer className="px-6 py-6 text-center">
          <p className="text-xs text-gray-400">辅助诊断仅供参考 · 请以医生判断为准</p>
        </footer>
      </div>
    );
  }

  // Consulting page
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isRecording && !isPaused && (
              <>
                <div
                  className={`w-2 h-2 rounded-full ${
                    isSpeaking ? 'bg-green-500 scale-150' : 'bg-red-500'
                  } transition-all duration-200`}
                ></div>
                <span className="text-sm text-gray-600">
                  {isSpeaking ? '正在说话...' : '录音中'}
                </span>
              </>
            )}
            {isRecording && isPaused && (
              <>
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                <span className="text-sm text-gray-600">已暂停</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isRecording && (
              <button
                onClick={handlePauseResume}
                className="px-4 py-2 bg-yellow-50 text-yellow-600 rounded-lg text-sm font-medium active:bg-yellow-100"
              >
                {isPaused ? '▶ 继续' : '⏸ 暂停'}
              </button>
            )}
            <button
              onClick={handleEndConsultation}
              className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium active:bg-red-100"
            >
              结束问诊
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto px-4 py-4 pb-safe-bottom">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Audio waveform */}
          {analyser && (
            <section className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <span className="text-lg">🎤</span>
                  音频录入
                </h3>
                <span className="text-xs text-gray-400">
                  {isSpeaking ? '正在录音...' : '等待语音...'}
                </span>
              </div>
              <AudioWaveform
                analyser={analyser}
                isRecording={isRecording}
                isPaused={isPaused}
                silenceThreshold={0.1}
              />
            </section>
          )}

          {/* Symptom matches */}
          {symptoms.length > 0 && (
            <section className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <span className="text-lg">🔍</span>
                  识别的症状
                </h3>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                  {symptoms.length} 项匹配
                </span>
              </div>
              <div className="space-y-3">
                {symptoms.map((symptom, index) => (
                  <div
                    key={index}
                    className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">
                            {symptom.summary || '未知症状'}
                          </span>
                          {symptom.cui && (
                            <span className="text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded font-mono">
                              {symptom.cui}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <span
                          className={`text-sm font-bold ${
                            symptom.confidence >= 0.8
                              ? 'text-green-600'
                              : symptom.confidence >= 0.5
                                ? 'text-yellow-600'
                                : 'text-red-500'
                          }`}
                        >
                          {Math.round(symptom.confidence * 100)}%
                        </span>
                      </div>
                    </div>

                    <div className="mb-2">
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            symptom.confidence >= 0.8
                              ? 'bg-green-500'
                              : symptom.confidence >= 0.5
                                ? 'bg-yellow-500'
                                : 'bg-red-400'
                          }`}
                          style={{ width: `${symptom.confidence * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    {symptom.description && (
                      <p className="text-xs text-gray-600 leading-relaxed">{symptom.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Conversation messages */}
          <section className="bg-white rounded-2xl shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="text-lg">💬</span>
              对话记录
            </h3>
            <div className="space-y-3">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">等待对话...</div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <div key={msg.id} className="bg-gray-50 rounded-2xl rounded-tl-none px-4 py-3">
                      <p className="text-sm text-gray-800">{msg.content}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {msg.timestamp.toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </p>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Voice clips floating button */}
      <button
        onClick={() => setShowVoiceClipsPanel(!showVoiceClipsPanel)}
        className="fixed bottom-6 right-6 z-50 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg flex items-center gap-2 px-4 py-3 transition-all"
      >
        <span className="text-xl">🎵</span>
        <span className="text-sm font-medium">{voiceClips.length} 片段</span>
      </button>

      {/* Voice clips panel */}
      {showVoiceClipsPanel && (
        <div className="fixed bottom-20 right-6 z-50 w-80 max-h-[60vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <span>🎵</span>
              检测到的语音片段
              <span className="text-xs text-gray-400 font-normal">({voiceClips.length})</span>
            </h3>
            <button
              onClick={() => setShowVoiceClipsPanel(false)}
              className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <svg
                className="w-4 h-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-auto p-3 space-y-2">
            {voiceClips.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">等待语音输入...</div>
            ) : (
              voiceClips.map((clip) => (
                <div key={clip.id} className="bg-gray-50 rounded-xl px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-gray-900">
                        {(clip.duration / 1000).toFixed(1)}秒
                      </span>
                      <span className="text-xs text-gray-400"> · </span>
                      <span className="text-xs text-gray-500">{clip.blobSize.toFixed(1)}KB</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      {clip.transcription ? '✓' : '⏳'}
                    </span>
                  </div>
                  {clip.transcription && (
                    <p className="text-xs text-gray-700 mt-1 line-clamp-2">"{clip.transcription}"</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
