import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TranscriptionTurn, ChatMessage } from '../types';
import * as LiveService from '../services/geminiLiveService';
import { getSimpleTextResponse } from '../services/geminiService';
import { PhoneIcon, WaveformIcon } from './Icons';
import { FunctionCall } from '@google/genai';

interface LiveChatUIProps {
    onClose: () => void;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
type LiveMessage = {
    type: 'transcript';
    turn: TranscriptionTurn;
} | {
    type: 'system';
    text: string;
};


const LiveChatUI: React.FC<LiveChatUIProps> = ({ onClose }) => {
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    const [liveMessages, setLiveMessages] = useState<LiveMessage[]>([]);
    const transcriptEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [liveMessages]);

    useEffect(() => {
        return () => {
            LiveService.disconnect();
        };
    }, []);

    const handleTranscriptionUpdate = useCallback((turns: TranscriptionTurn[]) => {
        setLiveMessages(currentMessages => {
            const newTranscriptMessages: LiveMessage[] = turns.map(turn => ({ type: 'transcript', turn }));
            const systemMessages = currentMessages.filter(msg => msg.type === 'system');
            
            const allMessages = [...newTranscriptMessages, ...systemMessages];
            // Use a Map to ensure transcript turns are unique, preserving system messages.
            const uniqueMessageMap = new Map<string | number, LiveMessage>();
            for (const m of allMessages) {
                if (m.type === 'transcript') {
                    uniqueMessageMap.set(`${m.turn.speaker}:${m.turn.text}`, m);
                } else {
                    // Use message text as key for system messages to avoid duplicates of the same message
                    uniqueMessageMap.set(m.text, m);
                }
            }
            return Array.from(uniqueMessageMap.values());
        });
    }, []);

    const handleToolCall = useCallback(async (calls: FunctionCall[]) => {
        for (const call of calls) {
            if (call.name === 'summarizeConversation') {
                // Add a type predicate to correctly narrow the message type after filtering.
                const transcriptText = liveMessages
                    .filter((m): m is { type: 'transcript', turn: TranscriptionTurn } => m.type === 'transcript')
                    .map(m => `${m.turn.speaker}: ${m.turn.text}`)
                    .join('\n');

                if (transcriptText.length < 20) {
                     LiveService.sendToolResponse(call.id!, call.name, "Not enough conversation to summarize.");
                     return;
                }
                
                setLiveMessages(prev => [...prev, { type: 'system', text: "Summarizing conversation..." }]);

                try {
                    const summaryText = await getSimpleTextResponse(
                        "You are a summarization assistant.",
                        `Please provide a concise summary of the following conversation transcript:\n\n${transcriptText}`
                    );
                    setLiveMessages(prev => [...prev, { type: 'system', text: `Summary: ${summaryText}` }]);
                    LiveService.sendToolResponse(call.id!, call.name, "Summary was generated and displayed to the user.");

                } catch (error) {
                    const errorMessage = "Failed to generate summary.";
                    setLiveMessages(prev => [...prev, { type: 'system', text: errorMessage }]);
                    LiveService.sendToolResponse(call.id!, call.name, errorMessage);
                }
            }
        }
    }, [liveMessages]);
    
    const handleConnect = useCallback(async () => {
        try {
            const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            if (permissionStatus.state === 'denied') {
                alert("Microphone access is denied. Please enable it in your browser settings to use the live chat feature.");
                return;
            }
            LiveService.connect(handleTranscriptionUpdate, setConnectionState, handleToolCall);
        } catch (err) {
            console.error("Could not query microphone permission:", err);
            // Fallback for browsers that don't support permissions.query, just try to connect
            LiveService.connect(handleTranscriptionUpdate, setConnectionState, handleToolCall);
        }
    }, [handleTranscriptionUpdate, handleToolCall]);

    const handleDisconnect = useCallback(() => {
        LiveService.disconnect();
        setConnectionState('disconnected');
    }, []);

    const getStatusIndicator = () => {
        let text;
        switch (connectionState) {
            case 'connecting': text = "Connecting..."; break;
            case 'connected': text = "Live"; break;
            case 'error': text = "Error"; break;
            default: text = "Offline";
        }
        return (
            <div className="flex items-center gap-2" aria-live="polite" aria-atomic="true">
                <div className={`w-2 h-2 rounded-full ${connectionState === 'connecting' ? 'bg-yellow-400 animate-pulse' : connectionState === 'connected' ? 'bg-green-400' : connectionState === 'error' ? 'bg-red-500' : 'bg-gray-500'}`}></div>
                {text}
            </div>
        );
    };
    
    return (
        <div className="h-screen w-screen bg-black/20 flex flex-col items-center justify-center p-4">
            <div role="dialog" aria-modal="true" aria-labelledby="live-chat-title" className="glass rounded-2xl w-full max-w-2xl h-full max-h-[90vh] flex flex-col p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="size-8 rounded-lg bg-white/10 border border-white/20 grid place-items-center"><PhoneIcon/></div>
                        <div>
                            <h2 id="live-chat-title" className="text-lg font-semibold">Live Conversation</h2>
                            <div className="text-xs text-gray-400">{getStatusIndicator()}</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="pill px-4 py-2 text-sm" aria-label="Close live conversation">Close</button>
                </div>
                
                {connectionState !== 'connected' && connectionState !== 'connecting' && (
                     <div className="flex-1 flex flex-col items-center justify-center text-center">
                        <WaveformIcon/>
                        <p className="mt-4 text-gray-300">Start a real-time voice conversation with the AI assistant.</p>
                        <p className="mt-2 text-xs text-gray-400">You can say "Summarize our conversation" during the chat.</p>
                     </div>
                )}
                
                <div role="log" aria-live="polite" className="flex-1 overflow-y-auto space-y-4 pr-2">
                   {liveMessages.map((msg, index) => {
                       if (msg.type === 'system') {
                           return (
                               <div key={index} className="text-center text-xs text-purple-300 italic py-2">
                                   --- {msg.text} ---
                               </div>
                           );
                       }
                       const { turn } = msg;
                       return (
                           <div key={index} className={`flex flex-col ${turn.speaker === 'user' ? 'items-end' : 'items-start'}`}>
                               <div className="text-xs text-gray-400 capitalize mb-1">{turn.speaker}</div>
                               <div className={`px-3 py-2 rounded-xl border text-[0.95rem] leading-6 msg ${turn.speaker === 'user' ? 'msg-user' : 'msg-bot'}`}>
                                   {turn.text}
                               </div>
                           </div>
                       );
                   })}
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