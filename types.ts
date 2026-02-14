
export type InteractionType = 'keyword' | 'ai_intent' | 'command' | 'regex';

export interface FlowStep {
  id: string;
  trigger: string;
  triggerType: InteractionType;
  response: string;
  action?: 'none' | 'notify_admin' | 'save_db' | 'api_call';
}

export interface UserAccountSession {
  isConnected: boolean;
  phoneNumber: string;
  apiId: string;
  apiHash: string;
  username?: string;
  avatar?: string;
}

export interface BotProject {
  id: string;
  name: string;
  description: string;
  botToken: string;
  steps: FlowStep[];
  aiConfig: {
    enabled: boolean;
    systemPrompt: string;
    personality: string;
  };
  targetConfig: {
    allChats: boolean;
    whitelist: string[]; // List of chat IDs or usernames
    blacklist: string[];
  };
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot' | 'me'; // 'me' represents the automated response from the user's account
  text: string;
  timestamp: number;
}
