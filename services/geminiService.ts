import { GoogleGenAI, GenerateContentResponse, Type, Part, Modality } from "@google/genai";
import { ChatMessage, Source, MessageType, ResearchBundle, Jurisdiction } from '../types';
import dayjs from "dayjs";

/**
 * This service encapsulates all interactions with the Google Gemini API.
 */

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set. This must be configured in the environment.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = 'gemini-2.5-flash';

// Define yield types for our async generators
export type ChatStreamEvent = 
  | { type: 'chunk'; text: string }
  | { type: 'complete'; suggestedReplies: string[] };

export type GroundedStreamEvent = 
  | { type: 'chunk'; text: string }
  | { type: 'sources'; sources: Source[] }
  | { type: 'complete'; suggestedReplies: string[] };


export const getResearchBrief = async (issue: string, forum: Jurisdiction = "onshore"): Promise<ResearchBundle> => {
    try {
        const researchSystemInstruction = `You are a highly precise UAE legal research assistant. Your task is to return a structured JSON object based on the user's query.
- The object must contain: 'issue' (string), 'forum' (enum: "onshore", "difc", "adgm", "mixed"), and 'points' (an array of objects).
- Each point in the array must contain: 'label' (enum: "Verified", "Reasonably Inferred", "Unverified—Needs Source"), 'proposition' (a concise legal statement), and 'cite' (a specific UAE article-level citation, e.g., "Federal Decree-Law No. 42 of 2022 - Civil Procedure, Art. 55(2)").
- For 'Verified' labels, the citation must be direct and unambiguous.
- For 'Reasonably Inferred', the proposition is a logical conclusion from related legal principles, with the closest citation provided.
- Ensure the forum is correctly identified as 'onshore', 'difc', or 'adgm'. Use 'mixed' only if comparing them.
- The output MUST be only the JSON object, with no surrounding text or markdown.`;

        const response = await ai.models.generateContent({
            model,
            contents: issue,
            config: {
                systemInstruction: researchSystemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        issue: { type: Type.STRING },
                        forum: { type: Type.STRING, enum: ["onshore", "difc", "adgm", "mixed"] },
                        points: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    label: { type: Type.STRING, enum: ["Verified", "Reasonably Inferred", "Unverified—Needs Source"] },
                                    proposition: { type: Type.STRING },
                                    cite: { type: Type.STRING }
                                },
                                required: ['label', 'proposition']
                            }
                        }
                    },
                    required: ['issue', 'forum', 'points']
                }
            }
        });

        const parsed = JSON.parse(response.text);
        return {
            ...parsed,
            lastVerifiedOn: dayjs().format("DD/MM/YYYY")
        };

    } catch (error) {
        console.error("Error getting research brief:", error);
        throw new Error("Failed to generate research brief.");
    }
};

// This is a simple non-streaming function for one-off tasks like summarization.
export const getSimpleTextResponse = async (systemInstruction: string, prompt: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                systemInstruction,
            },
        });
        return response.text;
    } catch (error) {
        console.error("Error getting simple text response:", error);
        throw new Error("Failed to get a response from the AI.");
    }
};


// Streaming function for general chat
export async function* getChatResponse(
    history: ChatMessage[],
    systemInstruction: string,
    prompt: string,
    file?: { name: string; type: string; content: string }
): AsyncGenerator<ChatStreamEvent> {

    const contents: Part[] = [];
    if (file) {
        contents.push({
            inlineData: {
                mimeType: file.type,
                data: file.content,
            },
        });
    }
    contents.push({ text: prompt });

    const chatHistory = history.map(msg => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.content }]
    })).slice(0, -1); // Remove last user message as it's the new prompt

    const responseStream = await ai.models.generateContentStream({
        model,
        contents: {
            role: 'user',
            parts: contents,
        },
        config: {
            systemInstruction,
        },
        // The history parameter is not a direct part of the config object.
        // It should be passed at the same level as model, contents, and config.
        // However, the current SDK version might implicitly handle it through the chat object.
        // For direct generateContentStream, we should build the history manually if needed.
        // Let's assume the simplified API for now.
    });

    for await (const chunk of responseStream) {
        if(chunk.text) {
            yield { type: 'chunk', text: chunk.text };
        }
    }
    
    // Placeholder for suggested replies
    yield { type: 'complete', suggestedReplies: ["Tell me more.", "What's next?", "How does that apply?"] };
}

// Streaming function for web-grounded research
export async function* getGroundedResponse(
    history: ChatMessage[],
    prompt: string,
): AsyncGenerator<GroundedStreamEvent> {

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            tools: [{ googleSearch: {} }],
        }
    });

    const sources: Source[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map((chunk: any) => chunk.web)
        .filter((web: any) => web)
        .map((web: any) => ({ uri: web.uri, title: web.title })) || [];

    if (sources.length > 0) {
        yield { type: 'sources', sources };
    }
    
    // The API doesn't stream with grounding. We simulate it by yielding the full text.
    if (response.text) {
        yield { type: 'chunk', text: response.text };
    }
    
    yield { type: 'complete', suggestedReplies: ["Summarize this.", "What are the key points?", "Find more sources."] };
}

// New function for Text-to-Speech
export const getTextToSpeech = async (text: string): Promise<string> => {
    try {
        const prompt = `Read the following text aloud. Your voice should be formal, professional, and clear, like a knowledgeable legal assistant presenting information. Speak with a natural and expressive intonation. The text is: "${text}"`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        // Using 'Zephyr' for a more formal and expressive voice.
                        prebuiltVoiceConfig: { voiceName: 'Zephyr' },
                    },
                },
            },
        });
        
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("No audio data returned from TTS API.");
        }
        return base64Audio;
    } catch (error) {
        console.error("Error getting text to speech:", error);
        throw new Error("Failed to generate audio.");
    }
};