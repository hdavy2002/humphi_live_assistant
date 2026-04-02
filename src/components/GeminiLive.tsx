import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Monitor, MonitorOff, Settings, ScrollText, 
  Send, X, Play, Volume2, AlertCircle, CheckCircle2,
  MessageSquare, Terminal, ChevronDown, ChevronUp, Play as PlayIcon,
  Video, VideoOff, Menu, User, Wallet as WalletIcon, LogOut, History
} from 'lucide-react';
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { cn } from '../lib/utils';
import { AudioRecorder, AudioPlayer } from '../lib/audio-utils';
import { Message, LogEntry, AudioDevice, Profile } from '../types';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';

const MODEL_NAME = "gemini-3.1-flash-live-preview";

const VOICE_GENDERS: Record<string, string> = {
  "Zephyr": "masculine",
  "Puck": "feminine",
  "Charon": "masculine",
  "Kore": "feminine",
  "Fenrir": "masculine"
};

const LogItem: React.FC<{ log: LogEntry }> = ({ log }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasDetails = !!log.details;

  return (
    <div className="border-b border-white/5 last:border-0 py-1">
      <div 
        className={cn(
          "flex items-start gap-2 group cursor-pointer hover:bg-white/5 p-1 rounded transition-colors",
          !isExpanded && "text-white/40"
        )}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
      >
        <span className="text-[9px] text-white/20 shrink-0 mt-0.5">
          {log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              "px-1 rounded text-[8px] font-bold uppercase tracking-widest",
              log.type === 'info' ? "bg-blue-500/10 text-blue-400" :
              log.type === 'error' ? "bg-red-500/10 text-red-400" :
              "bg-green-500/10 text-green-400"
            )}>
              {log.type}
            </span>
            <span className="truncate">{log.message}</span>
            {hasDetails && (
              <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              </span>
            )}
          </div>
          {isExpanded && log.details && (
            <pre className="mt-1 p-2 bg-black/40 rounded text-[9px] overflow-x-auto text-white/60 leading-relaxed border border-white/5">
              {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GeminiLive() {
  const { user } = useUser();
  const { signOut, getToken } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      if (!user?.id) return;
      const token = await getToken();
      const res = await fetch(`/api/wallet/profile?userId=${user.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      // The new API endpoint returns the profile object directly 
      // (no nested 'profile' wrapper, and balance is directly under walletBalance)
      if (data && data.id) {
          setProfile({
              ...data,
              wallet_balance: data.walletBalance || 0
          });
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    }
  };

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [inputText, setInputText] = useState("");
  const [activeTab, setActiveTab] = useState<'chat' | 'logs' | 'settings'>('chat');
  
  // Settings
  const [selectedMic, setSelectedMic] = useState<string>("default");
  const [selectedVoice, setSelectedVoice] = useState<string>("Zephyr");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("English");
  const [selectedAccent, setSelectedAccent] = useState<string>("Neutral");
  const [systemPrompt] = useState<string>(
    "You are a helpful assistant and you also also a tecch expert helping users navigate all windows issues, so guide them if they need any tech help. You are also an IT system administrator have full knwledge on how to fix network, routers, etc. Apart from that you are gentle, warm and loving person."
  );
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [screenQuality, setScreenQuality] = useState(0.6);
  const [screenMaxDimension, setScreenMaxDimension] = useState(720);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [tokenUsage, setTokenUsage] = useState({ input: 0, output: 0, total: 0 });

  const connectedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<any>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const screenIntervalRef = useRef<number | null>(null);
  const micTestIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    getDevices();
    return () => {
      stopSession();
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Real-time balance polling every 15 seconds while connected
  useEffect(() => {
    let interval: any;
    if (isConnected) {
      interval = setInterval(fetchProfile, 15000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected]);

  const getDevices = async () => {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const audioIn = devs
        .filter(d => d.kind === 'audioinput')
        .map(d => ({ deviceId: d.deviceId, label: d.label || `Mic ${d.deviceId.slice(0, 5)}` }));
      setDevices(audioIn);
    } catch (err) {
      addLog('error', 'Failed to enumerate devices', err);
    }
  };

  const addLog = (type: LogEntry['type'], message: string, details?: any) => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).slice(2),
      timestamp: new Date(),
      type,
      message,
      details
    }]);
  };

  const startSession = async () => {
    if (isConnecting || isConnected) return;

    if (!profile || (profile.wallet_balance || 0) <= 0) {
      addLog('error', 'Insufficient wallet balance. Please top up your wallet.');
      navigate('/wallet');
      return;
    }

    setIsConnecting(true);
    setMessages([]); // Clear previous messages
    setTokenUsage({ input: 0, output: 0, total: 0 });
    addLog('info', 'Starting Gemini Live session...');
    
    try {
      // We need the API key from the environment.
      // In this app, vite.config.ts exposes it via process.env.GEMINI_API_KEY
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("VITE_GEMINI_API_KEY not found in environment");

      const ai = new GoogleGenAI({ apiKey });
      
      audioPlayerRef.current = new AudioPlayer();

      const session = await ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: selectedVoice as any
              }
            }
          },
          systemInstruction: `${systemPrompt} 
          IMPORTANT: You are a ${VOICE_GENDERS[selectedVoice] || 'neutral'} persona. 
          In languages like Hindi, you MUST use the ${VOICE_GENDERS[selectedVoice] || 'neutral'} gender for yourself (e.g., use feminine verb endings if you are feminine).
          You MUST speak to me in ${selectedLanguage} with a ${selectedAccent} accent.`
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            connectedRef.current = true;
            setIsConnecting(false);
            addLog('info', 'Connected to Gemini Live');
            
            setIsMicOn(true);
            startAudioCapture();
          },
          onmessage: (message: LiveServerMessage) => {
            handleServerMessage(message);
          },
          onclose: () => {
            connectedRef.current = false;
            stopSession();
            addLog('info', 'Session closed');
          },
          onerror: (err) => {
            addLog('error', 'Session error', err);
            stopSession();
          }
        }
      });

      sessionRef.current = session;
    } catch (err) {
      addLog('error', 'Failed to connect', err);
      setIsConnecting(false);
      stopSession();
    }
  };

  const saveSessionAndBill = async () => {
      try {
          const token = await getToken();
          const transcript = messages.map(m => `[${m.role}] ${m.text}`).join('\n');
          
          addLog('info', 'Saving session and processing billing...', { tokens: tokenUsage });
          
          const res = await fetch('/api/session/save', {
              method: 'POST',
              headers: { 
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                  transcript,
                  tokens: tokenUsage
              })
          });
          
          if (res.ok) {
              addLog('info', 'Session successfully saved to memory and billed.');
              fetchProfile(); // Refresh balance one last time
          }
      } catch (err) {
          addLog('error', 'Failed to save session/process billing', err);
      }
  };

  const stopSession = () => {
    if (!connectedRef.current && !isConnecting) return;
    
    setIsConnected(false);
    connectedRef.current = false;
    setIsConnecting(false);
    setIsMicOn(false);
    setIsScreenSharing(false);
    setIsCameraOn(false);
    
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    
    stopAudioCapture();
    stopScreenCapture();
    stopCameraCapture();
    
    if (audioPlayerRef.current) {
      audioPlayerRef.current.stop();
      audioPlayerRef.current = null;
    }

    // Trigger save and billing at the end
    if (messages.length > 0) {
        saveSessionAndBill();
    }

    addLog('info', 'Session ended');
  };

  const handleServerMessage = async (message: LiveServerMessage) => {
    if (message.serverContent?.modelTurn?.parts) {
      const textParts = message.serverContent.modelTurn.parts
        .filter(p => p.text)
        .map(p => p.text)
        .join(" ");
      
      if (textParts) {
        setMessages(prev => [...prev, {
          id: Math.random().toString(36).slice(2),
          role: 'model',
          text: textParts,
          timestamp: new Date()
        }]);
      }

      const audioParts = message.serverContent.modelTurn.parts
        .filter(p => p.inlineData?.data && p.inlineData.mimeType.includes('audio'));
      
      for (const p of audioParts) {
        if (p.inlineData && audioPlayerRef.current) {
          await audioPlayerRef.current.playChunk(p.inlineData.data);
        }
      }
    }

    if (message.serverContent?.interrupted) {
      addLog('info', 'Model interrupted');
      audioPlayerRef.current?.stop();
    }

    if (message.usageMetadata) {
      setTokenUsage(prev => ({
        input: message.usageMetadata?.promptTokenCount || prev.input,
        output: (message.usageMetadata as any).candidatesTokenCount || (message.usageMetadata as any).responseTokenCount || prev.output,
        total: message.usageMetadata?.totalTokenCount || prev.total
      }));
    }
  };

  const startAudioCapture = async () => {
    try {
      audioRecorderRef.current = new AudioRecorder((base64Data) => {
        if (sessionRef.current && connectedRef.current) {
          sessionRef.current.sendRealtimeInput({
            audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
          });
        }
      }, (volume) => {
        setMicVolume(volume);
      });
      await audioRecorderRef.current.start(selectedMic);
      addLog('info', 'Microphone capture started');
    } catch (err) {
      addLog('error', 'Failed to start audio capture', err);
      setIsMicOn(false);
    }
  };

  const stopAudioCapture = () => {
    if (audioRecorderRef.current) {
      audioRecorderRef.current.stop();
      audioRecorderRef.current = null;
    }
    setMicVolume(0);
    addLog('info', 'Microphone capture stopped');
  };

  const toggleMic = () => {
    const newState = !isMicOn;
    setIsMicOn(newState);
    if (newState) {
      if (isConnected) startAudioCapture();
    } else {
      stopAudioCapture();
    }
  };

  const startScreenCapture = async () => {
    try {
      if (isCameraOn) stopCameraCapture();

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 5 }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => addLog('error', 'Video play failed', e));
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      screenIntervalRef.current = window.setInterval(() => {
        if (videoRef.current && ctx && sessionRef.current && connectedRef.current) {
          const video = videoRef.current;
          if (video.readyState < 2) return;

          const ratio = Math.min(screenMaxDimension / video.videoWidth, screenMaxDimension / video.videoHeight, 1);
          canvas.width = video.videoWidth * ratio;
          canvas.height = video.videoHeight * ratio;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          const base64Data = canvas.toDataURL('image/jpeg', screenQuality).split(',')[1];
          sessionRef.current.sendRealtimeInput({
            video: { data: base64Data, mimeType: 'image/jpeg' }
          });
          addLog('info', `Screen frame sent: ${Math.round(base64Data.length / 1024)} KB`);
        }
      }, 2000);

      stream.getVideoTracks()[0].onended = () => stopScreenCapture();
      addLog('info', 'Screen capture started');
    } catch (err) {
      addLog('error', 'Failed to start screen capture', err);
      setIsScreenSharing(false);
    }
  };

  const stopScreenCapture = () => {
    if (screenIntervalRef.current) {
      clearInterval(screenIntervalRef.current);
      screenIntervalRef.current = null;
    }
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsScreenSharing(false);
    addLog('info', 'Screen capture stopped');
  };

  const toggleScreenShare = () => {
    const newState = !isScreenSharing;
    setIsScreenSharing(newState);
    if (newState) {
      startScreenCapture();
    } else {
      stopScreenCapture();
    }
  };

  const startCameraCapture = async () => {
    try {
      if (isScreenSharing) stopScreenCapture();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: screenMaxDimension }, height: { ideal: screenMaxDimension }, frameRate: 5 }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => addLog('error', 'Video play failed', e));
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      screenIntervalRef.current = window.setInterval(() => {
        if (videoRef.current && ctx && sessionRef.current && connectedRef.current) {
          const video = videoRef.current;
          if (video.readyState < 2) return;

          const ratio = Math.min(screenMaxDimension / video.videoWidth, screenMaxDimension / video.videoHeight, 1);
          canvas.width = video.videoWidth * ratio;
          canvas.height = video.videoHeight * ratio;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          const base64Data = canvas.toDataURL('image/jpeg', screenQuality).split(',')[1];
          sessionRef.current.sendRealtimeInput({
            video: { data: base64Data, mimeType: 'image/jpeg' }
          });
          addLog('info', `Camera frame sent: ${Math.round(base64Data.length / 1024)} KB`);
        }
      }, 2000);

      stream.getVideoTracks()[0].onended = () => stopCameraCapture();
      addLog('info', 'Camera capture started');
    } catch (err) {
      addLog('error', 'Failed to start camera capture', err);
      setIsCameraOn(false);
    }
  };

  const stopCameraCapture = () => {
    if (screenIntervalRef.current) {
      clearInterval(screenIntervalRef.current);
      screenIntervalRef.current = null;
    }
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
    addLog('info', 'Camera capture stopped');
  };

  const toggleCamera = () => {
    const newState = !isCameraOn;
    setIsCameraOn(newState);
    if (newState) {
      startCameraCapture();
    } else {
      stopCameraCapture();
    }
  };

  const handleSendMessage = () => {
    if (!inputText.trim() || !sessionRef.current) return;
    
    const text = inputText.trim();
    setMessages(prev => [...prev, {
      id: Math.random().toString(36).slice(2),
      role: 'user',
      text,
      timestamp: new Date()
    }]);
    
    sessionRef.current.sendRealtimeInput({ text });
    setInputText("");
    addLog('info', 'Text message sent');
  };

  const toggleMicTest = async () => {
    if (isTestingMic) {
      if (micTestIntervalRef.current) clearInterval(micTestIntervalRef.current);
      setIsTestingMic(false);
      setMicVolume(0);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: selectedMic } });
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      setIsTestingMic(true);
      
      micTestIntervalRef.current = window.setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setMicVolume(average / 128);
      }, 50);
    } catch (err) {
      addLog('error', 'Mic test failed', err);
    }
  };

  const testSpeakers = async () => {
    try {
      addLog('info', 'Testing speakers...');
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 1);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 1);
      
      setTimeout(() => {
        audioContext.close();
      }, 1500);

      addLog('info', 'Speaker test sound played successfully');
    } catch (err) {
      addLog('error', 'Speaker test failed', err);
    }
  };

  const copyLogs = () => {
    const text = logs.map(l => `[${l.timestamp.toLocaleTimeString()}] ${l.type.toUpperCase()}: ${l.message}${l.details ? '\n' + JSON.stringify(l.details, null, 2) : ''}`).join('\n\n');
    navigator.clipboard.writeText(text);
    addLog('info', 'Logs copied to clipboard');
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-white overflow-hidden w-full mx-auto shadow-2xl relative">
      {/* Hamburger Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              className="absolute top-0 left-0 bottom-0 w-64 bg-[#0d0d0d] border-r border-white/10 z-[70] p-6 flex flex-col lg:hidden"
            >
              <div className="flex items-center gap-3 mb-10">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                  <PlayIcon size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-tight">Gemini Live</h2>
                  <p className="text-[8px] text-white/40 uppercase font-bold tracking-widest">Premium Assistant</p>
                </div>
              </div>

              <div className="flex-1 space-y-2">
                <button 
                  onClick={() => { navigate('/profile'); setIsMenuOpen(false); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-white/60 hover:text-white group text-left"
                >
                  <User size={18} className="group-hover:text-blue-400 transition-colors" />
                  <span className="text-xs font-bold uppercase tracking-wider">Profile</span>
                </button>
                <button 
                  onClick={() => { navigate('/wallet'); setIsMenuOpen(false); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-white/60 hover:text-white group text-left"
                >
                  <WalletIcon size={18} className="group-hover:text-green-400 transition-colors" />
                  <span className="text-xs font-bold uppercase tracking-wider">Wallet</span>
                </button>
                <button 
                  onClick={() => { navigate('/records'); setIsMenuOpen(false); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-white/60 hover:text-white group text-left"
                >
                  <History size={18} className="group-hover:text-purple-400 transition-colors" />
                  <span className="text-xs font-bold uppercase tracking-wider">Records</span>
                </button>
              </div>

              <button 
                onClick={() => { signOut(); setIsMenuOpen(false); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 transition-colors text-red-500/60 hover:text-red-500 group mt-auto text-left"
              >
                <LogOut size={18} />
                <span className="text-xs font-bold uppercase tracking-wider">Log Out</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Unified Control Bar */}
      <header className="shrink-0 p-3 border-b border-white/5 bg-[#0d0d0d] flex items-center justify-between gap-4 z-20">
        {/* Left: Connection & Start Button */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/5 min-w-[90px]">
            <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-green-500 animate-pulse" : "bg-white/20")} />
            <span className="text-[9px] font-black uppercase tracking-widest text-white/60 leading-none">
              {isConnected ? "Live" : "Offline"}
            </span>
          </div>

          <button 
            onClick={isConnected ? stopSession : startSession}
            disabled={isConnecting}
            className={cn(
              "h-9 px-6 rounded-full font-bold text-[10px] uppercase tracking-[0.15em] transition-all flex items-center justify-center",
              isConnected 
                ? "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white" 
                : "bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 active:scale-95"
            )}
            style={{ fontFamily: "'Comfortaa', sans-serif" }}
          >
            {isConnecting ? "..." : isConnected ? "End Session" : "Start Session"}
          </button>
        </div>

        {/* Center: Usage Metrics */}
        <div className="hidden md:flex items-center gap-8 px-6 py-1.5 rounded-full bg-white/[0.03] border border-white/5">
          <div className="flex flex-col items-center">
            <span className="text-[7px] text-white/30 uppercase font-black tracking-widest mb-0.5">Tokens</span>
            <span className="text-[11px] font-mono font-bold text-blue-400 leading-none">{tokenUsage.total.toLocaleString()}</span>
          </div>
          <div className="w-px h-5 bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="text-[7px] text-white/30 uppercase font-black tracking-widest mb-0.5">Cost</span>
            <span className="text-[11px] font-mono font-bold text-green-400 leading-none">
              ${((tokenUsage.input * 0.000001) + (tokenUsage.output * 0.000004)).toFixed(5)}
            </span>
          </div>
          <div className="w-px h-5 bg-white/10" />
          <button 
            onClick={() => navigate('/wallet')}
            className="flex flex-col items-center group transition-colors"
          >
            <span className="text-[7px] text-white/30 uppercase font-black tracking-widest mb-0.5 transition-colors group-hover:text-orange-400">Wallet</span>
            <span className="text-[11px] font-mono font-bold text-orange-400 leading-none group-active:scale-95 transition-transform">
              ${profile?.wallet_balance?.toFixed(2) || '0.00'}
            </span>
          </button>
        </div>

        {/* Right: Media Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-end gap-1 h-6 px-3 mr-2 border-r border-white/10">
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                animate={{ 
                  height: isMicOn && isConnected ? Math.max(3, micVolume * (15 + Math.random() * 15)) : 3,
                  opacity: isMicOn && isConnected ? 1 : 0.2
                }}
                className={cn(
                  "w-0.5 rounded-full bg-blue-500",
                  (!isMicOn || !isConnected) && "bg-white/20"
                )}
              />
            ))}
          </div>

          <button 
            onClick={toggleMic}
            className={cn(
              "p-2.5 rounded-lg transition-all active:scale-90",
              isMicOn ? "text-blue-400 bg-blue-400/10 shadow-[0_0_15px_rgba(96,165,250,0.1)]" : "text-white/20 hover:text-white/40 bg-white/5"
            )}
            title="Toggle Microphone"
          >
            {isMicOn ? <Mic size={18} /> : <MicOff size={18} />}
          </button>

          <button 
            onClick={toggleScreenShare}
            className={cn(
              "p-2.5 rounded-lg transition-all active:scale-90",
              isScreenSharing ? "text-green-400 bg-green-400/10" : "text-white/20 hover:text-white/40 bg-white/5"
            )}
            title="Share Screen"
          >
            <Monitor size={18} />
          </button>

          <button 
            onClick={toggleCamera}
            className={cn(
              "p-2.5 rounded-lg transition-all active:scale-90",
              isCameraOn ? "text-purple-400 bg-purple-400/10" : "text-white/20 hover:text-white/40 bg-white/5"
            )}
            title="Toggle Camera"
          >
            <Video size={18} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <AnimatePresence mode="wait">
          {activeTab === 'chat' && (
            <motion.div 
              key="chat"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-white/10 text-center p-8">
                    <MessageSquare size={48} className="mb-4 opacity-20" />
                    <h3 className="text-sm font-bold uppercase tracking-widest mb-2">Gemini Live</h3>
                    <p className="text-xs max-w-[200px] leading-relaxed">
                      Start a session to interact with Gemini using voice and screen sharing.
                    </p>
                  </div>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={cn(
                    "flex flex-col max-w-[90%]",
                    m.role === 'user' ? "ml-auto items-end" : "items-start"
                  )}>
                    <div className={cn(
                      "p-3 rounded-2xl text-xs leading-relaxed shadow-sm",
                      m.role === 'user' ? "bg-blue-600 text-white rounded-tr-none" : "bg-white/10 text-white/90 rounded-tl-none"
                    )}>
                      <ReactMarkdown>{m.text}</ReactMarkdown>
                    </div>
                    <span className="text-[8px] text-white/20 mt-1 px-1 uppercase font-bold">
                      {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Controls Bar */}
              <div className="p-4 bg-gradient-to-t from-[#0a0a0a] to-transparent space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    onClick={toggleMic}
                    disabled={!isConnected && !isConnecting}
                    className={cn(
                      "py-2.5 rounded-xl border flex items-center justify-center gap-2 transition-all",
                      isMicOn ? "bg-green-500/10 border-green-500/30 text-green-500" : 
                      isConnecting ? "bg-white/5 border-white/10 text-white/20 animate-pulse" :
                      "bg-white/5 border-white/10 text-white/40 disabled:opacity-20"
                    )}
                  >
                    {isMicOn ? <Mic size={16} /> : <MicOff size={16} />}
                    <span className="text-[10px] uppercase font-bold tracking-wider">
                      {isConnecting && !isMicOn ? "Wait..." : "Mic"}
                    </span>
                  </button>
                  <button 
                    onClick={toggleCamera}
                    disabled={!isConnected}
                    className={cn(
                      "py-2.5 rounded-xl border flex items-center justify-center gap-2 transition-all",
                      isCameraOn ? "bg-orange-500/10 border-orange-500/30 text-orange-500" : "bg-white/5 border-white/10 text-white/40 disabled:opacity-20"
                    )}
                  >
                    {isCameraOn ? <Video size={16} /> : <VideoOff size={16} />}
                    <span className="text-[10px] uppercase font-bold tracking-wider">Cam</span>
                  </button>
                  <button 
                    onClick={toggleScreenShare}
                    disabled={!isConnected}
                    className={cn(
                      "py-2.5 rounded-xl border flex items-center justify-center gap-2 transition-all",
                      isScreenSharing ? "bg-blue-500/10 border-blue-500/30 text-blue-500" : "bg-white/5 border-white/10 text-white/40 disabled:opacity-20"
                    )}
                  >
                    {isScreenSharing ? <Monitor size={16} /> : <MonitorOff size={16} />}
                    <span className="text-[10px] uppercase font-bold tracking-wider">Screen</span>
                  </button>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input 
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Type a message..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-4 pr-10 text-xs focus:outline-none focus:border-blue-500/50 transition-colors"
                    />
                    <button 
                      onClick={handleSendMessage}
                      disabled={!isConnected || !inputText.trim()}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-lg disabled:text-white/10"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'logs' && (
            <motion.div 
              key="logs"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal size={14} className="text-purple-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider">System Logs</h2>
                </div>
                <div className="flex items-center gap-4">
                  <button onClick={copyLogs} className="text-[10px] text-blue-400 hover:text-blue-300 uppercase font-bold tracking-widest">Copy All</button>
                  <button onClick={() => setLogs([])} className="text-[10px] text-white/20 hover:text-white/60 uppercase font-bold tracking-widest">Clear</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 font-mono text-[10px] space-y-2">
                {logs.length === 0 && (
                  <div className="h-full flex items-center justify-center text-white/10 italic">No logs recorded yet.</div>
                )}
                {logs.map((log) => (
                  <LogItem key={log.id} log={log} />
                ))}
                <div ref={logEndRef} />
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-white/10 flex items-center gap-2">
                <Settings size={14} className="text-orange-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider">Settings</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Voice & Language Settings */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-white/60">
                    <Volume2 size={14} />
                    <h3 className="text-[10px] font-bold uppercase tracking-widest">Voice & Language</h3>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[9px] uppercase font-bold tracking-widest text-white/30 px-1">Voice</label>
                    <select 
                      value={selectedVoice}
                      onChange={(e) => setSelectedVoice(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs focus:outline-none focus:border-blue-500/50"
                    >
                      <option value="Zephyr" className="bg-[#111]">Zephyr (Default)</option>
                      <option value="Puck" className="bg-[#111]">Puck</option>
                      <option value="Charon" className="bg-[#111]">Charon</option>
                      <option value="Kore" className="bg-[#111]">Kore</option>
                      <option value="Fenrir" className="bg-[#111]">Fenrir</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <label className="text-[9px] uppercase font-bold tracking-widest text-white/30 px-1">Language</label>
                      <select 
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs focus:outline-none focus:border-blue-500/50"
                      >
                        <option value="English" className="bg-[#111]">English</option>
                        <option value="Hindi" className="bg-[#111]">Hindi</option>
                        <option value="Tamil" className="bg-[#111]">Tamil</option>
                        <option value="Spanish" className="bg-[#111]">Spanish</option>
                        <option value="French" className="bg-[#111]">French</option>
                        <option value="German" className="bg-[#111]">German</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] uppercase font-bold tracking-widest text-white/30 px-1">Accent</label>
                      <select 
                        value={selectedAccent}
                        onChange={(e) => setSelectedAccent(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs focus:outline-none focus:border-blue-500/50"
                      >
                        <option value="Neutral" className="bg-[#111]">Neutral</option>
                        <option value="Indian" className="bg-[#111]">Indian</option>
                        <option value="British" className="bg-[#111]">British</option>
                        <option value="American" className="bg-[#111]">American</option>
                        <option value="Australian" className="bg-[#111]">Australian</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Mic Selection */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-white/60">
                    <Mic size={14} />
                    <h3 className="text-[10px] font-bold uppercase tracking-widest">Microphone</h3>
                  </div>
                  <select 
                    value={selectedMic}
                    onChange={(e) => setSelectedMic(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs focus:outline-none focus:border-blue-500/50"
                  >
                    {devices.map(d => (
                      <option key={d.deviceId} value={d.deviceId} className="bg-[#111]">{d.label}</option>
                    ))}
                  </select>
                  
                  <div className="space-y-3">
                    <button 
                      onClick={toggleMicTest}
                      className={cn(
                        "w-full py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors border",
                        isTestingMic ? "bg-green-500/10 border-green-500/30 text-green-500" : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                      )}
                    >
                      {isTestingMic ? "Stop Test" : "Test Mic Level"}
                    </button>

                    {isTestingMic && (
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, micVolume * 100)}%` }}
                          className="h-full bg-green-500"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Screen Share Settings */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-white/60">
                    <Monitor size={14} />
                    <h3 className="text-[10px] font-bold uppercase tracking-widest">Screen Quality</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[9px] uppercase font-bold tracking-widest text-white/30">
                      <span>JPEG Quality</span>
                      <span>{Math.round(screenQuality * 100)}%</span>
                    </div>
                    <input 
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.1"
                      value={screenQuality}
                      onChange={(e) => setScreenQuality(parseFloat(e.target.value))}
                      className="w-full accent-blue-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[9px] uppercase font-bold tracking-widest text-white/30">
                      <span>Max Dimension</span>
                      <span>{screenMaxDimension}px</span>
                    </div>
                    <select 
                      value={screenMaxDimension}
                      onChange={(e) => setScreenMaxDimension(parseInt(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs focus:outline-none focus:border-blue-500/50"
                    >
                      <option value="480" className="bg-[#111]">480px (Fastest)</option>
                      <option value="720" className="bg-[#111]">720px (Balanced)</option>
                      <option value="1024" className="bg-[#111]">1024px (Standard)</option>
                      <option value="1280" className="bg-[#111]">1280px (HD)</option>
                    </select>
                  </div>
                </div>

                {/* Speaker Test */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-white/60">
                    <Volume2 size={14} />
                    <h3 className="text-[10px] font-bold uppercase tracking-widest">Audio Output</h3>
                  </div>
                  <button 
                    onClick={testSpeakers}
                    className="w-full py-2.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/40 hover:bg-white/10 transition-colors"
                  >
                    Test Speaker Sound
                  </button>
                </div>

                <div className="pt-8 border-t border-white/5 text-center">
                  <p className="text-[8px] text-white/20 uppercase font-bold tracking-[0.2em]">Gemini Live Desktop v1.0</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Visual Preview Thumbnail */}
        <AnimatePresence>
          {(isScreenSharing || isCameraOn) && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              className="absolute bottom-20 right-4 w-40 aspect-video bg-black border border-white/20 rounded-lg overflow-hidden shadow-2xl z-50 group"
            >
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover"
              />
              <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[8px] font-bold uppercase tracking-widest text-white/80">
                {isScreenSharing ? 'Screen' : 'Camera'}
              </div>
              <button 
                onClick={isScreenSharing ? stopScreenCapture : stopCameraCapture}
                className="absolute top-1 right-1 p-1 bg-red-500/80 hover:bg-red-500 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={10} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden Video for Capture */}
        {!isScreenSharing && !isCameraOn && (
          <video ref={videoRef} autoPlay playsInline muted className="hidden" />
        )}
      </main>

      {/* Bottom Navigation (Tablet/Desktop Hidden?) */}
      <nav className="shrink-0 h-16 bg-[#0d0d0d] border-t border-white/10 flex items-center justify-around px-4 z-10 lg:hidden">
        <button 
          onClick={() => setActiveTab('logs')}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            activeTab === 'logs' ? "text-purple-500" : "text-white/20 hover:text-white/40"
          )}
        >
          <Terminal size={18} />
          <span className="text-[8px] font-bold uppercase tracking-widest">Logs</span>
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            activeTab === 'settings' ? "text-orange-500" : "text-white/20 hover:text-white/40"
          )}
        >
          <Settings size={18} />
          <span className="text-[8px] font-bold uppercase tracking-widest">Settings</span>
        </button>
      </nav>
    </div>
  );
}
