import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChatSession, ChatMessage, ServiceCode, Persona, Source, ResearchBundle, MessageType } from '../types';
import { LABELS, PERSONAS } from '../constants';
import { getChatResponse, getResearchBrief, getGroundedResponse, getTextToSpeech } from '../services/geminiService';
import * as sessionService from '../services/sessionService';
import * as userService from '../services/userService';
import { ClockIcon, MicIcon, SendIcon, SettingsIcon, PlayIcon, StopIcon, CopyIcon, CheckIcon, UserIcon, TrashIcon, LogoutIcon, ErrorIcon, RetryIcon, PaperclipIcon, LoadingIcon } from './Icons';
import ClauseSwapWizard from './ClauseSwapWizard';
import AuthPrompt from './AuthPrompt';
import ResearchBrief from './ResearchBrief';
import WaveformVisualizer from './WaveformVisualizer';

// =================================================================================
// TYPE DECLARATIONS
// =================================================================================
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    webkitAudioContext: typeof AudioContext;
  }
}

interface ChatUIProps {
  onClose: () => void;
  initialSessionId: string | null;
}

// =================================================================================
// HELPER FUNCTIONS
// =================================================================================
const decodeB64 = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
): Promise<AudioBuffer> {
  // Raw PCM data from Gemini TTS is 24000Hz, 1 channel
  const sampleRate = 24000;
  const numChannels = 1;
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}

const highlightMatches = (text: string, searchTerm: string): string => {
    if (!searchTerm.trim()) return text;
    const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedTerm})`, 'gi');
    return text.replace(regex, `<mark>$1</mark>`);
};

const mdToHTML = (s: string) => {
    const escaped = s.replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[m] as string));
    // Added newline to <br> conversion for better readability and formatting.
    return escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br />");
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

const checkPlaceholders = (text: string): MessageType => {
  const placeholders = text.match(/\<\<([^\>]+)\>\>/g);
  return (placeholders && placeholders.length > 0) ? 'wizard' : 'standard';
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
        <aside id="chat-sidebar" role="complementary" aria-label="Chat History" className="sidebar glass h-full px-3 py-3 flex flex-col border-r border-white/10">
            <div className="flex-shrink-0 flex flex-col gap-2">
                <button onClick={onNewSession} className="w-full text-left flex items-center gap-2 p-2 rounded-md transition-colors hover:bg-white/5 bg-white/5 border border-white/10">
                    <span className="text-lg" aria-hidden="true">+</span> <span>New chat</span>
                </button>
                <div className="relative">
                    <label htmlFor="chat-search" className="sr-only">Search all chats</label>
                    <input id="chat-search" value={searchFilter} onChange={e => setSearchFilter(e.target.value)} className={`w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-md p-2 placeholder-gray-400 outline-none text-sm focus:border-purple-400 transition-colors`} placeholder="Search all chats..."/>
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
    currentPersona: Persona;
    onPersonaChange: (persona: Persona) => void;
    onLogout: () => void;
    onClearHistory: () => void;
    onToggleSidebar: () => void;
    isSidebarOpen: boolean;
}> = ({ authStatus, userName, onClose, currentPersona, onPersonaChange, onLogout, onClearHistory, onToggleSidebar, isSidebarOpen }) => {
    const [isPopoverVisible, setPopoverVisible] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const settingsButtonRef = useRef<HTMLButtonElement>(null);

     useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node) && !settingsButtonRef.current?.contains(event.target as Node)) {
                setPopoverVisible(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setPopoverVisible(false);
            settingsButtonRef.current?.focus();
        }
    };

    return (
        <header role="banner" className="glass px-4 py-3 flex items-center justify-between border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-3">
                 <button onClick={onToggleSidebar} className="icon-btn md:hidden" aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"} aria-expanded={isSidebarOpen} aria-controls="chat-sidebar">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <img src="https://res.cloudinary.com/da7ivvsdj/image/upload/v1762264232/lgo_kzhywq.png" alt="AIDLEX.AE Logo" className="size-7" />
                <div>
                    <h1 className="text-sm font-semibold">AIDLEX Assistant</h1>
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
                
                <div className="relative">
                    <button 
                        ref={settingsButtonRef} 
                        onClick={() => setPopoverVisible(!isPopoverVisible)} 
                        className="icon-btn" 
                        aria-label="Settings and options"
                        aria-haspopup="true"
                        aria-expanded={isPopoverVisible}
                    >
                        <SettingsIcon />
                    </button>

                    {isPopoverVisible && (
                        <div
                            ref={popoverRef}
                            className="absolute top-full right-0 mt-2 w-64 glass rounded-lg shadow-2xl z-10 p-2"
                            role="menu"
                            aria-orientation="vertical"
                            aria-labelledby="settings-menu-button"
                            onKeyDown={handleKeyDown}
                        >
                            <div role="group" aria-labelledby="persona-group-label">
                                <div id="persona-group-label" className="px-2 py-1 text-xs text-gray-400">Assistant Persona</div>
                                {Object.entries(PERSONAS).map(([key, persona]) => (
                                    <button
                                        key={key}
                                        onClick={() => { onPersonaChange(key as Persona); setPopoverVisible(false); }}
                                        className={`w-full text-left text-sm px-2 py-1.5 rounded-md flex items-center gap-2 ${currentPersona === key ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                        role="menuitemradio"
                                        aria-checked={currentPersona === key}
                                    >
                                        <span className={`w-2 h-2 rounded-full ${currentPersona === key ? 'bg-purple-400' : 'bg-gray-500'}`} aria-hidden="true"></span>
                                        {persona.name}
                                    </button>
                                ))}
                            </div>
                            <div className="border-t border-white/10 my-2" role="separator"></div>
                             {authStatus === 'authenticated' && (
                                <button
                                    onClick={() => { onLogout(); setPopoverVisible(false); }}
                                    className="w-full text-left text-sm px-2 py-1.5 rounded-md hover:bg-white/5 flex items-center gap-2"
                                    role="menuitem"
                                >
                                    <LogoutIcon /> Sign Out
                                </button>
                            )}
                            <button
                                onClick={() => { 
                                    if(confirm('Are you sure you want to delete all chat history? This cannot be undone.')) {
                                        onClearHistory(); 
                                        setPopoverVisible(false);
                                    }
                                }}
                                className="w-full text-left text-sm px-2 py-1.5 rounded-md hover:bg-red-500/20 text-red-400 flex items-center gap-2"
                                role="menuitem"
                            >
                                <TrashIcon /> Clear All History
                            </button>
                        </div>
                    )}
                </div>

                <button onClick={onClose} className="icon-btn" aria-label="Close chat interface">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        </header>
    );
};

const MessageStream: React.FC<{
    messages: ChatMessage[];
    isStreaming: boolean;
    onRetry: (prompt: string, fileData?: ChatMessage['fileData']) => void;
    onFinalizeWizard: (finalizedContent: string) => void;
    onAuthPromptSubmit: (data: any) => void;
    onPlayAudio: (text: string, index: number) => void;
    speakingMessageIndex: number | null;
    audioLoadingState: Map<number, boolean>;
}> = ({ messages, isStreaming, onRetry, onFinalizeWizard, onAuthPromptSubmit, onPlayAudio, speakingMessageIndex, audioLoadingState }) => {
    const streamEndRef = useRef<HTMLDivElement>(null);
    const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);

    useEffect(() => {
        streamEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isStreaming]);

    const handleCopyMessage = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedMessageIndex(index);
        setTimeout(() => setCopiedMessageIndex(null), 2000);
    };

    const renderMessageContent = (msg: ChatMessage) => {
        switch (msg.messageType) {
            case 'wizard':
                return <ClauseSwapWizard templateContent={msg.content} onFinalize={onFinalizeWizard} />;
            case 'auth_prompt':
                return <AuthPrompt userName={userService.getUserName() || "Guest"} onGoogleSignInSuccess={onAuthPromptSubmit} onGuestSubmit={onAuthPromptSubmit} />;
            case 'research_brief':
                return msg.researchData ? <ResearchBrief data={msg.researchData} /> : <p>Invalid research data.</p>;
            default:
                return (
                    <div 
                      className={`px-3.5 py-2.5 rounded-xl border text-[0.95rem] leading-6 msg ${msg.role === 'user' ? 'msg-user' : msg.error ? 'msg-error' : 'msg-bot'}`} 
                      dangerouslySetInnerHTML={{ __html: mdToHTML(msg.content) }}
                    />
                );
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-6" role="log" aria-live="polite">
            {messages.map((msg, i) => (
                <div key={i} className={`flex items-start gap-3 msg-animated ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'model' && <img src="https://res.cloudinary.com/da7ivvsdj/image/upload/v1762264232/lgo_kzhywq.png" alt="AIDLEX.AE Logo" className="size-7 rounded-full flex-shrink-0" />}
                    
                    <div className={`flex flex-col w-full ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        {renderMessageContent(msg)}

                        {msg.sources && msg.sources.length > 0 && (
                            <div className="mt-2 text-xs w-full max-w-2xl">
                               <h4 className="font-semibold mb-1">Sources:</h4>
                               <ul className="space-y-1">
                                  {msg.sources.map((source, idx) => (
                                    <li key={idx} className="flex items-center gap-2">
                                        <span className="pill text-gray-300 rounded-full size-5 text-[10px] grid place-items-center flex-shrink-0">{idx + 1}</span>
                                        <a href={source.uri} target="_blank" rel="noopener noreferrer" className="cite-link truncate">{source.title || source.uri}</a>
                                    </li>
                                  ))}
                               </ul>
                            </div>
                        )}
                        
                        {!isStreaming && msg.role === 'model' && msg.messageType === 'standard' && (
                            <div className="flex items-center gap-1 mt-2">
                                <button onClick={() => handleCopyMessage(msg.content, i)} className="icon-btn !size-7 !rounded-md" aria-label={copiedMessageIndex === i ? 'Copied' : 'Copy message'}>
                                    {copiedMessageIndex === i ? <CheckIcon /> : <CopyIcon />}
                                </button>
                                <button 
                                    onClick={() => onPlayAudio(msg.content, i)} 
                                    className="icon-btn !size-7 !rounded-md" 
                                    aria-label={speakingMessageIndex === i ? 'Stop reading aloud' : 'Read message aloud'}
                                    disabled={audioLoadingState.get(i)}
                                >
                                    {speakingMessageIndex === i 
                                        ? <StopIcon /> 
                                        : (audioLoadingState.get(i) 
                                            ? <LoadingIcon /> 
                                            : <PlayIcon />)
                                    }
                                </button>
                                {msg.error && msg.promptForRetry && (
                                     <button onClick={() => onRetry(msg.promptForRetry!, msg.fileData)} className="icon-btn !size-7 !rounded-md text-red-400" aria-label="Retry generating response">
                                         <RetryIcon />
                                     </button>
                                )}
                            </div>
                        )}
                        {msg.suggestedReplies && msg.suggestedReplies.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2" aria-label="Suggested replies">
                                {msg.suggestedReplies.map((reply, idx) => (
                                    <button key={idx} className="pill px-3 py-1.5 text-sm hover:bg-white/15">
                                        {reply}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {msg.role === 'user' && <div className="size-7 rounded-full flex-shrink-0 bg-white/10 grid place-items-center"><UserIcon/></div>}
                </div>
            ))}
            {isStreaming && (
                <div className="flex items-start gap-3 justify-start">
                    <img src="https://res.cloudinary.com/da7ivvsdj/image/upload/v1762264232/lgo_kzhywq.png" alt="AIDLEX.AE Logo" className="size-7 rounded-full" />
                    <div className="px-4 py-2.5 rounded-xl msg-bot">
                        <div className="thinking"><span></span><span></span><span></span></div>
                    </div>
                </div>
            )}
            <div ref={streamEndRef} />
        </div>
    );
};

const Composer: React.FC<{
    isStreaming: boolean;
    onSendMessage: (prompt: string, file?: { name: string; type: string; content: string }) => void;
}> = ({ isStreaming, onSendMessage }) => {
    const [input, setInput] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const recognitionRef = useRef<any>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [attachedFile, setAttachedFile] = useState<{ name: string; type: string; content: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.onresult = (event: any) => {
                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        setInput(prev => prev + event.results[i][0].transcript);
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
            };
        }
    }, []);

    const handleMicToggle = () => {
        if (isRecording) {
            recognitionRef.current?.stop();
            setIsRecording(false);
        } else {
            recognitionRef.current?.start();
            setIsRecording(true);
        }
    };

    const handleSend = () => {
        const trimmedInput = input.trim();
        if (trimmedInput || attachedFile) {
            onSendMessage(trimmedInput, attachedFile || undefined);
            setInput("");
            setAttachedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };
    
    const adjustTextareaHeight = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    };

    useEffect(adjustTextareaHeight, [input]);

    const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const base64Content = await fileToBase64(file);
            setAttachedFile({ name: file.name, type: file.type, content: base64Content });
        }
    };
    
    return (
        <div role="form" aria-label="Chat message composer" className="px-4 py-3 border-t border-white/10">
            <div className="composer rounded-xl p-2 flex items-end gap-2">
                <button className={`icon-btn flex-shrink-0 ${isRecording ? 'mic-recording' : ''}`} onClick={handleMicToggle} disabled={!recognitionRef.current} aria-label={isRecording ? 'Stop voice input' : 'Start voice input'}>
                    <MicIcon />
                </button>
                <button className="icon-btn flex-shrink-0" onClick={() => fileInputRef.current?.click()} aria-label="Attach file">
                    <PaperclipIcon />
                    <input type="file" ref={fileInputRef} onChange={handleFileAttach} className="hidden" accept="image/*,application/pdf,.txt,.md" />
                </button>
                <div className="flex flex-col flex-1">
                    {attachedFile && (
                         <div className="text-xs text-purple-300 ml-1.5 mb-1 flex items-center gap-1.5">
                            <span>{attachedFile.name}</span>
                            <button onClick={() => setAttachedFile(null)} className="text-red-400" aria-label={`Remove attached file ${attachedFile.name}`}>&times;</button>
                        </div>
                    )}
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type your message..."
                        className="w-full bg-transparent p-1.5 text-base resize-none outline-none max-h-40"
                        rows={1}
                        aria-label="Message input field"
                    />
                </div>
                <button className="icon-btn flex-shrink-0 !bg-purple-600 !border-purple-500 hover:!bg-purple-500 disabled:!bg-gray-500" onClick={handleSend} disabled={isStreaming || (!input.trim() && !attachedFile)} aria-label="Send message">
                    <SendIcon />
                </button>
            </div>
        </div>
    );
};


// =================================================================================
// MAIN CHAT UI COMPONENT
// =================================================================================

const ChatUI: React.FC<ChatUIProps> = ({ onClose, initialSessionId }) => {
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(initialSessionId);
    const [sessions, setSessions] = useState<Record<string, ChatSession>>(sessionService.loadSessions());
    const [sessionOrder, setSessionOrder] = useState<string[]>(sessionService.loadOrder());
    const [isStreaming, setIsStreaming] = useState(false);
    const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
    
    // Auth related state
    const [authStatus, setAuthStatus] = useState<userService.AuthStatus>(userService.getAuthStatus());
    const [userName, setUserName] = useState<string | null>(userService.getUserName());
    
    // Audio related state
    const [audioCache, setAudioCache] = useState(new Map<number, string>());
    const [audioLoadingState, setAudioLoadingState] = useState(new Map<number, boolean>());
    const [speakingMessageIndex, setSpeakingMessageIndex] = useState<number | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

    const currentSession = useMemo(() => currentSessionId ? sessions[currentSessionId] : null, [currentSessionId, sessions]);
    
    const handleResize = useCallback(() => {
        if (window.innerWidth > 768) {
            setSidebarOpen(true);
        } else {
            setSidebarOpen(false);
        }
    }, []);

    useEffect(() => {
        window.addEventListener('resize', handleResize);
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        return () => {
            window.removeEventListener('resize', handleResize);
            audioSourceRef.current?.stop();
            audioContextRef.current?.close();
        }
    }, [handleResize]);
    
    const handleNewSession = useCallback(() => {
        const newSession = sessionService.createNewSession();
        setSessions(prev => ({ ...prev, [newSession.id]: newSession }));
        setSessionOrder(prev => [newSession.id, ...prev]);
        setCurrentSessionId(newSession.id);
    }, []);

    const handleSessionSelect = useCallback((id: string) => {
        setCurrentSessionId(id);
        sessionService.setCurrentSessionId(id);
        if (window.innerWidth <= 768) setSidebarOpen(false);
    }, []);
    
    const addMessage = useCallback((sessionId: string, message: Omit<ChatMessage, 'ts'>) => {
        const updatedSession = sessionService.addMessageToSession(sessionId, message);
        if (updatedSession) {
            setSessions(prev => ({ ...prev, [sessionId]: updatedSession }));
        }
    }, []);
    
    const handlePersonaChange = useCallback((persona: Persona) => {
        if (currentSession) {
            const updatedSession = { ...currentSession, meta: { ...currentSession.meta, persona } };
            const newSessions = sessionService.saveSessionsAndReturn(updatedSession);
            setSessions(newSessions);
        }
    }, [currentSession]);
    
    const handleLogout = useCallback(() => {
        userService.logoutUser();
        setAuthStatus('guest');
        setUserName(null);
        handleNewSession();
    }, [handleNewSession]);
    
    const handleClearHistory = useCallback(() => {
        sessionService.clearAllSessions();
        setSessions({});
        setSessionOrder([]);
        setCurrentSessionId(null);
        handleNewSession();
    }, [handleNewSession]);

    const prefetchAudio = useCallback(async (text: string, index: number) => {
        if (audioCache.has(index) || !text) return;

        setAudioLoadingState(prev => new Map(prev).set(index, true));
        try {
            const b64Audio = await getTextToSpeech(text);
            setAudioCache(prev => new Map(prev).set(index, b64Audio));
        } catch (error) {
            console.error(`Failed to prefetch audio for message ${index}:`, error);
        } finally {
            setAudioLoadingState(prev => {
                const m = new Map(prev);
                m.delete(index);
                return m;
            });
        }
    }, [audioCache]);

    const handlePlayAudio = async (text: string, index: number) => {
        if (speakingMessageIndex === index) {
            audioSourceRef.current?.stop();
            setSpeakingMessageIndex(null);
            return;
        }

        if (audioSourceRef.current) {
            audioSourceRef.current.stop();
        }

        const playAudio = async (b64: string) => {
            try {
                if (!audioContextRef.current) return;
                setSpeakingMessageIndex(index);
                const audioData = decodeB64(b64);
                const audioBuffer = await decodeAudioData(audioData, audioContextRef.current);
                const source = audioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContextRef.current.destination);
                source.onended = () => {
                    if (speakingMessageIndex === index) setSpeakingMessageIndex(null);
                };
                source.start();
                audioSourceRef.current = source;
            } catch (e) {
                console.error("Failed to play audio:", e);
                setSpeakingMessageIndex(null);
            }
        };
        
        const cachedAudio = audioCache.get(index);
        if (cachedAudio) {
            await playAudio(cachedAudio);
        } else {
            await prefetchAudio(text, index);
            const freshlyCached = audioCache.get(index);
            if (freshlyCached) {
                 await playAudio(freshlyCached);
            }
        }
    };

    const processStream = useCallback(async (
        sessionId: string, 
        stream: AsyncGenerator<any>,
    ) => {
        let fullResponse = "";
        let sources: Source[] = [];
        let suggestedReplies: string[] = [];

        for await (const event of stream) {
            if (event.type === 'chunk') {
                fullResponse += event.text;
                setSessions(prev => {
                    const current = { ...prev[sessionId] };
                    if (!current.messages) return prev;
                    const lastMsg = current.messages[current.messages.length - 1];
                    lastMsg.content = fullResponse;
                    return { ...prev, [sessionId]: current };
                });
            } else if (event.type === 'sources') {
                sources = event.sources;
            } else if (event.type === 'complete') {
                suggestedReplies = event.suggestedReplies;
            }
        }
        
        return { fullResponse, sources, suggestedReplies };

    }, []);

    const handleSendMessage = useCallback(async (prompt: string, file?: { name: string, type: string, content: string }) => {
        if (!currentSessionId || !currentSession) return;
        
        const userMessage: Omit<ChatMessage, 'ts'> = { role: 'user', content: prompt };
        if (file) userMessage.fileData = { name: file.name, type: file.type };
        addMessage(currentSessionId, userMessage);
        
        setIsStreaming(true);

        const botMessageIndex = currentSession.messages.length;
        addMessage(currentSessionId, { role: 'model', content: '' });
        
        try {
            const serviceCode = currentSession.meta.code;
            let fullResponse = "";
            let sources: Source[] = [];
            let suggestedReplies: string[] = [];
            let finalMessageType: MessageType = 'standard';
            let researchData: ResearchBundle | undefined = undefined;

            if (serviceCode === 'research-web') {
                const stream = getGroundedResponse(currentSession.messages, prompt);
                const result = await processStream(currentSessionId, stream);
                fullResponse = result.fullResponse;
                sources = result.sources;
                suggestedReplies = result.suggestedReplies;

            } else if (serviceCode === 'research') {
                researchData = await getResearchBrief(prompt);
                fullResponse = "Here is the structured research brief you requested.";
                finalMessageType = 'research_brief';
                
            } else {
                const systemInstruction = PERSONAS[currentSession.meta.persona || 'default'].instruction;
                const stream = getChatResponse(currentSession.messages, systemInstruction, prompt, file);
                const result = await processStream(currentSessionId, stream);
                fullResponse = result.fullResponse;
                suggestedReplies = result.suggestedReplies;
                finalMessageType = checkPlaceholders(fullResponse);
            }
            
            if (finalMessageType === 'standard' && fullResponse) {
                prefetchAudio(fullResponse, botMessageIndex);
            }

            setSessions(prev => {
                const updated = { ...prev };
                const session = updated[currentSessionId];
                const lastMsg = session.messages[botMessageIndex];
                lastMsg.content = fullResponse;
                lastMsg.sources = sources.length > 0 ? sources : undefined;
                lastMsg.suggestedReplies = suggestedReplies;
                lastMsg.messageType = finalMessageType;
                lastMsg.researchData = researchData;
                return updated;
            });

        } catch (error) {
            console.error("Error generating response:", error);
            setSessions(prev => {
                const updated = { ...prev };
                const session = updated[currentSessionId];
                const lastMsg = session.messages[botMessageIndex];
                lastMsg.content = "Sorry, I encountered an error. Please try again.";
                lastMsg.error = true;
                lastMsg.promptForRetry = prompt;
                lastMsg.fileData = file ? { name: file.name, type: file.type } : undefined;
                return updated;
            });
        } finally {
            setIsStreaming(false);
        }

    }, [currentSession, currentSessionId, addMessage, processStream, prefetchAudio]);
    
    useEffect(() => {
        if (currentSession?.meta.needsOnboarding && authStatus === 'guest' && !userName) {
            const hasAuthPrompt = currentSession.messages.some(m => m.messageType === 'auth_prompt');
            if(!hasAuthPrompt && currentSession.messages.length === 2 && currentSession.messages[1].role === 'user'){
                const name = currentSession.messages[1].content.trim();
                userService.setUserName(name);
                setUserName(name);
                addMessage(currentSession.id, { role: 'model', content: "", messageType: 'auth_prompt' });
            }
        }
    }, [currentSession, authStatus, userName, addMessage]);

    const handleAuthPromptSubmit = useCallback((data: any) => {
        let name: string | null = null;
        let email: string | null = null;
        
        if (data.credential) {
            const decoded = decodeJwt(data.credential);
            name = decoded?.given_name || decoded?.name;
            email = decoded?.email;
            userService.setAuthStatus('authenticated');
            setAuthStatus('authenticated');
        } else {
            name = userService.getUserName();
            email = data.email;
        }

        if (name) userService.setUserName(name);
        if (email) userService.setUserContactInfo(email);
        setUserName(name);
        
        if(currentSessionId) {
            setSessions(prev => {
                const session = { ...prev[currentSessionId] };
                session.messages = session.messages.filter(m => m.messageType !== 'auth_prompt');
                return { ...prev, [currentSessionId]: session };
            });
             addMessage(currentSessionId, { role: 'model', content: `Thank you, ${name}! It's a pleasure to meet you. How can I help you today?` });
        }
    }, [currentSessionId, addMessage]);


    const handleFinalizeWizard = useCallback((finalizedContent: string) => {
         if (currentSessionId) {
             addMessage(currentSessionId, { role: 'user', content: 'Finalized Document' });
             addMessage(currentSessionId, { role: 'model', content: finalizedContent });
         }
    }, [currentSessionId, addMessage]);
    

    return (
        <div className="fixed inset-0 bg-[#0f0f0f] z-30 flex flex-col h-full">
            <div className={`chat-wrap h-full w-full ${isSidebarOpen ? 'sidebar-open' : ''}`}>
                 <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)}></div>
                <Sidebar 
                    isExpanded={isSidebarOpen}
                    setExpanded={setSidebarOpen}
                    sessions={sessions}
                    sessionOrder={sessionOrder}
                    currentSessionId={currentSessionId}
                    onSessionSelect={handleSessionSelect}
                    onNewSession={handleNewSession}
                />
                
                <main role="main" className="flex flex-col h-full bg-black/10">
                    <ChatHeader
                        authStatus={authStatus}
                        userName={userName}
                        onClose={onClose}
                        currentPersona={currentSession?.meta.persona || 'default'}
                        onPersonaChange={handlePersonaChange}
                        onLogout={handleLogout}
                        onClearHistory={handleClearHistory}
                        onToggleSidebar={() => setSidebarOpen(!isSidebarOpen)}
                        isSidebarOpen={isSidebarOpen}
                    />

                    <MessageStream 
                        messages={currentSession?.messages || []} 
                        isStreaming={isStreaming}
                        onRetry={handleSendMessage}
                        onFinalizeWizard={handleFinalizeWizard}
                        onAuthPromptSubmit={handleAuthPromptSubmit}
                        onPlayAudio={handlePlayAudio}
                        speakingMessageIndex={speakingMessageIndex}
                        audioLoadingState={audioLoadingState}
                    />

                    <Composer isStreaming={isStreaming} onSendMessage={handleSendMessage} />
                </main>
            </div>
        </div>
    );
};

export default ChatUI;