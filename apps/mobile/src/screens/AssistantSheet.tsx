import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { askAssistant, type AssistantAction, type AssistantContext } from '../lib/assistant';
import { speak, stopSpeaking } from '../lib/tts';
import {
  bindVoice,
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
};

function actionLabel(a: AssistantAction): string | null {
  switch (a.type) {
    case 'add_stop':
      return `Add a stop${a.query ? `: ${a.query}` : ''}`;
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

export function AssistantSheet({ context, persona, onClose, onAction }: Props) {
  const assistantName = persona?.name || 'Travel Assistant';
  const locale = persona?.language || 'en-US';
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: 'assistant',
      text: `Hi! I'm ${persona?.name || 'your travel co-pilot'}. Ask me about your trip, the weather, or a place to stop.`,
    },
  ]);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [pending, setPending] = useState<AssistantAction | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  const send = useCallback(
    async (message: string) => {
      setTurns((t) => [...t, { role: 'user', text: message }]);
      setThinking(true);
      try {
        const result = await askAssistant(message, context);
        setTurns((t) => [...t, { role: 'assistant', text: result.reply }]);
        void speak(result.reply);
        const action = result.action;
        if (action && action.type !== 'none') {
          if (action.requiresConfirmation) {
            setPending(action);
          } else {
            onAction(action); // e.g. search — safe to apply immediately
          }
        }
      } catch {
        const msg = "Sorry, I couldn't reach the assistant. Check the connection and try again.";
        setTurns((t) => [...t, { role: 'assistant', text: msg }]);
        void speak(msg);
      } finally {
        setThinking(false);
      }
    },
    [context, onAction],
  );

  useEffect(
    () => () => {
      void destroyVoice();
      stopSpeaking();
    },
    [],
  );

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [turns, thinking, pending]);

  async function toggleMic() {
    if (listening) {
      setListening(false);
      await stopVoice();
      return;
    }
    if (!(await ensureMicPermission())) return;
    stopSpeaking();
    bindVoice({
      onResult: (text) => {
        setListening(false);
        void stopVoice();
        if (text.trim()) void send(text.trim());
      },
      onEnd: () => setListening(false),
      onError: () => setListening(false),
    });
    try {
      setListening(true);
      await startVoice(locale);
    } catch {
      setListening(false);
    }
  }

  function confirmPending() {
    if (pending) onAction(pending);
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
                {listening ? 'Listening…' : thinking ? 'Thinking…' : 'Tap the mic and talk'}
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
                Confirm before I change your route
              </Txt>
              <Txt variant="bodyStrong" style={{ marginTop: 2 }}>
                {actionLabel(pending)}
              </Txt>
              <View style={styles.confirmRow}>
                <Button
                  title="Not now"
                  variant="ghost"
                  size="md"
                  full={false}
                  style={{ flex: 1 }}
                  onPress={() => setPending(null)}
                />
                <Button
                  title="Confirm"
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
            {listening ? 'Listening — tap to stop' : 'Tap to talk'}
          </Txt>
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
