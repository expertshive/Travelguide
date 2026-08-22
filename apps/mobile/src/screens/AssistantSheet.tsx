import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { askAssistant, type AssistantAction, type AssistantContext } from '../lib/assistant';
import type { Place } from '../lib/map';
import { destinationFromUtterance } from '../lib/placeIntent';
import { heritageCommand, type HeritageVoiceCmd } from '../lib/heritageIntent';
import { isAssistantLanguage, spokenCopy, type AssistantLanguage } from '../lib/assistantPrefs';
import { speak, stopSpeaking } from '../lib/tts';
import {
  bindVoice,
  delay,
  destroyVoice,
  ensureMicPermission,
  startVoice,
  stopVoice,
} from '../lib/voice';
import { Button, Gradient, Icon, Txt, colors, radius, shadow, spacing } from '../ui';

type Turn = { role: 'user' | 'assistant'; text: string };

type Props = {
  context: AssistantContext;
  persona?: { name?: string; language?: string };
  onClose: () => void;
  /** Apply an action the user confirmed (or that needs no confirmation). */
  onAction: (action: AssistantAction) => void;
  /** Search a spoken place name and make it the trip destination. */
  onSetDestination?: (query: string) => Promise<{ name: string } | null>;
  onHeritageCommand?: (cmd: HeritageVoiceCmd) => void;
  /** Show a map card for the nearest restaurant / rest area the traveler asked for. */
  onSuggestStop?: (item: { place: Place; category: string; meters: number }) => void;
};

function isAffirmative(text: string): boolean {
  const t = text.trim().toLowerCase();
  return /^(yes|yeah|yep|yup|sure|ok|okay|confirm|do it|go ahead|please|haan|haanji|جی|ہاں|نعم|ايوه|oui|sí|si|claro|evet|tamam)\b/i.test(
    t,
  );
}

function isNegative(text: string): boolean {
  const t = text.trim().toLowerCase();
  return /^(no|nope|nah|not now|cancel|don't|stop|نہیں|لا|non|ahora no|hayır|şimdi değil)\b/i.test(
    t,
  );
}

function actionLabel(a: AssistantAction): string | null {
  switch (a.type) {
    case 'add_stop':
      return `Add a stop${a.query ? `: ${a.query}` : ''}`;
    case 'set_destination':
      return `Set destination${a.query ? ` to ${a.query}` : ''}`;
    case 'remove_stop':
      return 'Remove the current stop';
    case 'set_route_style':
      return `Switch to a ${a.routeStyle ?? 'different'} route`;
    case 'start_navigation':
      return 'Start navigation';
    default:
      return null;
  }
}

export function AssistantSheet({
  context,
  persona,
  onClose,
  onAction,
  onSetDestination,
  onHeritageCommand,
  onSuggestStop,
}: Props) {
  const assistantName = persona?.name || 'Travel Assistant';
  const langCode = persona?.language;
  const locale: AssistantLanguage = isAssistantLanguage(langCode) ? langCode : 'en-US';
  const copy = spokenCopy(locale);
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: 'assistant',
      text: copy.greeting(assistantName),
    },
  ]);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [pending, setPending] = useState<AssistantAction | null>(null);
  const pendingRef = useRef<AssistantAction | null>(null);
  pendingRef.current = pending;
  const [micError, setMicError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  const send = useCallback(
    async (message: string) => {
      const waiting = pendingRef.current;
      if (waiting) {
        if (isAffirmative(message)) {
          setTurns((t) => [...t, { role: 'user', text: message }]);
          onAction(waiting);
          setPending(null);
          void speak(copy.okay);
          return;
        }
        if (isNegative(message)) {
          setTurns((t) => [...t, { role: 'user', text: message }]);
          setPending(null);
          void speak(copy.confirmNotNow);
          return;
        }
      }
      setTurns((t) => [...t, { role: 'user', text: message }]);
      if (context.pendingHeritage && onHeritageCommand) {
        const hcmd = heritageCommand(message);
        if (hcmd) {
          onHeritageCommand(hcmd);
          const ack =
            hcmd.type === 'skip'
              ? 'Skipping it.'
              : hcmd.type === 'mute'
                ? "I won't mention historical places."
                : hcmd.type === 'more'
                  ? 'A little more history…'
                  : copy.okay;
          setTurns((t) => [...t, { role: 'assistant', text: ack }]);
          return;
        }
      }
      const destQuery = destinationFromUtterance(message);
      if (destQuery && onSetDestination) {
        setThinking(true);
        try {
          const place = await onSetDestination(destQuery);
          const reply = place ? copy.goingTo(place.name) : copy.notFoundPlace(destQuery);
          setTurns((t) => [...t, { role: 'assistant', text: reply }]);
          void speak(reply);
        } catch {
          const reply = copy.notFoundPlace(destQuery);
          setTurns((t) => [...t, { role: 'assistant', text: reply }]);
          void speak(reply);
        } finally {
          setThinking(false);
        }
        return;
      }
      setThinking(true);
      try {
        const result = await askAssistant(message, context);
        setTurns((t) => [...t, { role: 'assistant', text: result.reply }]);
        const action = result.action;
        let spoken = result.reply;
        if (action && action.type !== 'none') {
          if (action.requiresConfirmation) {
            setPending(action);
            const label = actionLabel(action);
            if (label && !/\?\s*$/.test(result.reply.trim())) {
              spoken = `${result.reply} ${copy.confirmAsk(label)}`;
            }
          } else {
            onAction(action); // e.g. search — safe to apply immediately
          }
        }
        void speak(spoken);
      } catch {
        const msg = "Sorry, I couldn't reach the assistant. Check the connection and try again.";
        setTurns((t) => [...t, { role: 'assistant', text: msg }]);
        void speak(msg);
      } finally {
        setThinking(false);
      }
    },
    [context, copy, onAction, onSetDestination, onHeritageCommand],
  );

  const sendRef = useRef(send);
  sendRef.current = send;
  const micBusy = useRef(false);
  const micRetry = useRef(0);
  const localeRef = useRef(locale);
  localeRef.current = locale;

  useEffect(() => {
    bindVoice({
      onResult: (text) => {
        micRetry.current = 0;
        setListening(false);
        void stopVoice();
        if (text.trim()) void sendRef.current(text.trim());
      },
      onEnd: () => setListening(false),
      onError: (message, code) => {
        if ((code === '5' || code === '8') && micRetry.current < 2) {
          micRetry.current += 1;
          void (async () => {
            await delay(500 * micRetry.current);
            try {
              await startVoice(localeRef.current);
            } catch (error) {
              setListening(false);
              setMicError(error instanceof Error ? error.message : message);
            }
          })();
          return;
        }
        micRetry.current = 0;
        setListening(false);
        setMicError(
          code === '5' || code === '8'
            ? 'The agent was still talking. Tap the mic again.'
            : message,
        );
      },
    });
    return () => {
      void destroyVoice();
      void stopSpeaking();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await stopSpeaking();
      if (!cancelled) await speak(copy.greeting(assistantName));
    })();
    return () => {
      cancelled = true;
    };
    // Greet once per sheet open — `copy` is a stable module object per language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistantName]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [turns, thinking, pending]);

  async function toggleMic() {
    if (micBusy.current) return;
    if (listening) {
      setListening(false);
      await stopVoice();
      return;
    }
    micBusy.current = true;
    setMicError(null);
    try {
      if (!(await ensureMicPermission())) {
        setMicError('Allow the microphone to talk to the agent.');
        return;
      }
      micRetry.current = 0;
      await stopSpeaking();
      setListening(true);
      await startVoice(locale);
    } catch (error) {
      setListening(false);
      setMicError(error instanceof Error ? error.message : 'Could not start the microphone.');
    } finally {
      micBusy.current = false;
    }
  }

  function confirmPending() {
    if (pending) {
      onAction(pending);
      void speak(copy.okay);
    }
    setPending(null);
  }

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
        <Gradient name="candy" style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerIcon}>
              <Icon.SparkleIcon color={colors.onPrimary} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong" color={colors.onPrimary}>
                {assistantName}
              </Txt>
              <Txt variant="small" color="rgba(255,255,255,0.85)">
                {listening ? copy.listening : thinking ? copy.thinking : copy.idleHint}
              </Txt>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.close}>
              <Icon.CloseIcon color={colors.onPrimary} size={18} />
            </Pressable>
          </View>
        </Gradient>

        <ScrollView ref={scrollRef} style={styles.convo} contentContainerStyle={styles.convoInner}>
          {turns.map((turn, i) => (
            <View
              key={i}
              style={[styles.bubble, turn.role === 'user' ? styles.userBubble : styles.aiBubble]}
            >
              <Txt
                variant="body"
                color={turn.role === 'user' ? colors.onPrimary : colors.text}
              >
                {turn.text}
              </Txt>
            </View>
          ))}
          {thinking ? (
            <View style={[styles.bubble, styles.aiBubble]}>
              <Txt variant="body" color={colors.textDim}>
                …
              </Txt>
            </View>
          ) : null}

          {pending ? (
            <View style={styles.confirm}>
              <Txt variant="small" color={colors.textDim}>
                {copy.confirmTitle}
              </Txt>
              <Txt variant="bodyStrong" style={{ marginTop: 2 }}>
                {actionLabel(pending)}
              </Txt>
              <View style={styles.confirmRow}>
                <Button
                  title={copy.confirmNotNow}
                  variant="ghost"
                  size="md"
                  full={false}
                  style={{ flex: 1 }}
                  onPress={() => {
                    setPending(null);
                    void speak(copy.confirmNotNow);
                  }}
                />
                <Button
                  title={copy.confirmOk}
                  size="md"
                  full={false}
                  style={{ flex: 1 }}
                  onPress={confirmPending}
                />
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Pressable onPress={() => void toggleMic()} style={styles.micWrap}>
            <Gradient
              name={listening ? 'sunset' : 'brandBright'}
              style={[styles.micBtn, listening && styles.micBtnOn]}
            >
              <Icon.MicIcon color={colors.onPrimary} size={26} />
            </Gradient>
          </Pressable>
          <Txt variant="small" color={colors.textDim} center style={{ marginTop: spacing.sm }}>
            {listening ? copy.listeningStop : copy.tapToTalk}
          </Txt>
          {micError ? (
            <Txt variant="small" color={colors.danger} center style={{ marginTop: spacing.sm }}>
              {micError}
            </Txt>
          ) : null}
        </View>
      </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 50,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '82%',
    overflow: 'hidden',
    ...shadow.lifted,
  },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  convo: { flexGrow: 0 },
  convoInner: { padding: spacing.lg, gap: spacing.md },
  bubble: { maxWidth: '85%', borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderBottomLeftRadius: 4, ...shadow.soft },

  confirm: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    ...shadow.soft,
  },
  confirmRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },

  footer: { alignItems: 'center', paddingVertical: spacing.lg },
  micWrap: { alignItems: 'center' },
  micBtn: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', ...shadow.lifted },
  micBtnOn: {},
});
