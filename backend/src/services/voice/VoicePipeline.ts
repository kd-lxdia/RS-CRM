import { SarvamSTT } from './providers/SarvamSTT';
import { OpenRouterLLM } from './providers/OpenRouterLLM';
import { SarvamTTS } from './providers/SarvamTTS';
import { EventEmitter } from 'events';

export class VoicePipeline extends EventEmitter {
  private stt: SarvamSTT;
  private llm: OpenRouterLLM;
  private tts: SarvamTTS;
  private sessionId: string;
  private isProcessing: boolean = false;
  private textBuffer: string = '';
  
  constructor(sessionId: string, systemPrompt: string, sarvamKey?: string, openRouterKey?: string) {
    super();
    this.sessionId = sessionId;
    
    this.stt = new SarvamSTT(sarvamKey);
    this.llm = new OpenRouterLLM(systemPrompt, openRouterKey);
    this.tts = new SarvamTTS(sarvamKey);

    this.setupListeners();
  }

  private setupListeners() {
    // 1. When STT recognizes text
    this.stt.on('transcript', async (text: string) => {
      console.log(`[VoicePipeline] STT Transcript: ${text}`);
      this.emit('transcript_user', text);
      
      if (this.isProcessing) {
        console.log('[VoicePipeline] Already processing, queuing...');
        return;
      }
      this.isProcessing = true;

      // 2. Send text to LLM
      this.textBuffer = '';
      
      await this.llm.processUserUtterance(text, (chunk) => {
        this.textBuffer += chunk;
        this.emit('transcript_ai_chunk', chunk);
        
        // 3. Send to TTS when we have a complete sentence or phrase
        // Look for sentence endings or natural pauses
        const sentenceMatch = this.textBuffer.match(/^(.*?[.!?।]\s*)/);
        if (sentenceMatch) {
          const sentence = sentenceMatch[1].trim();
          if (sentence.length > 10) { // Minimum length to avoid tiny fragments
            this.tts.synthesizeAndStream(sentence);
            this.textBuffer = this.textBuffer.slice(sentenceMatch[0].length);
          }
        }
        
        // Also flush if buffer gets too long (avoid waiting forever)
        if (this.textBuffer.length > 150) {
          const textToSynthesize = this.textBuffer.trim();
          if (textToSynthesize) {
            this.tts.synthesizeAndStream(textToSynthesize);
            this.textBuffer = '';
          }
        }
      });
      
      // Flush any remaining text
      if (this.textBuffer.trim()) {
        this.tts.synthesizeAndStream(this.textBuffer.trim());
        this.textBuffer = '';
      }

      this.isProcessing = false;
    });

    // 4. When TTS generates audio
    this.tts.on('audio', (audioBuffer: Buffer) => {
      this.emit('audio_out', audioBuffer);
    });
  }

  start() {
    this.stt.start();
  }

  // Called when audio chunk received from Socket
  handleIncomingAudio(audioChunk: Buffer) {
    this.stt.processAudio(audioChunk);
  }

  stop() {
    this.stt.stop();
    this.isProcessing = false;
    this.textBuffer = '';
  }

  getConversationLogs() {
    return this.llm.getHistory();
  }
}
