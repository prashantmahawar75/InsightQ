type SpeechRecognitionEvent = {
  results: SpeechRecognitionResultList;
  resultIndex: number;
};

type SpeechRecognitionErrorEvent = {
  error: string;
};

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export function isSpeechSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

export function createSpeechRecognition(): SpeechRecognition | null {
  if (!isSpeechSupported()) return null;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  return recognition;
}

export interface VoiceInputCallbacks {
  onInterimResult: (transcript: string) => void;
  onFinalResult: (transcript: string) => void;
  onError: (error: string) => void;
  onStart: () => void;
  onEnd: () => void;
}

export function startVoiceInput(callbacks: VoiceInputCallbacks): (() => void) | null {
  const recognition = createSpeechRecognition();
  if (!recognition) {
    callbacks.onError('Speech recognition not supported');
    return null;
  }

  recognition.onstart = () => {
    callbacks.onStart();
  };

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        finalTranscript += result[0].transcript;
      } else {
        interimTranscript += result[0].transcript;
      }
    }

    if (finalTranscript) {
      callbacks.onFinalResult(finalTranscript);
    } else if (interimTranscript) {
      callbacks.onInterimResult(interimTranscript);
    }
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    if (event.error !== 'no-speech') {
      callbacks.onError(event.error);
    }
  };

  recognition.onend = () => {
    callbacks.onEnd();
  };

  recognition.start();

  // Return stop function
  return () => {
    recognition.stop();
  };
}
