import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatSession, ChatMessage, ServiceCode, Persona, Source, ResearchBundle } from '../types';
import { LABELS, PERSONAS } from '../constants';
import { getChatResponse, getResearchBrief, getGroundedResponse } from '../services/geminiService';
import * as sessionService from '../services/sessionService';
import * as userService from '../services/userService';
import { ClockIcon, MicIcon, SendIcon, SettingsIcon, PlayIcon, StopIcon, CopyIcon, CheckIcon, UserIcon, TrashIcon, LogoutIcon, ErrorIcon, RetryIcon, PaperclipIcon } from './Icons';
import ClauseSwapWizard from './ClauseSwapWizard';
import AuthPrompt from './AuthPrompt';
import ResearchBrief from './ResearchBrief';

// =================================================================================
// TYPE DECLARATIONS
// =================================================================================
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface ChatUIProps {
  onClose: () => void;
  initialSessionId: string | null;
}

// =================================================================================
// HELPER FUNCTIONS
// =================================================================================
const getBestFemaleVoice = (voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => {
    if (!voices || voices.length === 0) return null;
    const rankedVoices = voices
        .filter(v => v.lang.startsWith('en') && v.name.match(/female|woman|girl/i))
        .map(voice => {
            let score = 0;
            if (voice.name.includes('Google')) score += 5;
            if (voice.name.includes('Samantha') || voice.name.includes('Zira') || voice.name.includes('Siri')) score += 10;
            if (!voice.localService) score += 10; // Prioritize cloud-based voices
            if (voice.default) score += 2;
            return { voice, score };
        })
        .sort((a, b) => b.score - a.score);

    return rankedVoices.length > 0 ? rankedVoices[0].voice : (voices.find(v => v.lang.startsWith('en-US')) || null);
};

const highlightMatches = (text: string, searchTerm: string): string => {
    if (!searchTerm.trim()) return text;
    const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedTerm})`, 'gi');
    return text.replace(regex, `<mark>$1</mark>`);
};

const mdToHTML = (s: string) => {
    const escaped = s.replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[m] as string));
    return escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
};

const decodeJwt = (token: string) => {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
        console.error("Failed to decode JWT:", e);
        return null;
    }
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = (reader.result as string).split(',')[1];
            resolve(result);
        };
        reader.onerror = error => reject(error);
    });
};

// =================================================================================
// SUB-COMPONENTS
// =================================================================================

const Sidebar: React.FC<{
    isExpanded: boolean;
    setExpanded: (expanded: boolean) => void;
    sessions: Record<string, ChatSession>;
    sessionOrder: string[];
    currentSessionId: string | null;
    onSessionSelect: (id: string) => void;
    onNewSession: () => void;
}> = ({ isExpanded, setExpanded, sessions, sessionOrder, currentSessionId, onSessionSelect, onNewSession }) => {
    const [searchFilter, setSearchFilter] = useState("");

    const renderSessionList = () => {
        const scoredSessions = sessionOrder
            .map(id => {
                const session = sessions[id];
                if (!session) return null;
                const searchTerm = searchFilter.trim().toLowerCase();
                if (!searchTerm) return { id, score: 1, session, matchSnippet: null };
                let score = 0;
                let matchSnippet: string | null = null;
                if (session.title.toLowerCase().includes(searchTerm)) {
                    score = 10;
                } else {
                    const firstMatch = session.messages.find(m => m.content.toLowerCase().includes(searchTerm));
                    if (firstMatch) {
                        score = 5;
                        const content = firstMatch.content;
                        const index = content.toLowerCase().indexOf(searchTerm);
                        const start = Math.max(0, index - 30);
                        const end = Math.min(content.length, index + searchTerm.length + 30);
                        matchSnippet = (start > 0 ? '…' : '') + content.substring(start, end) + (end < content.length ? '…' : '');
                    }
                }
                return { id, score, session, matchSnippet };
            })
            // FIX: Corrected the type predicate to match the object shape returned by `.map()`.
            .filter((item): item is { id: string; score: number; session: ChatSession; matchSnippet: string | null } => item !== null && item.score > 0)
            .sort((a, b) => b.score - a.score);

        return scoredSessions.map(item => {
            const { id, session, matchSnippet } = item;
            const searchTerm = searchFilter.trim();
            let titleHTML = session.title;
            let snippetHTML: string | null = matchSnippet ? highlightMatches(matchSnippet, searchTerm) : null;
            if (searchTerm && session.title.toLowerCase().includes(searchTerm.toLowerCase())){ titleHTML = highlightMatches(session.title, searchTerm); }
            
            const lastMessage = session.messages[session.messages.length - 1];
            const lastMessageSnippet = lastMessage ? (lastMessage.role === 'user' ? 'You: ' : '') + lastMessage.content.substring(0, 30) + (lastMessage.content.length > 30 ? '…' : '') : 'No messages yet';
            const lastMessageTime = lastMessage ? new Date(lastMessage.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            
            return (
              <button key={id} onClick={() => onSessionSelect(id)} title={session.title} className={`w-full text-left p-2 rounded-md transition-colors ${id === currentSessionId ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                    <div className="text-sm truncate font-medium" dangerouslySetInnerHTML={{ __html: titleHTML }}/>
                    {searchFilter ? 
                        ( snippetHTML && <div className="text-[11px] text-gray-400 mt-1 truncate" dangerouslySetInnerHTML={{ __html: `...${snippetHTML}...` }} /> ) 
                        : (
                            <div className="flex items-baseline justify-between mt-1">
                                <div className="text-xs text-gray-400 truncate pr-2">{lastMessageSnippet}</div>
                                <div className="text-[10px] text-gray-500 flex-shrink-0">{lastMessageTime}</div>
                            </div>
                        )
                    }
              </button>
            )
        });
    };

    return (
        <aside className="sidebar glass h-full px-3 py-3 flex flex-col border-r border-white/10">
            <div className="flex-shrink-0 flex flex-col gap-2">
                <button onClick={onNewSession} className="w-full text-left flex items-center gap-2 p-2 rounded-md transition-colors hover:bg-white/5 bg-white/5 border border-white/10">
                    <span className="text-lg">+</span> <span>New chat</span>
                </button>
                <div className="relative">
                    <input value={searchFilter} onChange={e => setSearchFilter(e.target.value)} className={`w-full bg-white/5 border border-white/10 rounded-md p-2 placeholder-gray-400 outline-none text-sm focus:border-purple-400`} placeholder="Search all chats..."/>
                </div>
            </div>
            <div className={`mt-3 text-xs uppercase tracking-widest text-gray-500 px-1`}>History</div>
            <div className="mt-2 space-y-1 overflow-y-auto flex-1 pr-1">
                {renderSessionList()}
            </div>
        </aside>
    );
};

const ChatHeader: React.FC<{
    authStatus: userService.AuthStatus;
    userName: string | null;
    onClose: () => void;
    onPersonaChange: (persona: Persona) => void;
    onLogout: () => void;
    onClearHistory: () => void;
    onToggleSidebar: () => void;
}> = ({ authStatus, userName, onClose, onPersonaChange, onLogout, onClearHistory, onToggleSidebar }) => {
    const [isPopoverVisible, setPopoverVisible] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

     useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setPopoverVisible(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="glass px-4 py-3 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3">
                 <button onClick={onToggleSidebar} className="icon-btn md:hidden" title="Toggle Sidebar">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <img src="https://res.cloudinary.com/da7ivvsdj/image/upload/v1762264232/lgo_kzhywq.png" alt="AIDLEX.AE Logo" className="size-7" />
                <div>
                    <div className="text-sm font-semibold">AIDLEX Assistant</div>
                    <div className="text-xs text-gray-400">UAE‑centric • AR/EN</div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {authStatus === 'authenticated' && userName && (
                    <div className="hidden sm:flex items-center gap-2 pill px-3 py-1.5 text-sm">
                        <UserIcon/>
                        <span>{userName}</span>
                    </div>
                )}
                
                <div ref={popoverRef} className="relative">
                    <button onClick={() => setPopoverVisible(v => !v)} className="icon-btn" title="Settings & Actions"><SettingsIcon /></button>
                    {isPopoverVisible && (
                        <div className="absolute top-full right-0 mt-2 w-56 bg-gray-900/90 border border-white/20 rounded-lg shadow-xl p-2 z-10 backdrop-blur-sm">
                           
                            <div className="px-3 pt-1 pb-2 text-xs text-gray-400">Account Actions</div>
                            <button onClick={() => { onClearHistory(); setPopoverVisible(false); }} className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-red-500/20 text-red-400 flex items-center gap-2">
                                <TrashIcon /> Clear All History
                            </button>
                            {authStatus === 'authenticated' && (
                                <button onClick={() => { onLogout(); setPopoverVisible(false); }} className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-white/10 flex items-center gap-2">
                                    <LogoutIcon /> Logout
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <button onClick={onClose} className="pill px-3 py-2 text-sm">Close</button>
            </div>
        </div>
    );
};

const MessageStream: React.FC<{
    messages: ChatMessage[];
    isThinking: boolean;
    userName: string | null;
    onFinalizeWizard: (ts: number, content: string) => void;
    onGuestSubmit: (contactInfo: { email: string; mobile: string; }) => void;
    onGoogleSignInSuccess: (response: any) => void;
    onSpeak: (content: string, ts: number) => void;
    speakingMessageTs: number | null;
    onCopy: (content: string, ts: number) => void;
    copiedMessageTs: number | null;
    onSuggestedReply: (reply: string) => void;
    onRetry: (prompt: string) => void;
}> = (props) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current) {
            // More reliable scrolling by directly manipulating scroll position
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [props.messages, props.isThinking]);

    const lastMessage = props.messages[props.messages.length - 1];

    return (
        <div ref={containerRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-4">
            {props.messages.map((msg) => {
              if (msg.messageType === 'wizard') {
                return <ClauseSwapWizard key={msg.ts} templateContent={msg.content} onFinalize={(finalContent) => props.onFinalizeWizard(msg.ts, finalContent)} />;
              }
              if (msg.messageType === 'auth_prompt') {
                  return <AuthPrompt key={msg.ts} userName={props.userName || ''} onGoogleSignInSuccess={props.onGoogleSignInSuccess} onGuestSubmit={props.onGuestSubmit} />;
              }
              if (msg.messageType === 'research_brief' && msg.researchData) {
                  return <ResearchBrief key={msg.ts} data={msg.researchData} />;
              }
              return (
                <div key={msg.ts} className={`flex flex-col msg-animated ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-3 py-2 rounded-xl border text-[0.95rem] leading-6 msg ${msg.role === 'user' ? 'msg-user' : 'msg-bot'} ${msg.error ? 'msg-error' : ''}`}>
                        {msg.error && (
                            <div className="flex items-center gap-2 text-red-400 font-semibold text-sm mb-1">
                                <ErrorIcon />
                                <span>Request Failed</span>
                            </div>
                        )}
                        <div dangerouslySetInnerHTML={{ __html: mdToHTML(msg.content) }} />
                        {msg.fileData && (
                            <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-2 text-xs text-gray-400">
                                <PaperclipIcon /> <span>Attached: {msg.fileData.name}</span>
                            </div>
                        )}
                        {msg.sources && msg.sources.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-white/10">
                                <h4 className="text-xs font-semibold text-gray-300 mb-1">Sources:</h4>
                                <ol className="list-decimal list-inside space-y-1 text-xs">
                                    {msg.sources.map((source, idx) => (
                                        <li key={idx}>
                                            <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">{source.title}</a>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                        {msg.role === 'model' && msg.messageType === 'standard' && !msg.error && (
                            <>
                               <button onClick={() => props.onSpeak(msg.content, msg.ts)} className="icon-btn !size-7" title="Read aloud">
                                 {props.speakingMessageTs === msg.ts ? <StopIcon/> : <PlayIcon/>}
                               </button>
                               <button onClick={() => props.onCopy(msg.content, msg.ts)} className="icon-btn !size-7" title="Copy text">
                                  {props.copiedMessageTs === msg.ts ? <CheckIcon/> : <CopyIcon/>}
                               </button>
                            </>
                        )}
                        {msg.error && msg.promptForRetry && (
                            <button onClick={() => props.onRetry(msg.promptForRetry!)} className="icon-btn !size-7 text-red-400 border-red-500/50 hover:bg-red-500/20" title="Retry">
                                <RetryIcon />
                            </button>
                        )}
                    </div>
                </div>
              );
            })}
            {props.isThinking && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-xl border msg-bot"><span className="thinking"><span></span><span></span><span></span></span></div>
              </div>
            )}
            
            {lastMessage?.role === 'model' && lastMessage.suggestedReplies && lastMessage.suggestedReplies.length > 0 && !props.isThinking && (
                <div className="flex justify-start">
                    <div className="flex flex-wrap gap-2 pt-2">
                        {lastMessage.suggestedReplies.map((reply, index) => (
                            <button key={index} onClick={() => props.onSuggestedReply(reply)} className="btn btn-ghost !text-sm !py-1.5 !px-3">{reply}</button>
                        ))}
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>
    );
};

const Composer: React.FC<{
    value: string;
    onValueChange: (value: string) => void;
    onSend: () => void;
    isThinking: boolean;
    isMicRecording: boolean;
    onMicClick: () => void;
    micDisabled: boolean;
    attachedFile: File | null;
    onFileAttach: (file: File) => void;
    onFileRemove: () => void;
}> = ({ value, onValueChange, onSend, isThinking, isMicRecording, onMicClick, micDisabled, attachedFile, onFileAttach, onFileRemove }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        textareaRef.current?.focus();
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    };
    
    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onValueChange(e.target.value);
        const target = e.target as HTMLTextAreaElement;
        setTimeout(() => {
            target.style.height = "auto";
            target.style.height = Math.min(target.scrollHeight, 180) + "px";
        }, 0);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onFileAttach(e.target.files[0]);
        }
    };

    return (
        <div className="px-4 md:px-8 py-4">
            {attachedFile && (
                <div className="mb-2 flex items-center justify-between text-sm pill px-3 py-1.5">
                    <div className="flex items-center gap-2 truncate">
                        <PaperclipIcon />
                        <span className="truncate">{attachedFile.name}</span>
                    </div>
                    <button onClick={onFileRemove} className="text-gray-400 hover:text-white text-lg leading-none">&times;</button>
                </div>
            )}
            <div className="composer rounded-xl px-3 py-2 flex items-end gap-2">
                 <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,.txt,.docx" />
                <button onClick={() => fileInputRef.current?.click()} className="icon-btn mb-1" title="Attach document"><PaperclipIcon /></button>
                <textarea
                    ref={textareaRef}
                    rows={1}
                    className="flex-1 bg-transparent outline-none resize-none text-[0.95rem] leading-6 max-h-44 placeholder-gray-400"
                    placeholder="Type a message, or attach a document..."
                    value={value}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                />
                <div className="flex items-center gap-2 pb-1">
                    <button onClick={onMicClick} className={`icon-btn ${isMicRecording ? 'mic-recording' : ''}`} title="Voice to text" disabled={micDisabled}><MicIcon /></button>
                    <button onClick={onSend} className="icon-btn bg-white text-black hover:bg-white" title="Send" disabled={isThinking || (!value.trim() && !attachedFile)}><SendIcon /></button>
                </div>
            </div>
            <div className="mt-2 text-[11px] text-gray-500">Press Enter to send • Shift+Enter for new line</div>
        </div>
    );
};

// =================================================================================
// MAIN COMPONENT
// =================================================================================

const ChatUI: React.FC<ChatUIProps> = ({ onClose, initialSessionId }) => {
  const [sessions, setSessions] = useState<Record<string, ChatSession>>(sessionService.loadSessions());
  const [sessionOrder, setSessionOrder] = useState<string[]>(sessionService.loadOrder());
  const [currentSessionId, setCurrentIdState] = useState<string | null>(initialSessionId);
  const [composerValue, setComposerValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [isMicRecording, setMicRecording] = useState(false);
  const [speakingMessageTs, setSpeakingMessageTs] = useState<number | null>(null);
  const [copiedMessageTs, setCopiedMessageTs] = useState<number | null>(null);
  const [userName, setUserName] = useState<string | null>(userService.getUserName());
  const [authStatus, setAuthStatus] = useState<userService.AuthStatus>(userService.getAuthStatus());
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  
  const speechRecognitionRef = useRef<any>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const composerValueRef = useRef(composerValue);
  useEffect(() => {
    composerValueRef.current = composerValue;
  }, [composerValue]);

  const currentSession = currentSessionId ? sessions[currentSessionId] : null;
  
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
        if (event.key === 'aidlex_chats' || event.key === 'aidlex_chat_order') {
            setSessions(sessionService.loadSessions());
            setSessionOrder(sessionService.loadOrder());
        }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    // --- Speech Synthesis Voice Loading ---
    const loadVoices = () => { voicesRef.current = window.speechSynthesis.getVoices(); };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    // --- Speech Recognition Setup ---
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        console.warn("Speech recognition not supported by this browser.");
        return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    let final_transcript = '';

    recognition.onstart = () => {
        final_transcript = composerValueRef.current;
    };
    recognition.onresult = (event: any) => {
        let interim_transcript = '';
        let current_final = final_transcript;
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                current_final += event.results[i][0].transcript;
            } else {
                interim_transcript += event.results[i][0].transcript;
            }
        }
        setComposerValue(current_final + interim_transcript);
    };
    
    recognition.onend = () => {
        setMicRecording(false);
        final_transcript = '';
    };
    recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setMicRecording(false);
    }
    speechRecognitionRef.current = recognition;
    
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
    };
  }, []);
  
  const updateSessionState = (session: ChatSession) => {
    const newSessions = sessionService.saveSessionsAndReturn(session);
    setSessions(newSessions);
    setSessionOrder(sessionService.loadOrder());
  };

  const handleCreateNewSession = () => {
    const newSession = sessionService.createNewSession();
    setSessions(sessionService.loadSessions());
    setSessionOrder(sessionService.loadOrder());
    setCurrentIdState(newSession.id);
  };
  
  const handleSessionSelect = (id: string) => {
    setCurrentIdState(id);
    sessionService.setCurrentSessionId(id);
    if(window.innerWidth <= 768) setSidebarOpen(false);
  };
  
  const handlePersonaChange = (persona: Persona) => {
    if (!currentSessionId) return;
    const newSessions = { ...sessions };
    const session = newSessions[currentSessionId];
    if (session) {
        session.meta.persona = persona;
        setSessions(newSessions);
        sessionService.saveSessions(newSessions);
    }
  };

  const handleSendMessage = useCallback(async (messageText?: string, isRetry = false) => {
    const messageToSend = (messageText || composerValue).trim();
    if ((!messageToSend && !attachedFile) || !currentSessionId) return;

    const fileData = attachedFile ? { name: attachedFile.name, type: attachedFile.type } : undefined;

    if (!isRetry) {
        setComposerValue('');
        setAttachedFile(null);
        const userMsg = sessionService.addMessageToSession(currentSessionId, { role: 'user', content: messageToSend, fileData });
        if (userMsg) updateSessionState(userMsg);
    }
    
    setIsThinking(true);
    
    if (isRetry && currentSessionId) {
        const currentSessions = sessionService.loadSessions();
        const session = currentSessions[currentSessionId];
        if (session) {
            session.messages = session.messages.filter(m => !(m.error && m.promptForRetry === messageToSend));
            updateSessionState(session);
        }
    }

    try {
        const session = sessions[currentSessionId];
        if (!session) { setIsThinking(false); return; }

        if (session.meta.needsOnboarding) {
            const name = messageToSend;
            userService.setUserName(name);
            setUserName(name);

            sessionService.addMessageToSession(currentSessionId, { role: 'model', content: `Thank you, ${name}! It's a pleasure to meet you.` });
            const authPromptMsg = sessionService.addMessageToSession(currentSessionId, { role: 'model', content: 'Auth Prompt', messageType: 'auth_prompt' });

            if (authPromptMsg) {
                authPromptMsg.meta.needsOnboarding = false;
                updateSessionState(authPromptMsg);
            }
            return;
        }
        
        const serviceCode = session.meta.code;
        const history = session.messages.filter(m => m.messageType !== 'wizard' && m.messageType !== 'auth_prompt' && !m.error) || [];
        
        if (serviceCode === 'research') {
            const researchData = await getResearchBrief(messageToSend);
            const botMsg = sessionService.addMessageToSession(currentSessionId, { role: 'model', content: 'Research Brief', messageType: 'research_brief', researchData });
            if(botMsg) updateSessionState(botMsg);
        } else if (serviceCode === 'research-web') {
            const { text: botResponse, sources, suggestedReplies } = await getGroundedResponse(history, messageToSend);
            const botMsg = sessionService.addMessageToSession(currentSessionId, { role: 'model', content: botResponse, sources, suggestedReplies });
            if(botMsg) updateSessionState(botMsg);
        } else {
            const fileForApi = attachedFile ? { name: attachedFile.name, type: attachedFile.type, content: await fileToBase64(attachedFile) } : undefined;
            const persona = session.meta.persona || 'default';
            const serviceName = serviceCode ? LABELS[serviceCode as ServiceCode] : 'general legal matters';
            const personaInstruction = PERSONAS[persona].instruction;
            const currentUserName = userService.getUserName();
            const systemInstruction = `${personaInstruction} The user's name is ${currentUserName || 'not provided'}. The user is currently interested in the area of: ${serviceName}.`;
            
            const { text: botResponse, messageType, suggestedReplies } = await getChatResponse(history, systemInstruction, messageToSend, fileForApi);
            
            const botMsg = sessionService.addMessageToSession(currentSessionId, { role: 'model', content: botResponse, messageType, suggestedReplies });
            if(botMsg) updateSessionState(botMsg);
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        const errorMsg = sessionService.addMessageToSession(currentSessionId, {
            role: 'model',
            content: errorMessage,
            error: true,
            promptForRetry: messageToSend
        });
        if(errorMsg) updateSessionState(errorMsg);
    } finally {
        setIsThinking(false);
    }
  }, [composerValue, currentSessionId, sessions, attachedFile]);
  
  const handleRetryMessage = (prompt: string) => {
    if (!currentSessionId) return;
    handleSendMessage(prompt, true);
  };

  const finalizeAuthentication = (status: 'authenticated' | 'guest', newName?: string) => {
      if (!currentSessionId) return;
      const currentSessions = sessionService.loadSessions();
      const session = currentSessions[currentSessionId];
      if (session) {
          session.messages = session.messages.filter(m => m.messageType !== 'auth_prompt');
          const confirmationText = status === 'authenticated' 
              ? `Great, ${newName}! You're all signed in. Your chats will now be saved to your profile.` 
              : "Okay, you're continuing as a guest. Your chat history will be saved on this browser only.";
          sessionService.addMessageToSession(currentSessionId, { role: 'model', content: confirmationText });
          const finalMsg = sessionService.addMessageToSession(currentSessionId, { role: 'model', content: `How can I help you today?` });
          if (finalMsg) updateSessionState(finalMsg);
      }
  };
  
  const handleGoogleSignInSuccess = (credentialResponse: any) => {
    const decoded = decodeJwt(credentialResponse.credential);
    if (decoded && decoded.name) {
        const newName = decoded.name;
        userService.setUserName(newName);
        userService.setAuthStatus('authenticated');
        setUserName(newName);
        setAuthStatus('authenticated');
        finalizeAuthentication('authenticated', newName);
    } else {
        console.error("Could not extract user name from Google credential.");
        const guestName = userName || 'Guest';
        userService.setAuthStatus('guest');
        setAuthStatus('guest');
        finalizeAuthentication('guest', guestName);
    }
  };

  const handleGuestSubmit = (contactInfo: { email: string; mobile: string; }) => {
    userService.setUserContactInfo(contactInfo.email, contactInfo.mobile);
    userService.setAuthStatus('guest');
    setAuthStatus('guest');
    finalizeAuthentication('guest', userName || 'Guest');
  };

  const handleFinalizeWizard = (messageTs: number, finalizedContent: string) => {
    if (!currentSessionId) return;
    setSessions(prev => {
        const newSessions = { ...prev };
        const session = newSessions[currentSessionId];
        if (session) {
            const messageIndex = session.messages.findIndex(m => m.ts === messageTs);
            if (messageIndex !== -1) {
                session.messages[messageIndex].content = finalizedContent;
                // FIX: Corrected a typo from `message - index` to `messageIndex`.
                session.messages[messageIndex].messageType = 'standard';
            }
        }
        sessionService.saveSessions(newSessions);
        return newSessions;
    });
  };

  const handleMicClick = () => {
    if (speechRecognitionRef.current) {
        if (isMicRecording) {
            speechRecognitionRef.current.stop();
        } else {
            speechRecognitionRef.current.start();
        }
        setMicRecording(!isMicRecording);
    }
  };

  const handleSpeakMessage = (content: string, ts: number) => {
    if (!("speechSynthesis" in window)) return;
    if (speakingMessageTs === ts) {
        window.speechSynthesis.cancel();
        setSpeakingMessageTs(null);
        return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content.replace(/\*\*/g, ""));
    utterance.voice = getBestFemaleVoice(voicesRef.current);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeakingMessageTs(null);
    setSpeakingMessageTs(ts);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopyMessage = (content: string, ts: number) => {
    navigator.clipboard.writeText(content).then(() => {
        setCopiedMessageTs(ts);
        setTimeout(() => setCopiedMessageTs(null), 2000);
    });
  };

  const handleClearHistory = () => {
      if (window.confirm("Are you sure you want to delete all chat history? This action cannot be undone.")) {
          sessionService.clearAllSessions();
          handleCreateNewSession();
      }
  };

  const handleLogout = () => {
      userService.logoutUser();
      setUserName(null);
      setAuthStatus('guest');
      handleCreateNewSession(); 
  };

  return (
    <section className="fixed inset-0 z-30">
      <div className={`chat-wrap h-full ${isSidebarOpen ? 'sidebar-open' : ''}`}>
        {isSidebarOpen && <div className="sidebar-backdrop md:hidden" onClick={() => setSidebarOpen(false)}></div>}
        <Sidebar
            isExpanded={true}
            setExpanded={() => {}}
            sessions={sessions}
            sessionOrder={sessionOrder}
            currentSessionId={currentSessionId}
            onSessionSelect={handleSessionSelect}
            onNewSession={handleCreateNewSession}
        />

        <div className="flex flex-col h-full bg-black/20">
          <ChatHeader
            authStatus={authStatus}
            userName={userName}
            onClose={onClose}
            onPersonaChange={handlePersonaChange}
            onLogout={handleLogout}
            onClearHistory={handleClearHistory}
            onToggleSidebar={() => setSidebarOpen(v => !v)}
          />
          {currentSession && (
              <MessageStream
                  messages={currentSession.messages}
                  isThinking={isThinking}
                  userName={userName}
                  onFinalizeWizard={handleFinalizeWizard}
                  onGuestSubmit={handleGuestSubmit}
                  onGoogleSignInSuccess={handleGoogleSignInSuccess}
                  onSpeak={handleSpeakMessage}
                  speakingMessageTs={speakingMessageTs}
                  onCopy={handleCopyMessage}
                  copiedMessageTs={copiedMessageTs}
                  onSuggestedReply={(reply) => handleSendMessage(reply)}
                  onRetry={handleRetryMessage}
              />
          )}
          <Composer
            value={composerValue}
            onValueChange={setComposerValue}
            onSend={() => handleSendMessage()}
            isThinking={isThinking}
            isMicRecording={isMicRecording}
            onMicClick={handleMicClick}
            micDisabled={!speechRecognitionRef.current}
            attachedFile={attachedFile}
            onFileAttach={setAttachedFile}
            onFileRemove={() => setAttachedFile(null)}
          />
        </div>
      </div>
    </section>
  );
};

export default ChatUI;