import { Server as SocketIOServer } from 'socket.io';
import { VoicePipeline } from '../services/voice/VoicePipeline';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const activePipelines = new Map<string, VoicePipeline>();

export const initVoiceSocket = (io: SocketIOServer) => {
  const voiceNamespace = io.of('/voice-test');

  voiceNamespace.on('connection', (socket) => {
    console.log(`[Voice Socket] Client connected: ${socket.id}`);
    
    // We expect the client to join a specific call/campaign session
    socket.on('start_session', async (data: { 
      callId?: string, 
      campaignId: string, 
      scriptTemplate: string, 
      sarvamKey?: string, 
      openRouterKey?: string 
    }) => {
      console.log(`[Voice Socket] Session started for ${socket.id}`, { 
        callId: data.callId, 
        campaignId: data.campaignId 
      });
      
      // Use provided keys or fall back to environment variables
      const sarvamKey = data.sarvamKey || process.env.SARVAM_API_KEY;
      const openRouterKey = data.openRouterKey || process.env.OPENROUTER_API_KEY;
      
      const pipeline = new VoicePipeline(
        socket.id, 
        data.scriptTemplate, 
        sarvamKey, 
        openRouterKey
      );
      activePipelines.set(socket.id, pipeline);
      
      pipeline.on('transcript_user', (text) => {
        socket.emit('transcript_update', { role: 'user', text });
      });

      pipeline.on('transcript_ai_chunk', (text) => {
        socket.emit('transcript_update', { role: 'ai', text, partial: true });
      });

      pipeline.on('audio_out', (audioBuffer) => {
        socket.emit('audio_chunk', audioBuffer);
      });

      pipeline.start();
      
      // Keep track of the DB entity if it's a real call
      socket.data.callId = data.callId;
      socket.data.campaignId = data.campaignId;
      socket.data.startTime = new Date();
      
      // Send ready confirmation
      socket.emit('session_ready', { 
        message: 'Voice pipeline initialized',
        usingRealAPI: !!(sarvamKey && openRouterKey)
      });
    });

    socket.on('audio_chunk', (audioData: Buffer) => {
      const pipeline = activePipelines.get(socket.id);
      if (pipeline) {
        pipeline.handleIncomingAudio(audioData);
      }
    });

    socket.on('disconnect', async () => {
      console.log(`[Voice Socket] Client disconnected: ${socket.id}`);
      const pipeline = activePipelines.get(socket.id);
      if (pipeline) {
        pipeline.stop();
        
        // Save logs if we have a callId
        const logs = pipeline.getConversationLogs();
        if (socket.data.callId) {
          const endTime = new Date();
          const duration = Math.round((endTime.getTime() - socket.data.startTime.getTime()) / 1000);
          
          try {
            // Calculate basic qualification score from conversation
            const userMessages = logs.filter(m => m.role === 'user').length;
            const conversationLength = logs.length;
            const qualificationScore = Math.min(100, (userMessages * 15) + (conversationLength * 5));
            
            await prisma.aIVoiceCall.update({
              where: { id: socket.data.callId },
              data: {
                conversationLogs: logs as any,
                callDuration: duration,
                completedAt: endTime,
                status: 'COMPLETED',
                interestLevel: qualificationScore > 60 ? 'HIGH' : qualificationScore > 30 ? 'MEDIUM' : 'LOW',
                qualificationScore: qualificationScore,
              }
            });
            console.log(`[Voice Socket] Saved call logs for ${socket.data.callId} (Score: ${qualificationScore})`);
          } catch (error) {
            console.error('Failed to save call log:', error);
          }
        }
        
        activePipelines.delete(socket.id);
      }
    });
  });
};
