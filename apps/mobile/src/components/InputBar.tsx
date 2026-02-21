import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, spacing, radii, typography } from '../theme/tokens';

interface InputBarProps {
  disabled: boolean;
  onSend: (text: string) => void;
}

export function InputBar({ disabled, onSend }: InputBarProps) {
  const [text, setText] = useState('');

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Type response..."
        placeholderTextColor={colors.brewMuted}
        editable={!disabled}
        onSubmitEditing={handleSend}
        returnKeyType="send"
      />
      <TouchableOpacity
        style={[styles.sendButton, (!text.trim() || disabled) && styles.sendDisabled]}
        onPress={handleSend}
        disabled={!text.trim() || disabled}
      >
        <Text style={styles.sendText}>▶</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brewMedium,
    borderWidth: 1,
    borderColor: colors.brewSurface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  disabled: {
    opacity: 0.5,
  },
  input: {
    flex: 1,
    color: colors.cremaLight,
    fontFamily: typography.dmSans.regular,
    fontSize: 14,
    paddingVertical: spacing.sm,
  },
  sendButton: {
    backgroundColor: colors.claudeAmber,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sendDisabled: {
    opacity: 0.4,
  },
  sendText: {
    color: colors.brewDark,
    fontSize: 14,
    fontWeight: '600',
  },
});
