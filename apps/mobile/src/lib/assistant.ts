import { authorizedRequest } from './auth';

export type AssistantAction = {
  type: 'none' | 'search' | 'set_destination' | 'add_stop' | 'remove_stop' | 'set_route_style' | 'start_navigation';
  query?: string;
  routeStyle?: string;
  requiresConfirmation?: boolean;
};

export type AssistantResult = {
  reply: string;
  action: AssistantAction;
  weather?: { summary: string; temperatureC: number } | null;
};

export type AssistantContext = {
  destination?: { name?: string; address?: string; latitude?: number; longitude?: number };
  origin?: { latitude?: number; longitude?: number };
  routeStyle?: string;
  mode?: string;
  stops?: string[];
  distanceMeters?: number;
  durationSeconds?: number;
  /** How far from the traveler the agent may discuss / suggest places. */
  radiusMeters?: number;
  /** Historical site currently being offered as a stop. */
  pendingHeritage?: { id: string; name: string };
  /** The assistant persona chosen by the user (name / gender / language). */
  assistant?: { name?: string; gender?: string; language?: string };
};

/** Ask the conversational travel assistant (ai-service via the gateway). */
export function askAssistant(
  message: string,
  context: AssistantContext = {},
): Promise<AssistantResult> {
  return authorizedRequest<AssistantResult>('/ai/assistant', {
    method: 'POST',
    body: JSON.stringify({ message, context }),
  });
}

/** Synthesize speech via ElevenLabs (server-side). Returns base64 mp3 or null. */
export async function synthesizeSpeech(
  text: string,
  gender: 'male' | 'female',
  language?: string,
): Promise<string | null> {
  const res = await authorizedRequest<{ audio: string | null }>('/ai/tts', {
    method: 'POST',
    body: JSON.stringify({ text, gender, language }),
  });
  return res.audio ?? null;
}
