import { useEffect, useRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { fonts, radius, space, TAP_TARGET, useTokens } from '../lib/tokens';

/** The card surface. `settle` plays the one animation in the motion budget. */
export function Card({ children, settle = false }: { children: ReactNode; settle?: boolean }) {
  const t = useTokens();
  const progress = useRef(new Animated.Value(settle ? 0 : 1)).current;

  useEffect(() => {
    if (!settle) return;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) {
        progress.setValue(1);
        return;
      }
      Animated.timing(progress, { toValue: 1, duration: 360, useNativeDriver: true }).start();
    });
    return () => {
      cancelled = true;
      progress.stopAnimation();
    };
  }, [settle, progress]);

  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: t.surface, borderColor: t.border },
        settle && {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const t = useTokens();
  return <Text style={[styles.title, { color: t.ink }]}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  const t = useTokens();
  return <Text style={[styles.muted, { color: t.inkMuted }]}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  const t = useTokens();
  return (
    <Text
      accessibilityRole="alert"
      style={[styles.errorText, { color: t.ink, backgroundColor: t.bg, borderColor: t.border }]}
    >
      {children}
    </Text>
  );
}

export function Button({
  label,
  onPress,
  kind = 'default',
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  /** 'connect' is the accent's only home. */
  kind?: 'default' | 'connect' | 'quiet';
  disabled?: boolean;
}) {
  const t = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        kind === 'connect' && { backgroundColor: t.accent, borderColor: t.accent },
        kind === 'default' && { backgroundColor: t.surface, borderColor: t.borderInput },
        kind === 'quiet' && styles.buttonQuiet,
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      <Text
        style={[
          styles.buttonLabel,
          { color: kind === 'connect' ? t.accentInk : kind === 'quiet' ? t.inkMuted : t.ink },
          kind === 'connect' && styles.buttonLabelConnect,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  ...inputProps
}: TextInputProps & {
  label: string;
}) {
  const t = useTokens();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: t.ink }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={t.inkMuted}
        // Off by default: emails, UIDs, and URLs must not be autocorrected.
        // Callers can re-enable per field via inputProps.
        autoCorrect={false}
        spellCheck={false}
        style={[
          styles.input,
          { color: t.ink, backgroundColor: t.bg, borderColor: t.borderInput },
        ]}
        {...inputProps}
      />
    </View>
  );
}

export function Avatar({
  name,
  url,
  size = 76,
}: {
  name: string;
  url: string | null;
  size?: number;
}) {
  const t = useTokens();
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[styles.avatar, { width: size, height: size, borderColor: t.border }]}
      />
    );
  }
  return (
    <View
      style={[
        styles.avatar,
        styles.avatarFallback,
        { width: size, height: size, backgroundColor: t.bg, borderColor: t.border },
      ]}
    >
      <Text style={[styles.avatarInitial, { color: t.inkMuted, fontSize: size * 0.42 }]}>
        {(name.trim().charAt(0) || '?').toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space.s6,
    alignItems: 'center',
    gap: space.s4,
    width: '100%',
    maxWidth: 416,
    alignSelf: 'center',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  muted: {
    fontFamily: fonts.body,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 23,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 15,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingVertical: space.s3,
    paddingHorizontal: space.s4,
    width: '100%',
    textAlign: 'center',
  },
  button: {
    minHeight: 52,
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.s5,
    width: '100%',
  },
  buttonQuiet: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    minHeight: TAP_TARGET,
  },
  buttonLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
  },
  buttonLabelConnect: {
    fontSize: 18,
  },
  field: {
    width: '100%',
    gap: space.s2,
  },
  fieldLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  input: {
    minHeight: TAP_TARGET,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: space.s4,
    paddingVertical: space.s3,
    fontFamily: fonts.body,
    fontSize: 17,
    width: '100%',
  },
  avatar: {
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fonts.displayMedium,
  },
});
