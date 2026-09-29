import React, { useState, useEffect, useRef } from 'react';
import { Box, Button, Typography, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, List, ListItem, ListItemText, Paper, Chip, TextField, Divider } from '@mui/material';
import Mic from '@mui/icons-material/Mic';
import MicOff from '@mui/icons-material/MicOff';
import PlayArrow from '@mui/icons-material/PlayArrow';
import { io, Socket } from 'socket.io-client';
import { SOCKET_BASE_URL } from '../../lib/endpoints';

interface Message {
  role: 'user' | 'ai';
  text: string;
  partial?: boolean;
}

export const VoiceTestInterface: React.FC<{
  open: boolean;
  onClose: () => void;
  campaignId: string;
  scriptTemplate: string;
}> = ({ open, onClose, campaignId, scriptTemplate }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sarvamKey, setSarvamKey] = useState('');
  const [openRouterKey, setOpenRouterKey] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextAudioTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!open) {
      handleDisconnect();
      return;
    }

    // Initialize socket connection
    const newSocket = io(`${SOCKET_BASE_URL}/voice-test`, {
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('start_session', { 
        campaignId, 
        scriptTemplate,
        sarvamKey: sarvamKey || undefined,
        openRouterKey: openRouterKey || undefined
      });
    });

    newSocket.on('transcript_update', (data: Message) => {
      setMessages((prev: Message[]) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === data.role && lastMsg.partial) {
          // Update partial message
          const newArr = [...prev];
          newArr[newArr.length - 1] = { ...data, partial: data.partial };
          return newArr;
        } else {
          return [...prev, data];
        }
      });
    });

    newSocket.on('audio_chunk', async (arrayBuffer: ArrayBuffer) => {
      // Play received audio
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      
      try {
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0)); // copy buffer
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);

        const currentTime = ctx.currentTime;
        if (nextAudioTimeRef.current < currentTime) {
          nextAudioTimeRef.current = currentTime;
        }
        
        source.start(nextAudioTimeRef.current);
        nextAudioTimeRef.current += audioBuffer.duration;
      } catch (err) {
        console.error("Error decoding audio chunk", err);
      }
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [open]);

  const handleDisconnect = () => {
    if (socket) socket.disconnect();
    if (isRecording) stopRecording();
    if (audioContextRef.current) audioContextRef.current.close();
    setMessages([]);
    setIsConnected(false);
  };

  const startRecording = async () => {
    try {
      // Initialize or resume AudioContext on user interaction to prevent browser autoplay blocking
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } else if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && socket?.connected) {
          socket.emit('audio_chunk', event.data);
        }
      };

      mediaRecorder.start(250); // Send audio chunks every 250ms
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone', err);
      alert('Could not access microphone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    }
    setIsRecording(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Test AI Voice Conversation</DialogTitle>
      <DialogContent dividers>
        {!isRecording && messages.length === 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Optional: Enter API Keys to test the real integration. Otherwise, it uses mock responses.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                size="small"
                fullWidth
                label="Sarvam API Key"
                type="password"
                value={sarvamKey}
                onChange={e => setSarvamKey(e.target.value)}
              />
              <TextField
                size="small"
                fullWidth
                label="OpenRouter API Key"
                type="password"
                value={openRouterKey}
                onChange={e => setOpenRouterKey(e.target.value)}
              />
            </Box>
            <Divider sx={{ my: 2 }} />
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1">
            Status: {isConnected ? <Chip size="small" color="success" label="Connected" /> : <Chip size="small" color="error" label="Disconnected" />}
          </Typography>
        </Box>

        <Paper variant="outlined" sx={{ height: 300, overflowY: 'auto', p: 2, mb: 2 }}>
          {messages.length === 0 ? (
            <Typography color="textSecondary" align="center" sx={{ mt: 4 }}>
              Start speaking to see the transcript here...
            </Typography>
          ) : (
            <List>
              {messages.map((msg: Message, idx: number) => (
                <ListItem key={idx} sx={{ justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <Paper sx={{ p: 1.5, bgcolor: msg.role === 'user' ? '#e3f2fd' : '#ffffff', maxWidth: '80%' }}>
                    <ListItemText 
                      primary={
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 0.5 }}>
                          {msg.role === 'user' ? 'You' : 'AI'} {msg.partial && '(typing...)'}
                        </Typography>
                      }
                      secondary={<Typography variant="body1">{msg.text}</Typography>}
                    />
                  </Paper>
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          {!isRecording ? (
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<Mic />}
              onClick={startRecording}
              disabled={!isConnected}
              sx={{ borderRadius: 28, px: 4 }}
            >
              Hold to Speak / Start Mic
            </Button>
          ) : (
            <Button
              variant="contained"
              color="error"
              size="large"
              startIcon={<MicOff />}
              onClick={stopRecording}
              sx={{ borderRadius: 28, px: 4 }}
            >
              Stop Listening
            </Button>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>End Test</Button>
      </DialogActions>
    </Dialog>
  );
};

export default VoiceTestInterface;
