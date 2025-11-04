import { GoogleGenAI, GenerateContentResponse, Type, Part } from "@google/genai";
import { ChatMessage, Source, MessageType, ResearchBundle, Jurisdiction, VerificationLabel } from '../types';
import dayjs from "dayjs";

/**
 * This service encapsulates all interactions with the Google Gemini API.
 */

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set. This must be configured in the environment.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = 'gemini-2.5-flash';

interface GeminiResponse {
  text: string;
  sources: Source[];
  messageType: MessageType;
  suggestedReplies: string[];
}

const checkPlaceholders = (text: string): MessageType => {
  const placeholders = text.match(/\<\<([^\>]+)\>\>/g);
  return (placeholders && placeholders.length > 0) ? 'wizard' : 'standard';
};

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
        console.error("Error getting research brief from Gemini:", error);
        throw new Error("Failed to generate a research brief. The model may have returned an invalid structure.");
    }
};

export const getGroundedResponse = async (history: ChatMessage[], newMessage: string): Promise<GeminiResponse> => {
    try {
        const contents = [...history.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.content }]
        })), { role: 'user', parts: [{ text: newMessage }] }];

        const response = await ai.models.generateContent({
            model,
            contents,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });

        const text = response.text;
        const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
        const sources: Source[] = groundingMetadata?.groundingChunks
          ?.map((chunk: any) => ({
            uri: chunk.web?.uri || '',
            title: chunk.web?.title || 'Untitled Source',
          }))
          .filter(source => source.uri) ?? [];
        
        // Grounded responses don't have structured suggested replies, so we generate generic ones.
        const suggestedReplies = ["Tell me more about that.", "What are the key takeaways?", "How does this apply in Abu Dhabi?"];

        return {
            text,
            sources,
            messageType: 'standard',
            suggestedReplies,
        };

    } catch (error) {
        console.error("Error getting grounded response from Gemini:", error);
        throw new Error("Failed to get a grounded response from the AI.");
    }
};


export const getChatResponse = async (
    history: ChatMessage[], 
    systemInstruction: string, 
    newMessage: string,
    file?: { name: string; type: string; content: string; }
): Promise<GeminiResponse> => {
  try {
    // Convert history to Gemini's format
    // FIX: Explicitly type `contents` to allow for different Part types (text and inlineData).
    const contents: { role: 'user' | 'model'; parts: Part[] }[] = history.map(msg => ({
        role: msg.role as 'user' | 'model',
        parts: [{ text: msg.content }]
    }));

    // Prepare the new user message with optional file data
    const userParts: Part[] = [{ text: newMessage }];
    if (file) {
        userParts.unshift({
            inlineData: {
                mimeType: file.type,
                data: file.content
            }
        });
    }
    contents.push({ role: 'user', parts: userParts });

    const response = await ai.models.generateContent({
        model,
        contents,
        config: {
            systemInstruction: `${systemInstruction} IMPORTANT: Always format your entire response as a single, valid JSON object with two keys: "response" (your text answer) and "suggested_replies" (an array of 2-3 short, relevant follow-up questions or actions a user might take next).`,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    response: { type: Type.STRING },
                    suggested_replies: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                }
            }
        }
    });
    
    let jsonText = response.text.trim();
    try {
        const parsed = JSON.parse(jsonText);
        const messageType = checkPlaceholders(parsed.response);
        return {
            text: parsed.response || "Sorry, I couldn't generate a response.",
            sources: [],
            messageType,
            suggestedReplies: parsed.suggested_replies || []
        };
    } catch (e) {
        console.warn("Failed to parse JSON response, falling back to text:", jsonText);
        const messageType = checkPlaceholders(jsonText);
        return { text: jsonText, sources: [], messageType, suggestedReplies: [] };
    }

  } catch (error) {
    console.error("Error getting chat response from Gemini:", error);
    throw new Error("Failed to get a response from the AI. Please check your connection or try again later.");
  }
};