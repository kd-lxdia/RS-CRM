import { useState, useRef, useEffect } from 'react';
import { 
  Button, Input, Select, Avatar, Spin, message, Tooltip, Badge 
} from 'antd';
import { 
  MessageCircleIcon, X, Mic, MicOff, Volume2, VolumeX,
  Send, Phone, Loader2 
} from 'lucide-react';
import { api } from '../../lib/api';

const { Option } = Select;
const { TextArea } = Input;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  audioUrl?: string;
  timestamp: Date;
}

interface ProposalChatbotProps {
  proposalId: string;
  token: string;
  salespersonName?: string;
  salespersonPhone?: string;
}

export default function ProposalChatbot({ 
  proposalId, 
  token,
  salespersonName,
  salespersonPhone 
}: ProposalChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [language, setLanguage] = useState<'en' | 'hi' | 'ta' | 'te' | 'mr' | 'bn'>('en');
  const [unreadCount, setUnreadCount] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: '0',
        role: 'assistant',
        content: getWelcomeMessage(language),
        timestamp: new Date(),
      }]);
    }
  }, [language]);

  // Update unread count when closed
  useEffect(() => {
    if (!isOpen && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        setUnreadCount(prev => prev + 1);
      }
    } else if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen, messages]);

  const getWelcomeMessage = (lang: string) => {
    const messages = {
      en: "👋 Hi! I'm your Solar Proposal Assistant. Ask me anything about your solar system, costs, savings, or how solar works!",
      hi: "👋 नमस्ते! मैं आपका सोलर प्रस्ताव सहायक हूं। अपने सोलर सिस्टम, लागत, बचत या सोलर कैसे काम करता है, के बारे में कुछ भी पूछें!",
      ta: "👋 வணக்கம்! நான் உங்கள் சூரிய ஒளி திட்ட உதவியாளர். உங்கள் சூரிய அமைப்பு, செலவுகள், சேமிப்பு அல்லது சூரிய ஒளி எவ்வாறு செயல்படுகிறது என்பது பற்றி எதையும் கேளுங்கள்!",
      te: "👋 నమస్కారం! నేను మీ సౌర ప్రతిపాదన సహాయకుడిని. మీ సౌర వ్యవస్థ, ఖర్చులు, పొదుపులు లేదా సౌర శక్తి ఎలా పనిచేస్తుందనే దాని గురించి ఏదైనా అడగండి!",
      mr: "👋 नमस्कार! मी तुमचा सोलर प्रपोजल असिस्टंट आहे. तुमच्या सोलर सिस्टम, खर्च, बचत किंवा सोलर कसे काम करते याबद्दल काहीही विचारा!",
      bn: "👋 হ্যালো! আমি আপনার সৌর প্রস্তাব সহায়ক। আপনার সৌর সিস্টেম, খরচ, সঞ্চয় বা সৌর কীভাবে কাজ করে সে সম্পর্কে যেকোনো কিছু জিজ্ঞাসা করুন!",
    };
    return (messages as any)[lang] || messages.en;
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await api.post('/proposals/chatbot/message', {
        proposalId,
        token,
        message: text,
        language,
        conversationHistory: messages.slice(-5), // Last 5 messages for context
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.text,
        audioUrl: response.data.audioUrl,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Auto-play voice response if available
      if (response.data.audioUrl) {
        playAudio(response.data.audioUrl);
      }

      // Show call salesperson suggestion if out of scope
      if (response.data.suggestCallSalesperson) {
        message.info({
          content: (
            <div>
              <p>For this query, please contact your salesperson:</p>
              <Button 
                type="link" 
                icon={<Phone size={16} />}
                onClick={() => window.open(`tel:${salespersonPhone}`)}
              >
                Call {salespersonName}
              </Button>
            </div>
          ),
          duration: 8,
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      message.error('Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const startVoiceInput = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAndSend(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      message.info('Recording... Click again to stop');
    } catch (error) {
      console.error('Microphone error:', error);
      message.error('Could not access microphone');
    }
  };

  const stopVoiceInput = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAndSend = async (audioBlob: Blob) => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);
      formData.append('language', language);
      formData.append('token', token);

      const response = await api.post('/proposals/chatbot/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const transcribedText = response.data.text;
      if (transcribedText) {
        sendMessage(transcribedText);
      }
    } catch (error) {
      console.error('Transcription error:', error);
      message.error('Failed to transcribe audio');
      setIsLoading(false);
    }
  };

  const playAudio = (audioUrl: string) => {
    if (audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.play();
      setIsPlaying(audioUrl);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(null);
    }
  };

  const toggleVoiceInput = () => {
    if (isRecording) {
      stopVoiceInput();
    } else {
      startVoiceInput();
    }
  };

  return (
    <>
      {/* Hidden audio element */}
      <audio 
        ref={audioRef} 
        onEnded={() => setIsPlaying(null)}
        onError={() => setIsPlaying(null)}
      />

      {/* Floating button */}
      <Badge count={unreadCount} offset={[-5, 5]}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 z-50"
        >
          {isOpen ? (
            <X size={28} />
          ) : (
            <MessageCircleIcon size={28} />
          )}
        </button>
      </Badge>

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[400px] h-[600px] bg-apple-cardLight dark:bg-apple-cardDark rounded-2xl shadow-2xl flex flex-col z-50 border border-gray-200">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-2xl">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-3">
                <Avatar className="bg-blue-400">AI</Avatar>
                <div>
                  <h3 className="font-semibold text-base">Solar Assistant</h3>
                  <p className="text-xs text-blue-100">Always here to help</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-apple-cardLight dark:bg-apple-cardDark/20 rounded-full p-1 transition"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Language selector */}
            <Select 
              value={language} 
              onChange={setLanguage} 
              size="small"
              className="w-full"
              dropdownStyle={{ zIndex: 9999 }}
            >
              <Option value="en">🇬🇧 English</Option>
              <Option value="hi">🇮🇳 हिंदी</Option>
              <Option value="ta">🇮🇳 தமிழ்</Option>
              <Option value="te">🇮🇳 తెలుగు</Option>
              <Option value="mr">🇮🇳 मराठी</Option>
              <Option value="bn">🇮🇳 বাংলা</Option>
            </Select>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-apple-cardLight dark:bg-apple-cardDark text-gray-800 rounded-bl-none shadow-sm border border-gray-200'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  
                  {/* Voice playback button for assistant messages */}
                  {msg.role === 'assistant' && msg.audioUrl && (
                    <button
                      onClick={() => isPlaying === msg.audioUrl ? stopAudio() : playAudio(msg.audioUrl!)}
                      className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                    >
                      {isPlaying === msg.audioUrl ? (
                        <>
                          <VolumeX size={14} />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Volume2 size={14} />
                          <span>Play voice</span>
                        </>
                      )}
                    </button>
                  )}
                  
                  <p className="text-xs mt-1 opacity-60">
                    {msg.timestamp.toLocaleTimeString('en-IN', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-apple-cardLight dark:bg-apple-cardDark rounded-2xl px-4 py-3 shadow-sm border border-gray-200">
                  <Loader2 className="animate-spin text-blue-600" size={20} />
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="p-4 border-t bg-apple-cardLight dark:bg-apple-cardDark rounded-b-2xl">
            <div className="flex gap-2">
              <TextArea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    sendMessage(inputText);
                  }
                }}
                placeholder="Type your question..."
                autoSize={{ minRows: 1, maxRows: 3 }}
                disabled={isLoading || isRecording}
                className="flex-1"
              />
              
              <div className="flex flex-col gap-2">
                <Tooltip title={isRecording ? "Stop recording" : "Voice input"}>
                  <Button
                    icon={isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                    onClick={toggleVoiceInput}
                    type={isRecording ? 'primary' : 'default'}
                    danger={isRecording}
                    disabled={isLoading}
                    className={isRecording ? 'animate-pulse' : ''}
                  />
                </Tooltip>
                
                <Tooltip title="Send message">
                  <Button
                    icon={<Send size={18} />}
                    onClick={() => sendMessage(inputText)}
                    type="primary"
                    disabled={!inputText.trim() || isLoading || isRecording}
                  />
                </Tooltip>
              </div>
            </div>
            
            <p className="text-xs text-gray-400 mt-2 text-center">
              Powered by AI • Press Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </>
  );
}
