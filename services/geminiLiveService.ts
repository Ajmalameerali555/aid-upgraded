import { GoogleGenAI, LiveServerMessage, Modality, Blob, FunctionDeclaration, Type, FunctionCall } from "@google/genai";
import { TranscriptionTurn } from "../types";

// FIX: Add webkitAudioContext to window type to fix TypeScript errors.
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

// --- Base64 and Audio Decoding Helpers ---
function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

function encode(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// --- Live Service ---

let ai: GoogleGenAI | null = null;
const getAI = () => {
    if (!ai) {
        if (!process.env.API_KEY) {
            throw new Error("API_KEY environment variable not set");
        }
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
    return ai;
};

// --- Function Declarations for Tool Calling ---
const summarizeFunctionDeclaration: FunctionDeclaration = {
  name: 'summarizeConversation',
  description: 'Summarizes the conversation so far. The user must explicitly ask for a summary.',
  parameters: { type: Type.OBJECT, properties: {} },
};

let inputAudioContext: AudioContext;
let outputAudioContext: AudioContext;
let microphoneStream: MediaStream;
let scriptProcessor: ScriptProcessorNode;
// FIX: The `LiveSession` type is not exported from the '@google/genai' package. Using `any` as a workaround.
let sessionPromise: Promise<any>;

export const connect = async (
    onTranscriptionUpdate: (turns: TranscriptionTurn[]) => void,
    onStateChange: (state: 'connecting' | 'connected' | 'disconnected' | 'error') => void,
    onToolCall: (calls: FunctionCall[]) => void,
) => {
    try {
        onStateChange('connecting');
        const genAI = getAI();

        let nextStartTime = 0;
        const sources = new Set<AudioBufferSourceNode>();
        let currentInputTranscription = '';
        let currentOutputTranscription = '';
        const transcriptionHistory: TranscriptionTurn[] = [];
        
        inputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });

        sessionPromise = genAI.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks: {
                onopen: async () => {
                    onStateChange('connected');
                    microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    const source = inputAudioContext.createMediaStreamSource(microphoneStream);
                    scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                    
                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob: Blob = {
                            data: encode(new Uint8Array(new Int16Array(inputData.map(x => x * 32768)).buffer)),
                            mimeType: 'audio/pcm;rate=16000',
                        };
                        sessionPromise.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContext.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                     // Handle tool calls
                    if (message.toolCall) {
                        onToolCall(message.toolCall.functionCalls);
                    }

                    // Handle transcription
                    if (message.serverContent?.outputTranscription) {
                        currentOutputTranscription += message.serverContent.outputTranscription.text;
                    } else if (message.serverContent?.inputTranscription) {
                        currentInputTranscription += message.serverContent.inputTranscription.text;
                    }

                    if (message.serverContent?.turnComplete) {
                        if(currentInputTranscription) transcriptionHistory.push({ speaker: 'user', text: currentInputTranscription });
                        if(currentOutputTranscription) transcriptionHistory.push({ speaker: 'model', text: currentOutputTranscription });
                        onTranscriptionUpdate([...transcriptionHistory]);
                        currentInputTranscription = '';
                        currentOutputTranscription = '';
                    } else {
                         const currentTurn: TranscriptionTurn[] = [];
                         if (currentInputTranscription) currentTurn.push({ speaker: 'user', text: currentInputTranscription });
                         if (currentOutputTranscription) currentTurn.push({ speaker: 'model', text: currentOutputTranscription });
                         if(currentTurn.length > 0) onTranscriptionUpdate([...transcriptionHistory, ...currentTurn]);
                    }

                    // Handle audio output
                    const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                    if (base64EncodedAudioString) {
                        nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
                        const audioBuffer = await decodeAudioData(decode(base64EncodedAudioString), outputAudioContext, 24000, 1);
                        const source = outputAudioContext.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputAudioContext.destination);
                        source.addEventListener('ended', () => sources.delete(source));
                        source.start(nextStartTime);
                        nextStartTime += audioBuffer.duration;
                        sources.add(source);
                    }
                },
                onerror: (e: ErrorEvent) => {
                    console.error('Live session error:', e);
                    onStateChange('error');
                    disconnect();
                },
                onclose: () => {
                    onStateChange('disconnected');
                },
            },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                systemInstruction: 'You are AIDLEX.AE, a friendly and helpful AI legal assistant for the UAE. You can summarize the conversation if the user asks.',
                outputAudioTranscription: {},
                inputAudioTranscription: {},
                tools: [{ functionDeclarations: [summarizeFunctionDeclaration] }]
            },
        });
    } catch (error) {
        console.error("Failed to connect to Live session:", error);
        onStateChange('error');
    }
};

export const sendToolResponse = (id: string, name: string, result: any) => {
    sessionPromise.then((session) => {
        session.sendToolResponse({
            functionResponses: { id, name, response: { result } }
        });
    });
};

export const disconnect = async () => {
    if (sessionPromise) {
       try {
        const session = await sessionPromise;
        session.close();
       } catch (e) {
        // session might not have been created, ignore error
       }
    }
    if (microphoneStream) {
        microphoneStream.getTracks().forEach(track => track.stop());
    }
    if (scriptProcessor) {
        scriptProcessor.disconnect();
    }
    if(inputAudioContext?.state !== 'closed') {
        inputAudioContext?.close();
    }
    if(outputAudioContext?.state !== 'closed') {
        outputAudioContext?.close();
    }
};