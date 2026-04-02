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
import { inngest } from '../lib/inngest';

const MODEL_NAME = "models/gemini-2.0-flash-exp";

const ROLE_PRESETS: Record<string, string> = {
  "Professional Assistant": "You are a highly efficient, professional executive assistant. You are concise, polite, and detail-oriented. You focus on productivity and task management.",
  "Creative Partner": "You are a collaborative creative partner. You brainstorm ideas, offer unique perspectives, and encourage outside-the-box thinking. Your tone is supportive and imaginative.",
  "Technical Expert": "You are a senior-level software architect and technical lead. You provide precise technical explanations, code-focused solutions, and architectural best practices.",
  "Therapist": "You are a compassionate listener. You validate feelings first, use empathetic language, and help the user explore their emotions without judgment.",
  "Friendly Companion": "You are a warm, casual friend. You joke around, use informal language, and are always ready for a lighthearted chat. You avoid being overly formal.",
  "Strict Mentor": "You are a demanding but fair mentor. You push the user to achieve their potential and point out areas for improvement directly. You do not tolerate excuses.",
  "IT Manager": "You advise on enterprise IT, policy, vendor selection, and strategic infrastructure. You speak professionally and focus on business value and ROI."
};

const TIER_1_LANGUAGES = [
  { name: "Arabic (Egypt)", code: "ar-EG" },
  { name: "Bengali (Bangladesh)", code: "bn-BD" },
  { name: "Dutch", code: "nl-NL" },
  { name: "English (US)", code: "en-US" },
  { name: "French (France)", code: "fr-FR" },
  { name: "German", code: "de-DE" },
  { name: "Hindi", code: "hi-IN" },
  { name: "Indonesian", code: "id-ID" },
  { name: "Italian", code: "it-IT" },
  { name: "Japanese", code: "ja-JP" },
  { name: "Korean", code: "ko-KR" },
  { name: "Marathi", code: "mr-IN" },
  { name: "Polish", code: "pl-PL" },
  { name: "Portuguese (Brazil)", code: "pt-BR" },
  { name: "Romanian", code: "ro-RO" },
  { name: "Russian", code: "ru-RU" },
  { name: "Spanish (US)", code: "es-US" },
  { name: "Tamil", code: "ta-IN" },
  { name: "Telugu", code: "te-IN" },
  { name: "Thai", code: "th-TH" },
  { name: "Turkish", code: "tr-TR" },
  { name: "Ukrainian", code: "uk-UA" },
  { name: "Vietnamese", code: "vi-VN" }
];

const TIER_2_LANGUAGES = [
  "Afrikaans", "Albanian", "Amharic", "Armenian", "Assamese", "Azerbaijani", "Basque", "Belarusian", "Bosnian", "Bulgarian", 
  "Burmese", "Catalan", "Cebuano", "Chinese", "Croatian", "Czech", "Danish", "Estonian", "Faroese", "Filipino", 
  "Finnish", "Galician", "Georgian", "Greek", "Gujarati", "Hausa", "Hebrew", "Hungarian", "Icelandic", "Irish", 
  "Kannada", "Kazakh", "Khmer", "Kinyarwanda", "Kurdish", "Kyrgyz", "Lao", "Latvian", "Lithuanian", "Macedonian", 
  "Malay", "Malayalam", "Maltese", "Maori", "Mongolian", "Nepali", "Norwegian", "Odia", "Oromo", "Pashto", 
  "Persian", "Punjabi", "Quechua", "Romansh", "Serbian", "Sindhi", "Sinhala", "Slovak", "Slovenian", "Somali", 
  "Sotho", "Swahili", "Swedish", "Tajik", "Tswana", "Turkmen", "Urdu", "Uzbek", "Welsh", "Wolof", "Yoruba", "Zulu"
];

const ACCENTS: Record<string, string[]> = {
  "English (US)": ["Gen. American", "New York", "Southern", "Californian", "British RP", "Cockney", "Scottish", "Irish", "Australian", "New Zealand", "Indian", "South African", "Canadian", "Jamaican"],
  "Spanish (US)": ["Mexican", "Castilian (Spain)", "Argentine", "Colombian", "Chilean", "Cuban", "Puerto Rican"],
  "French (France)": ["Parisian", "Québécois", "Belgian", "Swiss", "West African"],
  "Portuguese (Brazil)": ["Brazilian (São Paulo)", "European (Lisbon)"],
  "Arabic (Egypt)": ["Egyptian", "Gulf/Saudi", "Levantine", "Moroccan", "Iraqi"],
  "German": ["Standard German", "Austrian", "Swiss German", "Bavarian"],
  "Italian": ["Standard (Tuscan)", "Roman", "Milanese", "Sicilian"],
  "Hindi": ["Standard Delhi", "Mumbai", "Bollywood-style"],
  "Chinese": ["Mandarin (Beijing)", "Taiwanese Mandarin"]
};

const VOICE_OPTIONS = [
  { name: "Kore", style: "Firm", gender: "female" },
  { name: "Zephyr", style: "Bright", gender: "neutral" },
  { name: "Charon", style: "Informative", gender: "male" },
  { name: "Puck", style: "Upbeat", gender: "male" },
  { name: "Fenrir", style: "Excitable", gender: "male" },
  { name: "Leda", style: "Youthful", gender: "female" },
  { name: "Aoede", style: "Breezy", gender: "female" },
  { name: "Orus", style: "Firm", gender: "male" },
  { name: "Callirrhoe", style: "Easy-going", gender: "female" },
  { name: "Erinome", style: "Clear", gender: "female" },
  { name: "Enceladus", style: "Breathy", gender: "female" },
  { name: "Iapetus", style: "Clear", gender: "male" },
  { name: "Laomedeia", style: "Upbeat", gender: "female" },
  { name: "Algieba", style: "Smooth", gender: "female" },
  { name: "Despina", style: "Smooth", gender: "female" },
  { name: "Schedar", style: "Even", gender: "female" },
  { name: "Algenib", style: "Gravelly", gender: "male" },
  { name: "Rasalgethi", style: "Informative", gender: "male" },
  { name: "Achird", style: "Friendly", gender: "female" },
  { name: "Achernar", style: "Soft", gender: "female" },
  { name: "Alnilam", style: "Firm", gender: "male" },
  { name: "Sadachbia", style: "Lively", gender: "female" },
  { name: "Gacrux", style: "Mature", gender: "female" },
  { name: "Pulcherrima", style: "Forward", gender: "female" },
  { name: "Umbriel", style: "Easy-going", gender: "male" },
  { name: "Zubenelgenubi", style: "Casual", gender: "male" },
  { name: "Vindemiatrix", style: "Gentle", gender: "female" },
  { name: "Autonoe", style: "Bright", gender: "female" },
  { name: "Sadaltager", style: "Knowledgeable", gender: "male" },
  { name: "Sulafat", style: "Warm", gender: "female" }
];

const WELCOME_MESSAGES: Record<string, string> = {
  "Tech Expert": "Hello! I am your Technical Expert. Looking to debug something, discuss architecture, or explore new stacks?",
  "Product Manager": "Hi there! I am your Product Manager. Ready to refine requirements, prioritize features, and talk about the roadmap?",
  "Business Analyst": "Greetings. I'm your Business Analyst. Let's look at the data, requirements, and business value together.",
  "Creative Designer": "Hi! I'm your Creative Designer. Let's talk about user experience, visual consistency, and creative solutions.",
  "Project Coordinator": "Hello! I am your Project Coordinator. Let's get organized, check on deadlines, and clear any blockers."
};

export default function GeminiLive() {
  const { user } = useUser();
  const { signOut, getToken } = useAuth();
  const { logs, addLog, clearLogs } = useLogs();
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

  // -- State: Lifecycle & Status --
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [activeTab, setActiveTab] = useState<'chat' | 'logs' | 'settings'>('chat');
  const [permissionState, setPermissionState] = useState<'idle' | 'denied' | 'granted'>('idle');
  const [permissionDeniedType, setPermissionDeniedType] = useState<'mic' | 'camera' | 'both' | null>(null);

  // -- State: Settings --
  const [selectedMic, setSelectedMic] = useState<string>(() => localStorage.getItem('selectedMic') || "default");
  const [selectedVoice, setSelectedVoice] = useState<string>(() => localStorage.getItem('selectedVoice') || "Kore");
  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => localStorage.getItem('selectedLanguage') || "English (US)");
  const [selectedAccent, setSelectedAccent] = useState<string>(() => localStorage.getItem('selectedAccent') || "Standard");
  
  // -- State: Agent identity --
  const [agentName, setAgentName] = useState(() => localStorage.getItem('agentName') || 'Humphi');
  const [agentRole, setAgentRole] = useState(() => localStorage.getItem('agentRole') || 'Tech Expert');
  const [agentDescription, setAgentDescription] = useState(() => localStorage.getItem('agentDescription') || ROLE_PRESETS["Tech Expert"]);
  const [welcomeMessage, setWelcomeMessage] = useState(() => localStorage.getItem('welcomeMsg') || '');
  
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'agent' | 'voice' | 'hardware'>('agent');
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dropTimerRef = useRef<NodeJS.Timeout | null>(null);

  const prevRoleRef = useRef(agentRole);

  // Auto-sync welcome message on role change
  useEffect(() => {
    // If user hasn't customized the welcome message (it matches the default for the PREVIOUS role),
    // then update it to the default for the NEW role.
    const prevDefault = WELCOME_MESSAGES[prevRoleRef.current];
    if (!welcomeMessage || welcomeMessage === prevDefault) {
        const nextMsg = WELCOME_MESSAGES[agentRole];
        if (nextMsg) setWelcomeMessage(nextMsg);
    }
    prevRoleRef.current = agentRole;
  }, [agentRole]);

  // -- Lifecycle: Persistence Effects --
  useEffect(() => { localStorage.setItem('selectedMic', selectedMic); }, [selectedMic]);
  useEffect(() => { localStorage.setItem('selectedVoice', selectedVoice); }, [selectedVoice]);
  useEffect(() => { localStorage.setItem('selectedLanguage', selectedLanguage); }, [selectedLanguage]);
  useEffect(() => { localStorage.setItem('selectedAccent', selectedAccent); }, [selectedAccent]);
  useEffect(() => { localStorage.setItem('agentName', agentName); }, [agentName]);
  useEffect(() => { localStorage.setItem('agentRole', agentRole); }, [agentRole]);
  useEffect(() => { localStorage.setItem('agentDescription', agentDescription); }, [agentDescription]);
  useEffect(() => { localStorage.setItem('welcomeMsg', welcomeMessage); }, [welcomeMessage]);
  useEffect(() => { localStorage.setItem('selectedAccent', selectedAccent); }, [selectedAccent]);
  useEffect(() => { localStorage.setItem('agentName', agentName); }, [agentName]);
  useEffect(() => { localStorage.setItem('agentRole', agentRole); }, [agentRole]);
  useEffect(() => { localStorage.setItem('agentDescription', agentDescription); }, [agentDescription]);
  useEffect(() => { localStorage.setItem('welcomeMsg', welcomeMessage); }, [welcomeMessage]);
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
  const [isPreviewingCamera, setIsPreviewingCamera] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);

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
      stopCameraPreview();
      clearTimers();
    };
  }, []);

  const clearTimers = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (dropTimerRef.current) clearTimeout(dropTimerRef.current);
  };

  const resetTimers = () => {
    clearTimers();
    if (!isConnected) return;

    // 15s Idle check-in
    idleTimerRef.current = setTimeout(() => {
      if (sessionRef.current && isConnected) {
        sessionRef.current.sendRealtimeInput([{ text: "Are you still there? I'm here if you need anything." }]);
        addLog('info', 'Sent idle check-in');
      }
    }, 15000);

    // 60s Drop disconnect
    dropTimerRef.current = setTimeout(() => {
      if (isConnected) {
        addLog('warn', 'Session timed out due to 60s inactivity');
        stopSession();
      }
    }, 60000);
  };

  const buildSystemPrompt = () => {
    const langPrompt = selectedLanguage.includes('(') ? selectedLanguage : `${selectedLanguage} language`;
    const accentPrompt = selectedAccent !== 'Standard' ? ` Speak with a ${selectedAccent} accent.` : "";
    
    return `Your name is ${agentName}. Your role is: ${agentRole}. 
Description: ${agentDescription}

Identity Rules:
- You must speak in ${langPrompt}.${accentPrompt}
- Maintain the persona described above at all times.
- Be proactive and helpful.`;
  };

  // Stop camera preview whenever the hardware menu closes
  useEffect(() => {
    if (!isHardwareMenuOpen) {
      stopCameraPreview();
    }
  }, [isHardwareMenuOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Real-time balance polling every 60 seconds while connected
  useEffect(() => {
    let interval: any;
    if (isConnected) {
      interval = setInterval(fetchProfile, 60000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected]);

  const getDevices = async () => {
    // Step 1: Request permissions first so device labels are populated.
    // Browsers return blank labels unless the user has granted access.
    let micGranted = false;
    let cameraGranted = false;

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStream.getTracks().forEach(t => t.stop());
      micGranted = true;
    } catch {
      addLog('warn', 'Microphone permission denied or unavailable');
    }

    try {
      const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
      camStream.getTracks().forEach(t => t.stop());
      cameraGranted = true;
    } catch {
      addLog('warn', 'Camera permission denied or unavailable');
    }

    // Show in-app permission modal if either was denied
    if (!micGranted && !cameraGranted) {
      setPermissionDeniedType('both');
      setPermissionState('denied');
    } else if (!micGranted) {
      setPermissionDeniedType('mic');
      setPermissionState('denied');
    } else if (!cameraGranted) {
      setPermissionDeniedType('camera');
      setPermissionState('denied');
    } else {
      setPermissionState('granted');
    }

    // Step 2: Enumerate devices — now labels will be available
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

      const langCode = TIER_1_LANGUAGES.find(l => l.name === selectedLanguage)?.code || 'en-US';

      const session = await ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            languageCode: langCode,
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: selectedVoice as any
              }
            }
          },
          systemInstruction: buildSystemPrompt()
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            connectedRef.current = true;
            setIsConnecting(false);
            addLog('info', 'Connected to Gemini Live');
            
            setIsMicOn(true);
            startAudioCapture();

            // Trigger a welcome message
            resetTimers();
            setTimeout(() => {
                if (sessionRef.current && connectedRef.current) {
                    const msg = welcomeMessage || `Hello! I am ${agentName}, your ${agentRole}. How can I help you today?`;
                    sessionRef.current.sendRealtimeInput([{ text: msg }]);
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
          if (!user?.id) return;
          const transcript = messages.map(m => `[${m.role}] ${m.text}`).join('\n');
          
          addLog('info', 'Dispatching session/ended event to Inngest for background billing...', { tokens: tokenUsage });
          
          // Using Inngest for asynchronous, background billing and session memory 
          // to prevent UI hangs or data loss on component unmount
          await inngest.send({
            name: "session/ended",
            data: {
              userId: user.id,
              transcript,
              tokenUsage,
              agentRole,
              agentName,
              timestamp: new Date().toISOString()
            }
          });

          addLog('info', 'Inngest event dispatched successfully.');
      } catch (err) {
          addLog('error', 'Failed to dispatch session/ended event', err);
      }
  };

  const stopSession = () => {
    if (!connectedRef.current && !isConnecting) return;
    
    addLog('info', 'Ending session. Cleaning up resources...');
    
    setIsConnected(false);
    connectedRef.current = false;
    setIsConnecting(false);
    setIsMicOn(false);
    setIsScreenSharing(false);
    setIsCameraOn(false);
    
    // Clear all pending timers (idle check, drop disconnect)
    clearTimers();

    if (sessionRef.current) {
      try {
          sessionRef.current.close();
      } catch (err) {
          console.error('Error closing session:', err);
      }
      sessionRef.current = null;
    }
    
    // Stop all media streams and capture loops
    stopAudioCapture();
    stopScreenCapture();
    stopCameraCapture();
    
    if (audioPlayerRef.current) {
      audioPlayerRef.current.stop();
      audioPlayerRef.current = null;
    }

    // Capture and bill session asynchronously
    if (messages.length > 0) {
        saveSessionAndBill();
    }

    addLog('system', 'Session ended and resources cleared.');
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
          resetTimers(); // Reset timers on any model output
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
          resetTimers(); // Reset on user voice input
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
    localStorage.setItem('speakerMuted', isMuted ? 'true' : 'false');
    addLog('system', `Speaker ${isMuted ? 'Muted' : 'Unmuted'}`);
  };

  const startCameraPreview = async (deviceId?: string) => {
    // Stop any previous preview first
    stopCameraPreview();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: deviceId || selectedCamera || undefined, width: { ideal: 640 }, height: { ideal: 360 } }
      });
      previewStreamRef.current = stream;
      setIsPreviewingCamera(true);
      // Assign to the preview video element
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream;
        previewVideoRef.current.play().catch(() => {});
      }
    } catch (err) {
      addLog('error', 'Camera preview failed. Check permissions.', err);
      setPermissionDeniedType('camera');
      setPermissionState('denied');
    }
  };

  const stopCameraPreview = () => {
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach(t => t.stop());
      previewStreamRef.current = null;
    }
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
    }
    setIsPreviewingCamera(false);
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
    
    resetTimers(); // Reset on user text input
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
      {/* ── Permissions Denied Modal ─────────────────────────────────── */}
      <AnimatePresence>
        {permissionState === 'denied' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-lg"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="w-full max-w-sm bg-[#1A2232] rounded-[32px] border border-white/10 shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="relative px-6 pt-8 pb-6 bg-gradient-to-b from-red-500/10 to-transparent">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle size={32} className="text-red-400" />
                </div>
                <h2 className="text-center text-white font-black text-lg tracking-tight mb-1" style={{ fontFamily: "'Comfortaa', sans-serif" }}>
                  Permission Required
                </h2>
                <p className="text-center text-white/50 text-xs leading-relaxed">
                  {permissionDeniedType === 'both' && 'Humphi Live needs access to your microphone and camera to work.'}
                  {permissionDeniedType === 'mic' && 'Humphi Live needs access to your microphone to listen to your voice.'}
                  {permissionDeniedType === 'camera' && 'Camera access was blocked. You can still use the app with mic only.'}
                </p>
              </div>

              {/* Steps */}
              <div className="px-6 pb-6 space-y-3">
                <div className="text-[9px] uppercase font-black tracking-widest text-white/30 mb-3">How to fix this</div>
                {[
                  { num: '1', text: 'Click the 🔒 lock or camera icon in your browser\'s address bar' },
                  { num: '2', text: permissionDeniedType === 'both' ? 'Set Microphone and Camera to "Allow"' : permissionDeniedType === 'mic' ? 'Set Microphone to "Allow"' : 'Set Camera to "Allow"' },
                  { num: '3', text: 'Refresh this page and try again' },
                ].map(step => (
                  <div key={step.num} className="flex items-start gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                    <div className="w-5 h-5 rounded-full bg-[#22C9E8]/20 border border-[#22C9E8]/30 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[9px] font-black text-[#22C9E8]">{step.num}</span>
                    </div>
                    <p className="text-[11px] text-white/60 leading-snug">{step.text}</p>
                  </div>
                ))}

                {/* Action buttons */}
                <div className="flex gap-2 pt-2">
                  {/* Only show dismiss for camera-only so user can still use the app with mic */}
                  {permissionDeniedType === 'camera' && (
                    <button
                      onClick={() => setPermissionState('idle')}
                      className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/50 transition-all"
                    >
                      Continue without camera
                    </button>
                  )}
                  <button
                    onClick={() => { setPermissionState('idle'); getDevices(); }}
                    className="flex-1 py-3 bg-[#22C9E8] hover:bg-[#22C9E8]/90 rounded-2xl text-[10px] font-black uppercase tracking-widest text-[#0D1117] transition-all active:scale-[0.98]"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="absolute top-full right-0 mt-3 w-[340px] md:w-[400px] bg-[#1A2232]/95 backdrop-blur-2xl rounded-[32px] md:rounded-[40px] border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] z-50 overflow-hidden"
              >
                {/* Custom Tab Header */}
                <div className="flex p-2 bg-black/20 gap-1">
                  {[
                    { id: 'agent', label: 'Identity', icon: User },
                    { id: 'voice', label: 'Voice', icon: Volume2 },
                    { id: 'hardware', label: 'Hardware', icon: Settings },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveSettingsTab(tab.id as any)}
                      className={cn(
                        "flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 transition-all",
                        activeSettingsTab === tab.id 
                          ? "bg-[#22C9E8] text-[#0D1117] shadow-lg shadow-[#22C9E8]/20" 
                          : "text-white/40 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <tab.icon size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
                    </button>
                  ))}
                </div>

                <div className="p-6 md:p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  {/* --- IDENTITY TAB --- */}
                  {activeSettingsTab === 'agent' && (
                    <motion.div 
                      key="agent-tab"
                      initial={{ opacity: 0, x: -10 }} 
                      animate={{ opacity: 1, x: 0 }} 
                      className="space-y-5"
                    >
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Agent Name</label>
                        <input 
                          type="text" 
                          value={agentName}
                          onChange={(e) => setAgentName(e.target.value)}
                          placeholder="What is your assistant's name?"
                          className="w-full bg-black/40 border-2 border-white/5 rounded-2xl py-3 px-4 text-xs font-bold text-white placeholder:text-white/10 focus:outline-none focus:border-[#22C9E8]/30"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Core Persona / Role</label>
                        <div className="relative group">
                          <select 
                            value={agentRole}
                            onChange={(e) => {
                              setAgentRole(e.target.value);
                              if (ROLE_PRESETS[e.target.value]) {
                                setAgentDescription(ROLE_PRESETS[e.target.value]);
                              }
                            }}
                            className="w-full bg-black/40 border-2 border-white/5 rounded-2xl py-3 px-4 text-xs font-bold text-white appearance-none cursor-pointer focus:outline-none focus:border-[#22C9E8]/30"
                          >
                            {Object.keys(ROLE_PRESETS).map(role => (
                              <option key={role} value={role} className="bg-[#1A2232]">{role}</option>
                            ))}
                            <option value="Custom" className="bg-[#1A2232]">Custom...</option>
                          </select>
                          <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none group-hover:text-white/40 transition-colors" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-end ml-1">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Description & Rules</label>
                          <span className="text-[9px] text-[#22C9E8]/40 font-bold">Auto-saves to prompt</span>
                        </div>
                        <textarea 
                          value={agentDescription}
                          onChange={(e) => setAgentDescription(e.target.value)}
                          placeholder="How should the agent behave? What are its rules?"
                          rows={4}
                          className="w-full bg-black/40 border-2 border-white/5 rounded-2xl py-3 px-4 text-xs font-medium text-white/70 leading-relaxed resize-none focus:outline-none focus:border-[#22C9E8]/30"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Welcome Message</label>
                        <input 
                          type="text" 
                          value={welcomeMessage}
                          onChange={(e) => setWelcomeMessage(e.target.value)}
                          placeholder="Spoken when session starts..."
                          className="w-full bg-black/40 border-2 border-white/5 rounded-2xl py-3 px-4 text-xs font-bold text-white placeholder:text-white/10 focus:outline-none focus:border-[#22C9E8]/30"
                        />
                      </div>
                    </motion.div>
                  )}

                  {/* --- VOICE & LANGUAGE TAB --- */}
                  {activeSettingsTab === 'voice' && (
                    <motion.div 
                      key="voice-tab"
                      initial={{ opacity: 0, x: -10 }} 
                      animate={{ opacity: 1, x: 0 }} 
                      className="space-y-5"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Language</label>
                          <div className="relative group">
                            <select 
                              value={selectedLanguage}
                              onChange={(e) => {
                                setSelectedLanguage(e.target.value);
                                if (ACCENTS[e.target.value]) {
                                  setSelectedAccent(ACCENTS[e.target.value][0]);
                                } else {
                                  setSelectedAccent("Standard");
                                }
                              }}
                              className="w-full bg-black/40 border-2 border-white/5 rounded-2xl py-3 px-4 text-[10px] font-black uppercase tracking-wider text-white appearance-none cursor-pointer focus:outline-none focus:border-[#22C9E8]/30"
                            >
                              <optgroup label="Native Support (V3.1)" className="text-[#22C9E8]">
                                {TIER_1_LANGUAGES.map(l => (
                                  <option key={l.name} value={l.name} className="bg-[#1A2232]">{l.name}</option>
                                ))}
                              </optgroup>
                              <optgroup label="Experimental / Logic-only" className="text-white/40">
                                {TIER_2_LANGUAGES.map(l => (
                                  <option key={l} value={l} className="bg-[#1A2232]">{l}</option>
                                ))}
                              </optgroup>
                            </select>
                            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none group-hover:text-white/40" />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Accent Style</label>
                          <div className="relative group">
                            <select 
                              value={selectedAccent}
                              onChange={(e) => setSelectedAccent(e.target.value)}
                              className="w-full bg-black/40 border-2 border-white/5 rounded-2xl py-3 px-4 text-[10px] font-black uppercase tracking-wider text-white appearance-none cursor-pointer focus:outline-none focus:border-[#22C9E8]/30"
                            >
                              <option value="Standard" className="bg-[#1A2232]">Standard</option>
                              {ACCENTS[selectedLanguage]?.map(acc => (
                                <option key={acc} value={acc} className="bg-[#1A2232]">{acc}</option>
                              ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 pt-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Gemini V3 Voice Profile</label>
                        <div className="grid grid-cols-2 gap-2">
                          {VOICE_OPTIONS.map(v => (
                            <button
                              key={v.name}
                              onClick={() => setSelectedVoice(v.name)}
                              className={cn(
                                "p-4 rounded-2xl border-2 flex flex-col items-start gap-1 transition-all group",
                                selectedVoice === v.name 
                                  ? "bg-[#22C9E8]/10 border-[#22C9E8] text-white shadow-lg shadow-[#22C9E8]/10" 
                                  : "bg-black/20 border-white/5 text-white/40 hover:border-white/20 hover:text-white"
                              )}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="text-[11px] font-black uppercase tracking-wider">{v.name}</span>
                                {v.gender === 'female' ? <User size={10} className="text-pink-400/60" /> : <User size={10} className="text-blue-400/60" />}
                              </div>
                              <span className="text-[8px] font-bold opacity-60">{v.style}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* --- HARDWARE TAB --- */}
                  {activeSettingsTab === 'hardware' && (
                    <motion.div 
                      key="hardware-tab"
                      initial={{ opacity: 0, x: -10 }} 
                      animate={{ opacity: 1, x: 0 }} 
                      className="space-y-6"
                    >
                      {/* Audio Input Selection */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 ml-1">
                          <Mic size={14} className="text-[#22C9E8]" />
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Microphone Input</label>
                        </div>
                        
                        <div className="relative group">
                          <select 
                            value={selectedMic} 
                            onChange={(e) => setSelectedMic(e.target.value)}
                            className="w-full bg-black/40 border-2 border-white/5 rounded-2xl py-3 px-4 text-xs font-bold text-white appearance-none cursor-pointer focus:outline-none focus:border-[#22C9E8]/30"
                          >
                            {devices.length === 0 ? (
                              <option value="">No microphone detected</option>
                            ) : (
                              devices.map(d => (
                                <option key={d.deviceId} value={d.deviceId} className="bg-[#1A2232]">{d.label}</option>
                              ))
                            )}
                          </select>
                          <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none group-hover:text-white/40" />
                        </div>

                        {/* Mic Power Meter */}
                        <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-3">
                            <div className="flex justify-between items-end">
                                <div className="space-y-1">
                                  <span className="block text-[8px] uppercase font-black tracking-widest text-[#22C9E8]">Live Level</span>
                                  <span className="block text-[10px] font-bold text-white/80">{isTestingMic ? `${Math.round(micVolume * 100)}%` : 'Sensor Inactive'}</span>
                                </div>
                                <button
                                  onClick={toggleMicTest}
                                  className={cn(
                                    "px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all",
                                    isTestingMic ? "bg-red-500/20 text-red-500" : "bg-[#22C9E8]/10 text-[#22C9E8] hover:bg-[#22C9E8]/20"
                                  )}
                                >
                                  {isTestingMic ? 'Stop Test' : 'Start Test'}
                                </button>
                            </div>
                            <div className="relative h-1.5 bg-black/60 rounded-full overflow-hidden">
                                <motion.div 
                                  animate={{ width: `${Math.min(100, micVolume * 100)}%` }}
                                  transition={{ duration: 0.1 }}
                                  className="absolute h-full bg-[#22C9E8] shadow-[0_0_12px_rgba(34,201,232,0.4)]"
                                />
                            </div>
                        </div>
                      </div>

                      {/* Camera Selection */}
                      <div className="space-y-4 pt-2">
                        <div className="flex items-center gap-2 ml-1">
                          <Video size={14} className="text-[#FF6619]" />
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Camera Source</label>
                        </div>

                        <div className="relative group">
                          <select 
                            value={selectedCamera} 
                            onChange={(e) => setSelectedCamera(e.target.value)}
                            className="w-full bg-black/40 border-2 border-white/5 rounded-2xl py-3 px-4 text-xs font-bold text-white appearance-none cursor-pointer focus:outline-none focus:border-[#22C9E8]/30"
                          >
                            {videoDevices.length === 0 ? (
                              <option value="">No cameras detected</option>
                            ) : (
                              videoDevices.map(d => (
                                <option key={d.deviceId} value={d.deviceId} className="bg-[#1A2232]">{d.label}</option>
                              ))
                            )}
                          </select>
                          <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none group-hover:text-white/40" />
                        </div>

                        {/* Camera Preview */}
                        <div className="relative aspect-video bg-black/60 rounded-2xl border-2 border-white/5 overflow-hidden group/cam">
                           {isPreviewingCamera ? (
                             <video ref={previewVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                           ) : (
                             <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                               <Video size={24} className="text-white/5 mb-2" />
                               <span className="text-[8px] font-black uppercase tracking-widest text-white/10">Preview Off</span>
                             </div>
                           )}
                           
                           <button
                             onClick={() => isPreviewingCamera ? stopCameraPreview() : startCameraPreview()}
                             className="absolute bottom-3 left-3 right-3 py-2.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl text-[8px] font-black uppercase tracking-widest text-white/70 hover:text-white hover:bg-black/80 transition-all opacity-0 group-hover/cam:opacity-100"
                           >
                             {isPreviewingCamera ? 'Close Preview' : 'Enable Preview'}
                           </button>
                        </div>
                      </div>

                      {/* Speaker Diagnostics */}
                      <button 
                        onClick={testSpeakers}
                        className="w-full py-4 bg-white/5 hover:bg-white/10 border-2 border-white/5 rounded-2xl flex items-center justify-center gap-3 transition-all group"
                      >
                        <Volume2 size={16} className="text-green-400 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/60 group-hover:text-white">Play Audio Test Chime</span>
                      </button>
                    </motion.div>
                  )}
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
                <h3 className="text-xl md:text-3xl font-bold text-[#FF6619] mb-4 tracking-tight" style={{ fontFamily: "'Comfortaa', sans-serif" }}>
                  Start Your <span className="text-[#22C9E8]">Live Experience</span>
                </h3>
                <p className="text-white max-w-xs md:max-w-md text-xs md:text-sm font-medium leading-relaxed mb-8">
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
