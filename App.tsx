import React, { useState, useEffect, useCallback } from 'react';
import { LABELS, SERVICE_DETAILS } from './constants';
import { ServiceCode } from './types';
import ChatUI from './components/ChatUI';
import ServiceModal from './components/ServiceModal';
import LiveChatUI from './components/LiveChatUI';
import PrivacyPolicy from './components/PrivacyPolicy';
import * as sessionService from './services/sessionService';


const App: React.FC = () => {
    const [isChatVisible, setChatVisible] = useState(false);
    const [isLiveChatVisible, setLiveChatVisible] = useState(false);
    const [modalServiceCode, setModalServiceCode] = useState<ServiceCode | null>(null);
    const [isPrivacyPolicyVisible, setPrivacyPolicyVisible] = useState(false);
    // This state is used to force re-renders when the current session changes.
    const [currentSessionId, setCurrentIdState] = useState<string | null>(sessionService.getCurrentSessionId());
    
    useEffect(() => {
        // Initialize first chat session if none exists
        const order = sessionService.loadOrder();
        if (order.length === 0) {
            const newSession = sessionService.createNewSession();
            setCurrentIdState(newSession.id);
        } else if (!sessionService.getCurrentSessionId()){
            sessionService.setCurrentSessionId(order[0]);
            setCurrentIdState(order[0]);
        }
    }, []);

    const startChat = useCallback((code?: ServiceCode | 'live', starterText?: string) => {
        if (code === 'live') {
            setLiveChatVisible(true);
            return;
        }

        const sessions = sessionService.loadSessions();
        let currentId = sessionService.getCurrentSessionId();
        const needsNewSession = !currentId || (sessions[currentId] && sessions[currentId].messages.length > 1); // >1 to account for initial greeting
        
        let session;
        if (needsNewSession) {
             const title = code ? `${LABELS[code]} chat` : (starterText ? starterText.substring(0, 40) + '…' : "New chat");
             session = sessionService.createNewSession(title, { code });
        } else if (currentId) {
            session = sessions[currentId];
            if (session.meta.code !== code) {
                session.meta.code = code;
                sessionService.saveSessions(sessions);
            }
        }

        if(session) {
            setCurrentIdState(session.id);
            sessionService.setCurrentSessionId(session.id);
            setChatVisible(true);
        }
        
    }, []);
    
    const handleOpenChatFromTop = () => {
        let currentId = sessionService.getCurrentSessionId();
        if (!currentId) {
           currentId = sessionService.createNewSession().id;
        }
        setCurrentIdState(currentId);
        setChatVisible(true);
    };

    return (
        <>
            <div className="glow -z-10"></div>
            
            {!isChatVisible && !isLiveChatVisible && (
                <>
                    <header role="banner" className="w-full">
                        <div className="mx-auto max-w-6xl px-4 py-5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <img src="https://res.cloudinary.com/da7ivvsdj/image/upload/v1762264232/lgo_kzhywq.png" alt="AIDLEX.AE Logo" className="size-8" />
                                <span className="tracking-widest text-sm uppercase text-gray-300">AIDLEX.AE</span>
                            </div>
                            <nav aria-label="Main Navigation" className="hidden sm:flex items-center gap-3">
                                <a href="#services" className="pill px-3 py-2 text-sm hover:bg-white/15">Services</a>
                                <button onClick={handleOpenChatFromTop} className="pill px-3 py-2 text-sm hover:bg-white/15">Open Chat</button>
                            </nav>
                        </div>
                    </header>

                    <section className="text-center px-4 pt-6">
                        <div className="typewriter">
                            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-widest">WELCOME TO AIDLEX.AE</h1>
                        </div>
                        <p className="mt-2 text-gray-400 text-base sm:text-lg font-light fade-in" style={{ animationDelay: '.3s' }}>AI‑Powered Legal Intelligence</p>
                    </section>
                    
                    <main role="main" id="services" className="mx-auto max-w-6xl w-full px-4 mt-10 fade-in" style={{ animationDelay: '.45s' }}>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm uppercase tracking-widest text-gray-400">Services</h2>
                            <span className="text-xs text-gray-500">Aligned • Structured • Professional</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {Object.entries(LABELS).filter(([code]) => !['5', 'research'].includes(code)).map(([code, title]) => (
                                <div key={code} className="glass service-card rounded-2xl p-5 h-full">
                                    <h3 className="font-semibold">{code.includes('research') ? '' : `${code}) `}{title}</h3>
                                    <p className="mt-1 text-xs text-gray-300 opacity-80">{SERVICE_DETAILS[code]?.sub}</p>
                                    <div className="mt-4 flex items-center gap-3">
                                        <button className="btn btn-ghost text-sm" onClick={() => startChat(code as ServiceCode)}>Start Chat</button>
                                        <button className="btn btn-link text-sm" onClick={() => setModalServiceCode(code as ServiceCode)}>View more →</button>
                                    </div>
                                </div>
                            ))}
                             <div className="glass service-card rounded-2xl p-5 h-full flex flex-col">
                                <h3 className="font-semibold">Legal Research</h3>
                                <p className="mt-1 text-xs text-gray-300 opacity-80">Structured briefs or live web search</p>
                                <div className="mt-auto pt-4 flex items-center gap-3">
                                    <button className="btn btn-ghost text-sm flex-1" onClick={() => startChat('research')}>Structured Brief</button>
                                    <button className="btn btn-ghost text-sm flex-1" onClick={() => startChat('research-web')}>Web Search</button>
                                </div>
                            </div>
                            <div className="glass service-card rounded-2xl p-5 h-full opacity-60">
                                <h3 className="font-semibold">5) — <span className="text-xs ml-1 opacity-70">(coming soon)</span></h3>
                                <p className="mt-1 text-xs text-gray-300 opacity-80">Reserved for upcoming module</p>
                                <div className="mt-4 flex items-center gap-3">
                                    <button className="btn btn-ghost text-sm cursor-not-allowed" disabled>Start Chat</button>
                                    <button className="btn btn-link text-sm cursor-not-allowed" disabled>View more →</button>
                                </div>
                            </div>
                        </div>
                    </main>

                    <footer role="contentinfo" className="mx-auto max-w-6xl w-full px-4 py-10 text-center text-xs text-gray-500">
                        <span>© {new Date().getFullYear()} AIDLEX.AE — UAE‑centric, AR/EN ready</span>
                        <span className="mx-2">|</span>
                        <button className="btn-link !text-xs" onClick={() => setPrivacyPolicyVisible(true)}>Privacy Policy</button>
                    </footer>
                </>
            )}

            {isChatVisible && <ChatUI onClose={() => setChatVisible(false)} initialSessionId={currentSessionId} />}

            {isLiveChatVisible && <LiveChatUI onClose={() => setLiveChatVisible(false)} />}
            
            {modalServiceCode && (
                <ServiceModal 
                    code={modalServiceCode}
                    onClose={() => setModalServiceCode(null)}
                    onStartChat={() => {
                        startChat(modalServiceCode);
                        setModalServiceCode(null);
                    }}
                />
            )}

            {isPrivacyPolicyVisible && <PrivacyPolicy onClose={() => setPrivacyPolicyVisible(false)} />}
        </>
    );
};

export default App;