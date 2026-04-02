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
import { useLogs } from '../contexts/LogContext';
import { LogItem } from './LogItem';

const MODEL_NAME = "gemini-3.1-flash-live-preview";

const VOICE_GENDERS: Record<string, string> = {
  "Zephyr": "masculine",
  "Puck": "feminine",
  "Charon": "masculine",
  "Kore": "feminine",
  "Fenrir": "masculine"
};

// Local LogItem removed - handled by LogContext and standalone Logs page

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
  const { logs, addLog, clearLogs } = useLogs();
  const [inputText, setInputText] = useState("");
  const [activeTab, setActiveTab] = useState<'chat' | 'logs' | 'settings'>('chat');
  
  // Settings
  const [selectedMic, setSelectedMic] = useState<string>("default");
  const [selectedVoice, setSelectedVoice] = useState<string>("Zephyr");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("English");
  const [selectedAccent, setSelectedAccent] = useState<string>("Neutral");
  const [systemPrompt] = useState<string>(
    "You are a helpful assistant and tech expert. When a session starts, please warmly welcome the user and offer your assistance. You help users with Windows issues, IT systems, networks, and general tech support. You are gentle, proactive, and authoritative yet kind."
  );
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [screenQuality, setScreenQuality] = useState(0.6);
  const [screenMaxDimension, setScreenMaxDimension] = useState(720);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [tokenUsage, setTokenUsage] = useState({ input: 0, output: 0, total: 0 });
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [videoDevices, setVideoDevices] = useState<AudioDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("default");
  const [isHardwareMenuOpen, setIsHardwareMenuOpen] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

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

      const videoIn = devs
        .filter(d => d.kind === 'videoinput')
        .map(d => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 5)}` }));
      setVideoDevices(videoIn);
      
      if (videoIn.length > 0 && selectedCamera === "default") {
        setSelectedCamera(videoIn[0].deviceId);
      }
    } catch (err) {
      addLog('error', 'Failed to enumerate devices', err);
    }
  };

  // addLog now comes from useLogs() context

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

            // Trigger a welcome message from Gemini so user hears it immediately
            setTimeout(() => {
                if (sessionRef.current && connectedRef.current) {
                    sessionRef.current.sendRealtimeInput([{ text: "Hello! Please introduce yourself briefly and welcome the user." }]);
                }
            }, 1000);
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

  const toggleSpeakerMute = () => {
    const isMuted = !isSpeakerMuted;
    setIsSpeakerMuted(isMuted);
    if (audioPlayerRef.current) {
        audioPlayerRef.current.setMuted(isMuted);
    }
    // Update local storage for preference
    localStorage.setItem('speakerMuted', isMuted ? 'true' : 'false');
    addLog('system', `Speaker ${isMuted ? 'Muted' : 'Unmuted'}`);
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

  async function startCameraCapture(specificDeviceId?: string) {
    try {
      if (isScreenSharing) stopScreenCapture();
      const id = specificDeviceId || selectedCamera;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          deviceId: id !== "default" ? { exact: id } : undefined,
          width: { ideal: screenMaxDimension }, 
          height: { ideal: screenMaxDimension }, 
          frameRate: 5 
        }
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
      setIsCameraOn(true);
      addLog('info', 'Camera capture started');
    } catch (err) {
      addLog('error', 'Failed to start camera capture', err);
      setIsCameraOn(false);
    }
  }

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
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-white overflow-hidden w-full mx-auto shadow-2xl relative selection:bg-[#22C9E8]/30">
      {/* ── Mobile Sidebar Menu ──────────────────────────────────────── */}
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

      {/* ── Unified Hardware Header ───────────────────────────────────── */}
      <header className="shrink-0 p-3 pt-4 border-b border-white/5 bg-[#0d0d0d] flex items-center justify-between gap-4 z-20 relative">
        <div className="flex items-center gap-3 md:gap-4 leading-none">
          {/* Mobile Menu Trigger */}
          <button 
            onClick={() => setIsMenuOpen(true)}
            className="p-2 bg-white/5 rounded-xl border border-white/10 lg:hidden"
          >
            <Menu size={18} />
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1A2232] rounded-full border-2 border-black/20 min-w-[70px] md:min-w-[90px]">
            <div className={cn("w-1.5 h-1.5 rounded-full", isConnected ? "bg-[#22C9E8] animate-pulse" : "bg-white/10")} />
            <span className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest text-white leading-none">
              {isConnected ? "Live" : "Idle"}
            </span>
          </div>

          <button 
            onClick={isConnected ? stopSession : startSession}
            disabled={isConnecting}
            className={cn(
              "h-8 md:h-9 px-4 md:px-6 transition-all flex items-center justify-center font-bold",
              isConnected 
                ? "bg-red-500/10 text-red-500 border border-red-500/30 rounded-full hover:bg-red-500 hover:text-white" 
                : "bg-[#FFCC00] text-black rounded-full hover:bg-[#FFD633] shadow-lg shadow-[#FFCC00]/10"
            )}
            style={{ fontSize: '9px', tracking: '0.1em' }}
          >
            {isConnecting ? "..." : isConnected ? "End Session" : "Start Session"}
          </button>
        </div>

        {/* Desktop Metrics */}
        <div className="hidden lg:flex items-center gap-8 px-6 py-1.5 rounded-full bg-[#1A2232] border-2 border-black/20">
          <div className="flex flex-col items-center">
            <span className="text-[7px] text-white/40 uppercase font-bold tracking-widest mb-0.5">Tokens</span>
            <span className="text-[11px] font-bold text-[#22C9E8] leading-none">{tokenUsage.total.toLocaleString()}</span>
          </div>
          <div className="w-px h-5 bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="text-[7px] text-white/40 uppercase font-bold tracking-widest mb-0.5">Cost</span>
            <span className="text-[11px] font-bold text-green-400 leading-none">
              ${((tokenUsage.input * 0.000001) + (tokenUsage.output * 0.000004)).toFixed(5)}
            </span>
          </div>
          <div className="w-px h-5 bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="text-[7px] text-white/40 uppercase font-bold tracking-widest mb-0.5">Wallet</span>
            <span className="text-[11px] font-bold text-orange-400 leading-none">
              ${profile?.wallet_balance?.toFixed(2) || '0.00'}
            </span>
          </div>
        </div>

        {/* Hardware Status & Menu Trigger */}
        <div className="flex items-center gap-2 relative">
          <div className="flex items-center gap-1 p-1 bg-white/5 rounded-2xl border border-white/10">
             {/* Mic Status */}
             <button 
               onClick={toggleMic}
               className={cn(
                 "p-2 md:p-2.5 rounded-xl transition-all",
                 isMicOn ? "text-[#22C9E8] bg-[#22C9E8]/5" : "text-white/20 hover:text-white/40"
               )}
             >
               {isMicOn ? <Mic size={16} /> : <MicOff size={16} />}
             </button>

             {/* Speaker Status */}
             <button 
               onClick={toggleSpeakerMute}
               className={cn(
                 "p-2 md:p-2.5 rounded-xl transition-all",
                 !isSpeakerMuted ? "text-green-400 bg-green-400/5" : "text-red-400/60 bg-red-400/5"
               )}
             >
               {!isSpeakerMuted ? <Volume2 size={16} /> : <AlertCircle size={16} />}
             </button>

             {/* Cam Status */}
             <button 
               onClick={toggleCamera}
               className={cn(
                 "p-2 md:p-2.5 rounded-xl transition-all",
                 isCameraOn ? "text-[#FF6619] bg-[#FF6619]/5" : "text-white/20 hover:text-white/40"
               )}
             >
               {isCameraOn ? <Video size={16} /> : <VideoOff size={16} />}
             </button>
          </div>

          <button 
            onClick={() => setIsHardwareMenuOpen(!isHardwareMenuOpen)}
            className="p-2 md:p-2.5 rounded-2xl bg-white/5 border border-white/10 text-white/40 hover:text-white/80 transition-all"
          >
            <Settings size={18} className={cn("transition-transform duration-500", isHardwareMenuOpen && "rotate-90 text-[#22C9E8]")} />
          </button>

          {/* ── Hardware Diagnostics Hub (Dropdown) ─────────────────── */}
          <AnimatePresence>
            {isHardwareMenuOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full right-0 mt-4 w-[280px] md:w-[340px] bg-[#1A2232] rounded-[32px] border-4 border-black/40 shadow-2xl z-50 overflow-hidden"
              >
                <div className="p-6 space-y-6">
                  {/* Mic Diagnostics */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[#22C9E8]">
                        <Mic size={14} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Input Device</span>
                      </div>
                      {/* Visual Ping */}
                      {isMicOn && (
                        <div className="flex gap-0.5 h-3 items-end">
                            {[...Array(4)].map((_, i) => (
                                <motion.div 
                                    key={i}
                                    animate={{ height: [4, 12, 4] }}
                                    transition={{ repeat: Infinity, duration: 1, delay: i * 0.1 }}
                                    className="w-1 bg-[#22C9E8] rounded-full" 
                                />
                            ))}
                        </div>
                      )}
                    </div>
                    
                    <select 
                      value={selectedMic} 
                      onChange={(e) => setSelectedMic(e.target.value)}
                      className="w-full bg-black/40 border-2 border-white/5 rounded-2xl py-3 px-4 text-[11px] font-bold text-white/80 focus:outline-none focus:border-[#22C9E8]/30 cursor-pointer"
                    >
                      {devices.map(d => (
                        <option key={d.deviceId} value={d.deviceId} className="bg-[#1A2232]">{d.label}</option>
                      ))}
                    </select>

                    <div className="space-y-1.5">
                        <div className="flex justify-between text-[8px] uppercase font-black tracking-widest text-white/20">
                            <span>Mic Power</span>
                            <span>{Math.round(micVolume * 100)}%</span>
                        </div>
                        <div className="relative h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                            <motion.div 
                            animate={{ width: `${Math.min(100, micVolume * 100)}%` }}
                            className="absolute h-full bg-gradient-to-r from-blue-500 to-[#22C9E8] shadow-[0_0_12px_rgba(34,201,232,0.4)]"
                            />
                        </div>
                    </div>
                  </div>

                  {/* Camera Diagnostics */}
                  <div className="space-y-3 pt-5 border-t border-white/5">
                    <div className="flex items-center gap-2 text-[#FF6619]">
                      <Video size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Visual Device</span>
                    </div>

                    <select 
                      value={selectedCamera} 
                      onChange={(e) => {
                        const newId = e.target.value;
                        setSelectedCamera(newId);
                        if (isCameraOn) startCameraCapture(newId);
                      }}
                      className="w-full bg-black/40 border-2 border-white/5 rounded-2xl py-3 px-4 text-[11px] font-bold text-white/80 focus:outline-none focus:border-[#FF6619]/30 cursor-pointer"
                    >
                      {videoDevices.map(d => (
                        <option key={d.deviceId} value={d.deviceId} className="bg-[#1A2232]">{d.label}</option>
                      ))}
                    </select>

                    <div className="aspect-video bg-black/40 rounded-2xl border-2 border-white/5 overflow-hidden relative flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] bg-repeat">
                       {!isCameraOn ? (
                         <span className="text-[9px] uppercase font-black tracking-widest text-white/10 animate-pulse">Camera Idle</span>
                       ) : (
                         <video 
                           ref={(el) => {
                             if (el && isCameraOn) {
                               const mainStream = videoRef.current?.srcObject as MediaStream;
                               if (mainStream) el.srcObject = mainStream;
                             }
                           }}
                           autoPlay 
                           playsInline 
                           muted 
                           className="w-full h-full object-cover"
                         />
                       )}
                       {/* Floating Label */}
                       {isCameraOn && (
                          <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 text-[7px] font-black uppercase tracking-widest text-green-400">
                             Testing Feed
                          </div>
                       )}
                    </div>
                  </div>

                  {/* Speaker Diagnostics */}
                  <div className="pt-5 border-t border-white/5">
                    <button 
                      onClick={testSpeakers}
                      className="w-full py-4 bg-white/5 hover:bg-white/10 border-2 border-white/5 rounded-2xl flex items-center justify-center gap-3 transition-all group active:scale-[0.98]"
                    >
                      <Volume2 size={16} className="text-green-400 group-hover:scale-110 transition-transform" />
                      <span className="text-[11px] font-black uppercase tracking-widest text-white/60 group-hover:text-white">Play Test Chime</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* ── Area 1: Responsive Stream Container ───────────────────────── */}
      <main className="flex-1 flex flex-col p-3 md:p-6 lg:p-8 overflow-hidden relative">
        <div className="flex-1 min-h-0 bg-[#0D1117] rounded-[40px] md:rounded-[48px] border-4 border-black/40 shadow-inner overflow-hidden relative group">
          <AnimatePresence mode="wait">
            {(isScreenSharing || isCameraOn) ? (
              <motion.div 
                key="video"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="absolute inset-0 z-10"
              >
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className={cn(
                    "w-full h-full transition-transform duration-700 ease-out",
                    isScreenSharing ? "object-contain bg-black/60" : "object-cover group-hover:scale-105"
                  )}
                />
                
                {/* Status Badges */}
                <div className="absolute top-4 left-4 md:top-8 md:left-8 flex flex-col gap-2 pointer-events-none">
                    <motion.div 
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="px-4 py-2 bg-[#22C9E8] rounded-2xl text-[#0D1117] text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-2xl flex items-center gap-2 max-w-max"
                    >
                        <div className="w-1.5 h-1.5 bg-[#0D1117] rounded-full animate-pulse" />
                        {isScreenSharing ? "Broadcasting Tab" : "Broadcasting Webcam"}
                    </motion.div>
                    
                    {isMicOn && (
                        <div className="px-4 py-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl text-white/80 text-[8px] md:text-[9px] font-bold uppercase tracking-widest flex items-center gap-2 max-w-max">
                            <Mic size={10} className="text-[#22C9E8]" />
                            Direct Voice Link
                        </div>
                    )}
                </div>

                {/* Floating Visualizer */}
                <div className="absolute bottom-4 right-4 md:bottom-8 md:right-8 flex items-end gap-1.5 h-10 md:h-16 z-20 p-4 md:p-6 bg-black/40 backdrop-blur-xl rounded-[24px] md:rounded-[32px] border border-white/5">
                    {[...Array(12)].map((_, i) => (
                        <motion.div
                            key={i}
                            animate={{ 
                                height: isMicOn && isConnected ? Math.max(4, micVolume * (24 + Math.random() * 20)) : 4,
                                opacity: isMicOn && isConnected ? 1 : 0.1
                            }}
                            className={cn(
                                "w-0.5 md:w-1 rounded-full transition-colors",
                                isConnected ? "bg-[#22C9E8]" : "bg-white/20"
                            )}
                        />
                    ))}
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center p-8 md:p-12 text-center bg-[radial-gradient(circle_at_center,_#1a1a1a_0%,_#0D1117_100%)]"
              >
                <div className="w-16 h-16 md:w-24 md:h-24 bg-white/5 rounded-[28px] md:rounded-[40px] border border-white/10 flex items-center justify-center mb-6 md:mb-10 shadow-2xl relative overflow-hidden group">
                  <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Terminal size={32} className="text-[#22C9E8]/40 md:w-12 md:h-12" />
                </div>
                <h3 className="text-xl md:text-3xl font-bold text-white mb-4 tracking-tight" style={{ fontFamily: "'Comfortaa', sans-serif" }}>
                  Start Your <span className="text-[#22C9E8]">Live Experience</span>
                </h3>
                <p className="text-white/40 max-w-xs md:max-w-md text-xs md:text-sm font-medium leading-relaxed mb-8">
                  Connect to Humphi Live to begin a real-time session with your AI assistant using voice and high-fidelity video context.
                </p>
                <div className="flex items-center gap-3 p-1.5 bg-[#1A2232] rounded-full border border-black/40">
                   <div className="px-5 py-2 bg-white/5 rounded-full text-[8px] font-black uppercase tracking-widest text-white/30">
                      Standard Quality
                   </div>
                   <div className="px-5 py-2 bg-[#22C9E8]/10 rounded-full text-[8px] font-black uppercase tracking-widest text-[#22C9E8]">
                      V3.1 Flash
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Area 3: Large Responsive Control Tabs ────────────────────── */}
        <div className="shrink-0 mt-4 md:mt-8 flex justify-center w-full">
          <div className="p-2 bg-[#1A2232] rounded-[32px] md:rounded-[40px] border-4 border-black/40 shadow-2xl flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full">
            <button 
              onClick={toggleMic}
              disabled={!isConnected && !isConnecting}
              className={cn(
                "px-6 md:px-10 py-4 md:py-6 rounded-[24px] md:rounded-[32px] flex items-center gap-3 transition-all active:scale-95 disabled:opacity-20 shrink-0",
                isMicOn ? "bg-[#22C9E8] text-[#0D1117] shadow-xl shadow-[#22C9E8]/20" : "bg-white/5 text-white/40 hover:bg-white/10"
              )}
            >
              {isMicOn ? <Mic size={20} className="md:w-6 md:h-6" /> : <MicOff size={20} className="md:w-6 md:h-6" />}
              <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">Mic</span>
            </button>

            <button 
              onClick={toggleCamera}
              disabled={!isConnected}
              className={cn(
                "px-6 md:px-10 py-4 md:py-6 rounded-[24px] md:rounded-[32px] flex items-center gap-3 transition-all active:scale-95 disabled:opacity-20 shrink-0",
                isCameraOn ? "bg-[#FF6619] text-white shadow-xl shadow-[#FF6619]/20" : "bg-white/5 text-white/40 hover:bg-white/10"
              )}
            >
              <Video size={20} className="md:w-6 md:h-6" />
              <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">Cam</span>
            </button>

            <button 
              onClick={toggleScreenShare}
              disabled={!isConnected}
              className={cn(
                "px-6 md:px-10 py-4 md:py-6 rounded-[24px] md:rounded-[32px] flex items-center gap-3 transition-all active:scale-95 disabled:opacity-20 shrink-0",
                isScreenSharing ? "bg-[#22C9E8] text-[#0D1117] shadow-xl shadow-[#22C9E8]/20" : "bg-white/5 text-white/40 hover:bg-white/10"
              )}
            >
              <Monitor size={20} className="md:w-6 md:h-6" />
              <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">Tab</span>
            </button>
          </div>
        </div>
      </main>

      {/* Hidden Video for Initial Capture States */}
      {!isScreenSharing && !isCameraOn && (
        <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      )}
    </div>
  );
}
