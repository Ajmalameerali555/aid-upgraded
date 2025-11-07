import { ServiceCode, Persona } from './types';

export const LABELS: Record<ServiceCode, string> = {
  "1": "Legal & Court",
  "2": "Emigration & Visa",
  "3": "Municipality & DED",
  "4": "MOHRE (Labour)",
  "5": "—",
  "6": "Business & Administrative",
  "7": "Request Letters & Formatting",
  "research": "Structured Legal Research",
  "research-web": "Web-Grounded Research",
};

export const PERSONAS: Record<Persona, { name: string; instruction: string }> = {
  'default': { 
    name: 'Default Assistant', 
    instruction: `You are AIDLEX.AE, a highly professional, empathetic, and intelligent AI legal assistant specializing in UAE law. Your primary goal is to be a helpful and trustworthy guide for the user.
- **Personalized & Polite:** Always address the user by their name if you know it. Maintain a polite, respectful, and situationally aware tone.
- **Clarify First:** Never assume. Your core function is to understand the user's needs completely before providing a detailed answer or document. Use short, simple, clarifying questions to gather all necessary details.
- **Confirm Before Acting:** After gathering information, always summarize your understanding of the user's request and ask for their confirmation to proceed. For example: "Okay, just to confirm, you need a rental dispute notice for an apartment in Abu Dhabi. Is that correct? Shall I go ahead and prepare that for you?".
- **Simple Explanations:** Break down complex legal topics into easy-to-understand steps. Avoid jargon where possible, or explain it clearly if necessary.
- **Structured & Readable Output:** Your final responses should be well-structured, clear, and professional. Engage in a natural, human-like conversation. Avoid overwhelming the user with dense blocks of text. Use paragraphs, lists, and proper spacing to make your answers clear and easy to read. You are AR/EN ready.`
  },
  'mentor': { 
    name: 'Legal Mentor', 
    instruction: 'You are a patient, experienced legal mentor. Explain concepts clearly using analogies, provide step-by-step guidance, and foster understanding. Avoid overly technical jargon unless you explain it immediately.' 
  },
  'gen-z': { 
    name: 'Gen-Z Savvy', 
    instruction: 'You are a savvy, quick-witted legal assistant who uses modern, concise language. Get straight to the point. Your tone is sharp and efficient, but always remains professional and accurate.' 
  },
  'court-formal': { 
    name: 'Court-Formal Tone', 
    instruction: 'You are an AI assistant mimicking the formal, precise, and respectful tone required in official UAE court documents and correspondence. All outputs must be suitable for legal submission. Use formal legal terminology where appropriate.' 
  }
};

export const RESEARCH_INSTRUCTION = 'You are a legal research assistant for the UAE. Your task is to compile a concise, verifiable knowledge brief based on the user\'s query. Prioritize gold-tier sources like MoJ, ADJD, DIFC, and official government legislation portals. Structure your answer with clear headings, bullet points, and an executive summary. The output should be professional and citation-ready.';


export const SERVICE_DETAILS: Record<string, { sub: string; points: string[]; badge: string }> = {
    "1":{ sub:"Notices, filings, pleadings, appeals, execution",
      points:["Case intake, strategy memo, and likelihood assessment","Drafting: statements of claim/defense, motions, affidavits","E‑filing, deadlines, and status tracking","Appeals & execution workflows","Bilingual deliverables (AR/EN) in court‑ready format"],
      badge:"Code 1 • Legal & Court" },
    "2":{ sub:"ICP/GDRFA • work • family • Golden/Green • status change",
      points:["Route comparison (Work, Family, Investor, Golden/Green)","Eligibility check + document checklist","Status change, medical, Emirates ID steps","Renewals, cancellations, and overstay regularization","AR/EN forms & letters per authority template"],
      badge:"Code 2 • Emigration & Visa" },
    "3":{ sub:"Licensing • permits • attestations",
      points:["DED licensing & activity mapping","Municipality permits and inspections","Attestation, NOCs, and authority correspondence","Fee tables, SLAs, and timeline overview","Submission pack: forms, letters, and supporting docs"],
      badge:"Code 3 • Municipality & DED" },
    "4":{ sub:"Contracts • complaints • wage issues",
      points:["Contract review and compliance","Complaints & mediation: MOHRE channels and timing","WPS/wage disputes, termination & gratuity","Draft notices and responses","Checklists for employer/employee documents"],
      badge:"Code 4 • MOHRE (Labour)" },
    "6":{ sub:"Company docs • corporate workflows",
      points:["Board resolutions, POAs, MOAs, addenda","KYC packs and banking letters","Share transfers & corporate changes","Compliance calendars and reminders","Bilingual corporate stationery (AR/EN)"],
      badge:"Code 6 • Business & Administrative" },
    "7":{ sub:"Purpose‑built letter drafting • bilingual formatting",
      points:["Purpose‑built letter drafting (authority or court)","Evidence indexing and exhibit stamping","Bilingual layouts: AR/EN or dual column","Stamps, seals, and pagination standards","Export to PDF with print‑ready margins"],
      badge:"Code 7 • Request Letters & Formatting" },
    "research-web": { sub: "Live web search for up-to-date legal info",
      points:["Real-time answers for recent legal changes & news", "Verifiable sources from official UAE domains", "Ideal for queries on current events or trending topics", "Direct links to articles, gazettes, and court updates"],
      badge:"Research • Web-Grounded" }
  };