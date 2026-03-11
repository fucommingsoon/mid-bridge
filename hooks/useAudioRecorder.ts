'use client';

import { useRef, useCallback, useState, useEffect } from 'react';

interface AudioRecorderOptions {
  onDataAvailable: (blob: Blob) => void;
  onError?: (error: Error) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: (duration: number) => void;
  onSilenceSubmit?: (blob: Blob, blobSize: number, duration: number) => void;
  silenceThreshold?: number;
  silenceDuration?: number;
  minSpeechDuration?: number;
}

// WAV encoder constants
const SAMPLE_RATE = 16000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

function encodeWAV(samples: Float32Array): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, (SAMPLE_RATE * CHANNELS * BITS_PER_SAMPLE) / 8, true);
  view.setUint16(32, (CHANNELS * BITS_PER_SAMPLE) / 8, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  floatTo16BitPCM(view, 44, samples);

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function floatTo16BitPCM(view: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
}

function mergeFloat32Arrays(arrays: Float32Array[]): Float32Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Float32Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

export function useAudioRecorder({
  onDataAvailable,
  onError,
  onSpeechStart,
  onSpeechEnd,
  onSilenceSubmit,
  silenceThreshold = 0.15,
  minSpeechDuration = 800,
}: AudioRecorderOptions) {
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const currentPcmDataRef = useRef<Float32Array[]>([]);
  const isPausedRecordingRef = useRef(false);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);
  const isSpeechDetectedRef = useRef(false);
  const speechStartTimeRef = useRef<number>(0);
  const checkSilenceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const consecutiveSilentFramesRef = useRef<number>(0);
  const consecutiveSpeechFramesRef = useRef<number>(0);
  const MIN_SPEECH_FRAMES = 5;
  const MIN_SILENCE_FRAMES = 5;

  const isSilent = useCallback(
    (analyser: AnalyserNode): boolean => {
      const dataArray = new Uint8Array(analyser.fftSize);
      analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      let count = 0;
      for (let i = 4; i < dataArray.length; i++) {
        sum += dataArray[i];
        count++;
      }
      const average = sum / count;
      const normalized = average / 255;

      return normalized < silenceThreshold;
    },
    [silenceThreshold]
  );

  const getCurrentWavBlob = useCallback((): Blob | null => {
    const pcmData = currentPcmDataRef.current;
    if (pcmData.length === 0) return null;

    const merged = mergeFloat32Arrays(pcmData);
    return encodeWAV(merged);
  }, []);

  const clearCurrentSegment = useCallback(() => {
    currentPcmDataRef.current = [];
  }, []);

  const checkSilence = useCallback(() => {
    const analyser = analyserRef.current;

    if (!analyser || !isRecordingRef.current || isPausedRef.current) {
      return;
    }

    const isCurrentlySilent = isSilent(analyser);
    const now = Date.now();

    if (isCurrentlySilent) {
      consecutiveSilentFramesRef.current++;
      consecutiveSpeechFramesRef.current = 0;
    } else {
      consecutiveSpeechFramesRef.current++;
      consecutiveSilentFramesRef.current = 0;
    }

    if (!isSpeechDetectedRef.current && consecutiveSpeechFramesRef.current >= MIN_SPEECH_FRAMES) {
      isSpeechDetectedRef.current = true;
      speechStartTimeRef.current = now - consecutiveSpeechFramesRef.current * 100;
      onSpeechStart?.();
    }

    if (isSpeechDetectedRef.current && consecutiveSilentFramesRef.current >= MIN_SILENCE_FRAMES) {
      const speechDurationMs = now - speechStartTimeRef.current;

      if (speechDurationMs >= minSpeechDuration) {
        const blob = getCurrentWavBlob();
        if (blob) {
          const blobSize = blob.size / 1024;

          onSpeechEnd?.(speechDurationMs);
          onSilenceSubmit?.(blob, blobSize, speechDurationMs);
          onDataAvailable(blob);

          isSpeechDetectedRef.current = false;
          speechStartTimeRef.current = 0;
          consecutiveSilentFramesRef.current = 0;
          clearCurrentSegment();
        }
      } else {
        isSpeechDetectedRef.current = false;
        speechStartTimeRef.current = 0;
        consecutiveSilentFramesRef.current = 0;
        clearCurrentSegment();
      }
    }
  }, [isSilent, minSpeechDuration, getCurrentWavBlob, clearCurrentSegment, onDataAvailable, onSpeechStart, onSpeechEnd, onSilenceSubmit]);

  const startRecording = useCallback(async () => {
    try {
      // 检查浏览器环境和 API 可用性
      if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        throw new Error('Browser environment not available');
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia API not supported in this browser');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: CHANNELS,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      setAnalyser(analyser);

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(analyser);

      const bufferSize = 4096;
      const scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);

      scriptProcessor.onaudioprocess = (event) => {
        if (isPausedRecordingRef.current) return;
        const inputData = event.inputBuffer.getChannelData(0);
        currentPcmDataRef.current.push(new Float32Array(inputData));
      };

      source.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);
      processorRef.current = scriptProcessor;

      isRecordingRef.current = true;
      isPausedRef.current = false;
      isPausedRecordingRef.current = false;
      isSpeechDetectedRef.current = false;
      speechStartTimeRef.current = 0;
      consecutiveSilentFramesRef.current = 0;
      consecutiveSpeechFramesRef.current = 0;
      currentPcmDataRef.current = [];

      checkSilenceIntervalRef.current = setInterval(checkSilence, 100);

      setIsRecording(true);
      setIsPaused(false);

      return true;
    } catch (error) {
      onError?.(error as Error);
      return false;
    }
  }, [checkSilence, onError]);

  const pauseRecording = useCallback(() => {
    if (isPausedRef.current) return;
    isPausedRef.current = true;
    isPausedRecordingRef.current = true;
    setIsPaused(true);
  }, []);

  const resumeRecording = useCallback(() => {
    if (!isPausedRef.current) return;
    isPausedRef.current = false;
    isPausedRecordingRef.current = false;
    setIsPaused(false);
  }, []);

  const stopRecording = useCallback(() => {
    if (checkSilenceIntervalRef.current) {
      clearInterval(checkSilenceIntervalRef.current);
    }

    isPausedRef.current = false;
    isPausedRecordingRef.current = false;
    isRecordingRef.current = false;

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    analyserRef.current = null;
    currentPcmDataRef.current = [];
    consecutiveSilentFramesRef.current = 0;
    consecutiveSpeechFramesRef.current = 0;

    setIsRecording(false);
    setIsPaused(false);
    setAnalyser(null);
  }, []);

  useEffect(() => {
    return () => {
      if (isRecordingRef.current) {
        stopRecording();
      }
    };
  }, [stopRecording]);

  return {
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    isRecording,
    isPaused,
    analyser,
  };
}
