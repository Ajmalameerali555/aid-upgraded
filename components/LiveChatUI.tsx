import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TranscriptionTurn } from '../types';
import * as LiveService from '../services/geminiLiveService';
import { PhoneIcon, WaveformIcon } from './Icons';

interface LiveChatUIProps {
    onClose: () => void;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

const LiveChatUI: React.FC<LiveChatUIProps> = ({ onClose }) => {
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    const [transcription, setTranscription] = useState<TranscriptionTurn[]>([]);
    const transcriptEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcription]);

    useEffect(() => {
        return () => {
            LiveService.disconnect();
        };
    }, []);
    
    const handleConnect = useCallback(async () => {
        try {
            const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            if (permissionStatus.state === 'denied') {
                alert("Microphone access is denied. Please enable it in your browser settings to use the live chat feature.");
                return;
            }
            LiveService.connect(setTranscription, setConnectionState);
        } catch (err) {
            console.error("Could not query microphone permission:", err);
            // Fallback for browsers that don't support permissions.query, just try to connect
            LiveService.connect(setTranscription, setConnectionState);
        }
    }, []);

    const handleDisconnect = useCallback(() => {
        LiveService.disconnect();
        setConnectionState('disconnected');
    }, []);

    const getStatusIndicator = () => {
        switch (connectionState) {
            case 'connecting':
                return <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>Connecting...</div>;
            case 'connected':
                return <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-400"></div>Live</div>;
            case 'error':
                return <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div>Error</div>;
            case 'disconnected':
            default:
                return <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-gray-500"></div>Offline</div>;
        }
    };
    
    return (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4">
            <div className="glass rounded-2xl w-full max-w-2xl h-full max-h-[90vh] flex flex-col p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="size-8 rounded-lg bg-white/10 border border-white/20 grid place-items-center"><PhoneIcon/></div>
                        <div>
                            <h2 className="text-lg font-semibold">Live Conversation</h2>
                            <div className="text-xs text-gray-400">{getStatusIndicator()}</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="pill px-4 py-2 text-sm">Close</button>
                </div>
                
                {connectionState !== 'connected' && connectionState !== 'connecting' && (
                     <div className="flex-1 flex flex-col items-center justify-center text-center">
                        <WaveformIcon/>
                        <p className="mt-4 text-gray-300">Start a real-time voice conversation with the AI assistant.</p>
                     </div>
                )}
                
                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                   {transcription.map((turn, index) => (
                       <div key={index} className={`flex flex-col ${turn.speaker === 'user' ? 'items-end' : 'items-start'}`}>
                           <div className="text-xs text-gray-400 capitalize mb-1">{turn.speaker}</div>
                           <div className={`px-3 py-2 rounded-xl border text-[0.95rem] leading-6 msg ${turn.speaker === 'user' ? 'msg-user' : 'msg-bot'}`}>
                               {turn.text}
                           </div>
                       </div>
                   ))}
                   <div ref={transcriptEndRef} />
                </div>

                <div className="mt-6 flex justify-center">
                    {connectionState === 'connected' || connectionState === 'connecting' ? (
                        <button onClick={handleDisconnect} className="btn bg-red-600/80 text-white hover:bg-red-600/100 w-48" disabled={connectionState === 'connecting'}>
                           {connectionState === 'connecting' ? 'Connecting...' : 'Disconnect'}
                        </button>
                    ) : (
                        <button onClick={handleConnect} className="btn btn-primary w-48">
                            Start Live Chat
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LiveChatUI;