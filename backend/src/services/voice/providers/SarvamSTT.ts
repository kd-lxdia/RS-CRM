import { EventEmitter } from 'events';
import WebSocket from 'ws';
import axios from 'axios';

export class SarvamSTT extends EventEmitter {
  private apiKey: string;
  private isMock: boolean;
  private socket: WebSocket | null = null;
  private mockInterval: NodeJS.Timeout | null = null;
  private audioBufferLength: number = 0;
  private audioBuffer: Buffer[] = [];
  private isProcessing: boolean = false;

  constructor(customApiKey?: string) {
    super();
    this.apiKey = customApiKey || process.env.SARVAM_API_KEY || '';
    this.isMock = !this.apiKey || this.apiKey === 'your_sarvam_api_key_here';
  }

  start() {
    if (this.isMock) {
      console.log('[SarvamSTT Mock] Started listening...');
      this.emit('ready');
    } else {
      console.log('[SarvamSTT] Using REST API for speech-to-text (streaming via buffer)');
      this.emit('ready');
    }
  }

  // Receive audio chunk from browser (WebM format)
  async processAudio(audioChunk: Buffer) {
    this.audioBufferLength += audioChunk.length;
    this.audioBuffer.push(audioChunk);
    
    if (this.isMock) {
      // Simulate transcribing when enough audio is received
      if (this.audioBufferLength > 10000) {
        this.audioBufferLength = 0;
        this.audioBuffer = [];
        
        // Mock a detected speech event
        if (!this.mockInterval) {
          this.mockInterval = setTimeout(() => {
            const mockPhrases = [
              'Hello, I am interested in solar panels. What is the cost?',
              'I want to know about solar installation.',
              'My electricity bill is around 5000 rupees per month.',
              'Yes, I own this property.',
              'I would like to install solar panels within 3 months.'
            ];
            const randomPhrase = mockPhrases[Math.floor(Math.random() * mockPhrases.length)];
            this.emit('transcript', randomPhrase);
            this.mockInterval = null;
          }, 1500);
        }
      }
    } else {
      // Use Sarvam REST API for speech-to-text
      // Process when we have enough audio (2 seconds worth at typical bitrate)
      if (this.audioBufferLength > 32000 && !this.isProcessing) {
        this.isProcessing = true;
        const combinedBuffer = Buffer.concat(this.audioBuffer);
        this.audioBuffer = [];
        this.audioBufferLength = 0;

        try {
          await this.transcribeBuffer(combinedBuffer);
        } catch (error) {
          console.error('[SarvamSTT] Transcription error:', error);
        } finally {
          this.isProcessing = false;
        }
      }
    }
  }

  private async transcribeBuffer(audioBuffer: Buffer) {
    try {
      const FormData = require('form-data');
      const form = new FormData();
      
      // Convert WebM to a format Sarvam accepts (or send as-is and let Sarvam handle it)
      form.append('file', audioBuffer, {
        filename: 'audio.webm',
        contentType: 'audio/webm',
      });
      form.append('language_code', 'hi-IN'); // Hindi-English mix
      form.append('model', 'saaras:v3'); // Updated to v3

      const response = await axios.post(
        'https://api.sarvam.ai/speech-to-text',
        form,
        {
          headers: {
            ...form.getHeaders(),
            'api-subscription-key': this.apiKey,
          },
          timeout: 10000,
        }
      );

      if (response.data && response.data.transcript) {
        const transcript = response.data.transcript.trim();
        if (transcript) {
          console.log('[SarvamSTT] Transcribed:', transcript);
          this.emit('transcript', transcript);
        }
      }
    } catch (error: any) {
      console.error('[SarvamSTT] API Error:', error.response?.data || error.message);
      // Don't emit error, just log it - user might still be speaking
    }
  }

  stop() {
    if (this.mockInterval) clearTimeout(this.mockInterval);
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.audioBuffer = [];
    this.audioBufferLength = 0;
    this.isProcessing = false;
    console.log('[SarvamSTT] Stopped listening');
  }
}
