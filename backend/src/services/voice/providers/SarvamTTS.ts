import { EventEmitter } from 'events';
import axios from 'axios';

export class SarvamTTS extends EventEmitter {
  private isMock: boolean;
  private apiKey: string;

  constructor(customApiKey?: string) {
    super();
    this.apiKey = customApiKey || process.env.SARVAM_API_KEY || '';
    this.isMock = !this.apiKey || this.apiKey === 'your_sarvam_api_key_here';
  }

  // Receive text from LLM to synthesize
  async synthesizeAndStream(textChunk: string) {
    if (!textChunk.trim()) return;

    if (this.isMock) {
      console.log(`[SarvamTTS Mock] Synthesizing: "${textChunk}"`);
      // Simulate API latency
      await new Promise(resolve => setTimeout(resolve, 300));
      // Emit a dummy buffer (in a real scenario, this would be PCM or WAV data)
      this.emit('audio', Buffer.from('mock-audio-data:' + textChunk));
    } else {
      console.log(`[SarvamTTS] Synthesizing: "${textChunk}"`);
      try {
        const response = await axios.post('https://api.sarvam.ai/text-to-speech', {
          inputs: [textChunk],
          target_language_code: 'hi-IN',
          speaker: 'priya', // Female voice compatible with v3
          pace: 1.0,
          speech_sample_rate: 16000,
          enable_preprocessing: true,
          model: 'bulbul:v3' // V3 doesn't support pitch and loudness
        }, {
          headers: {
            'api-subscription-key': this.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 15000,
        });
        
        const data = response.data;
        if (data.audios && data.audios.length > 0) {
          // Sarvam returns base64-encoded audio
          const audioBase64 = data.audios[0];
          const audioBuffer = Buffer.from(audioBase64, 'base64');
          
          // Convert to WAV format for browser playback
          const wavBuffer = this.addWavHeader(audioBuffer, 16000);
          this.emit('audio', wavBuffer);
        } else {
          console.error('[SarvamTTS] No audio returned:', data);
        }
      } catch (error: any) {
        console.error('[SarvamTTS] API Error:', error.response?.data || error.message || error);
      }
    }
  }

  // Add WAV header to raw PCM data
  private addWavHeader(pcmBuffer: Buffer, sampleRate: number): Buffer {
    const numChannels = 1; // Mono
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmBuffer.length;
    
    const header = Buffer.alloc(44);
    
    // RIFF chunk descriptor
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    
    // fmt sub-chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    header.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    
    // data sub-chunk
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);
    
    return Buffer.concat([header, pcmBuffer]);
  }
}
