import { ChatSession, ChatMessage, ServiceCode } from '../types';
import { LABELS } from '../constants';
import * as userService from './userService';

const LS_KEY = "aidlex_chats";
const ORDER_KEY = "aidlex_chat_order";
const CURRENT_KEY = "aidlex_current";

// --- Core Storage Helpers ---
export const loadSessions = (): Record<string, ChatSession> => JSON.parse(localStorage.getItem(LS_KEY) || "{}");
export const loadOrder = (): string[] => JSON.parse(localStorage.getItem(ORDER_KEY) || "[]");
export const saveSessions = (obj: Record<string, ChatSession>) => localStorage.setItem(LS_KEY, JSON.stringify(obj));
export const saveOrder = (arr: string[]) => localStorage.setItem(ORDER_KEY, JSON.stringify(arr));
export const setCurrentSessionId = (id: string) => localStorage.setItem(CURRENT_KEY, id);
export const getCurrentSessionId = (): string | null => localStorage.getItem(CURRENT_KEY);

/**
 * Saves a single session and returns the entire updated sessions object.
 * This is used to persist a locally modified session and update the UI state.
 * @param session The chat session to save.
 * @returns The complete record of all chat sessions.
 */
export const saveSessionsAndReturn = (session: ChatSession): Record<string, ChatSession> => {
    const sessions = loadSessions();
    sessions[session.id] = session;
    saveSessions(sessions);
    return sessions;
};

/**
 * Clears all session data from local storage.
 */
export const clearAllSessions = (): void => {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(ORDER_KEY);
    localStorage.removeItem(CURRENT_KEY);
};


// --- Session Management Logic ---

/**
 * Creates a new chat session, saves it to storage, and sets it as the current session.
 * Generates a context-aware greeting message, handling user onboarding if necessary.
 */
export const createNewSession = (title: string = "New chat", meta: { code?: ServiceCode } = {}): ChatSession => {
    const id = "c" + Date.now();
    const sessions = loadSessions();
    const order = loadOrder();
    const userName = userService.getUserName();

    let initialMessageContent: string;
    let needsOnboarding = false;

    if (!userName) {
        initialMessageContent = "Welcome to AIDLEX.AE. To provide a personalized experience, may I know your name, please?";
        needsOnboarding = true;
    } else if (meta.code && meta.code !== 'research') {
        const serviceName = LABELS[meta.code];
        initialMessageContent = `Welcome back, ${userName}. You've selected **${serviceName}**. How can I assist you with this topic?`;
    } else if (meta.code === 'research') {
        initialMessageContent = `Welcome back, ${userName}. What legal topic would you like to research today?`;
    } else {
        initialMessageContent = `Welcome back, ${userName}! How can I help you today?`;
    }

    const initialMessage: ChatMessage = {
        role: 'model',
        content: initialMessageContent,
        ts: Date.now(),
        messageType: 'standard'
    };

    const newSession: ChatSession = {
        id,
        title,
        createdAt: Date.now(),
        meta: { ...meta, persona: 'default', needsOnboarding },
        messages: [initialMessage]
    };
    
    sessions[id] = newSession;
    order.unshift(id);
    
    saveSessions(sessions);
    saveOrder(order);
    setCurrentSessionId(id);

    return newSession;
};

/**
 * Adds a message to a specific session and updates storage.
 * Also updates the session title from the first user message.
 */
export const addMessageToSession = (sessionId: string, message: Omit<ChatMessage, 'ts'>): ChatSession | null => {
    const sessions = loadSessions();
    const session = sessions[sessionId];

    if (!session) {
        console.error("Session not found:", sessionId);
        return null;
    }

    // Clear suggested replies from previous model message
    if (message.role === 'user' && session.messages.length > 0) {
        const lastMessage = session.messages[session.messages.length - 1];
        if (lastMessage.role === 'model') {
            delete lastMessage.suggestedReplies;
        }
    }

    session.messages.push({ ...message, ts: Date.now() });

    if (session.title === "New chat" && message.role === "user" && !session.meta.needsOnboarding) {
        session.title = message.content.slice(0, 40) + (message.content.length > 40 ? "…" : "");
    }

    saveSessions(sessions);
    return session;
};