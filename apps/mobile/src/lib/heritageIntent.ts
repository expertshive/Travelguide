export type HeritageVoiceCmd =
  | { type: 'add'; minutes?: number }
  | { type: 'skip' }
  | { type: 'more' }
  | { type: 'mute' };

/** Spoken replies while a historical place is being offered as a stop. */
export function heritageCommand(text: string): HeritageVoiceCmd | null {
  const t = text.trim().toLowerCase();
  if (
    /don'?t show historic|no more historic|stop (the )?historic|mute historic|without historic/.test(
      t,
    )
  ) {
    return { type: 'mute' };
  }
  if (/tell me more|more (detail|history|about)|go on/.test(t)) return { type: 'more' };
  if (/\b(skip|not now|nahi|nahin|no thanks|don't add|pass)\b/.test(t)) return { type: 'skip' };
  if (/\badd\b/.test(t) || /^(yes|yeah|yep|sure|ok|okay|do it|go ahead)\b/.test(t)) {
    const minutes = /\b(30|thirty)\b/.test(t) ? 30 : /\b(15|fifteen)\b/.test(t) ? 15 : undefined;
    return { type: 'add', minutes };
  }
  return null;
}
