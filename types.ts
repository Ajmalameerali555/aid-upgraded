export type ServiceCode = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "research";
export type Persona = 'default' | 'mentor' | 'gen-z' | 'court-formal';

export interface Source {
  uri: string;
  title: string;
}

export type MessageType = 'standard' | 'wizard' | 'auth_prompt' | 'research_brief';
export type VerificationLabel = "Verified" | "Reasonably Inferred" | "Unverified—Needs Source";
export type Jurisdiction = "onshore" | "difc" | "adgm" | "mixed";

export interface VerifiedPoint {
  label: VerificationLabel;
  proposition: string;
  cite?: string;
}

export interface ResearchBundle {
  issue: string;
  forum: Jurisdiction;
  points: VerifiedPoint[];
  lastVerifiedOn: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  ts: number;
  sources?: Source[];
  messageType?: MessageType;
  suggestedReplies?: string[];
  error?: boolean;
  promptForRetry?: string;
  researchData?: ResearchBundle;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  meta: {
    code?: ServiceCode;
    persona?: Persona;
    needsOnboarding?: boolean;
  };
  messages: ChatMessage[];
}

export interface TranscriptionTurn {
  speaker: 'user' | 'model';
  text: string;
}
