import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { colors, spacing, radii, typography } from "../theme/tokens";
import { PermissionRequestMessage, AskUserQuestion } from "../types/protocol";

interface Props {
  msg: PermissionRequestMessage;
  onSubmit: (reason: string) => void;
  onSkip: () => void;
}

function formatAnswers(
  questions: AskUserQuestion[],
  selections: Map<number, Set<number>>,
): string {
  const lines = ["User answered via ClaudeBrew mobile:", ""];
  for (let qi = 0; qi < questions.length; qi++) {
    const q = questions[qi];
    const selected = selections.get(qi);
    const labels = q.options
      .filter((_, oi) => selected?.has(oi))
      .map((o) => o.label);
    lines.push(`Q: ${q.header} - ${q.question}`);
    lines.push(`A: ${labels.join(", ")}`);
    if (qi < questions.length - 1) lines.push("");
  }
  return lines.join("\n");
}

export function QuestionPrompt({ msg, onSubmit, onSkip }: Props) {
  const questions = (msg.toolInput as any)?.questions as AskUserQuestion[];
  const [selections, setSelections] = useState<Map<number, Set<number>>>(
    () => new Map(),
  );

  const toggleOption = (qi: number, oi: number, multiSelect: boolean) => {
    setSelections((prev) => {
      const next = new Map(prev);
      const current = new Set(next.get(qi) ?? []);
      if (multiSelect) {
        if (current.has(oi)) current.delete(oi);
        else current.add(oi);
      } else {
        current.clear();
        current.add(oi);
      }
      next.set(qi, current);
      return next;
    });
  };

  const allAnswered = questions.every((_, qi) => {
    const s = selections.get(qi);
    return s && s.size > 0;
  });

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.card} accessibilityRole="alert">
        <Text style={styles.label}>QUESTION</Text>

        {questions.map((q, qi) => (
          <View key={qi} style={styles.questionBlock}>
            <Text style={styles.header}>{q.header}</Text>
            <Text style={styles.question}>{q.question}</Text>
            {q.multiSelect && (
              <Text style={styles.multiHint}>Select all that apply</Text>
            )}
            <View style={styles.options}>
              {q.options.map((opt, oi) => {
                const selected = selections.get(qi)?.has(oi) ?? false;
                return (
                  <TouchableOpacity
                    key={oi}
                    style={[styles.option, selected && styles.optionSelected]}
                    onPress={() => toggleOption(qi, oi, q.multiSelect)}
                    accessibilityRole={q.multiSelect ? "checkbox" : "radio"}
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${opt.label}: ${opt.description}`}
                  >
                    <Text
                      style={[
                        styles.optionLabel,
                        selected && styles.optionLabelSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                    <Text style={styles.optionDesc}>{opt.description}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel="Skip question"
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitBtn, !allAnswered && styles.submitDisabled]}
            onPress={() => {
              if (allAnswered) onSubmit(formatAnswers(questions, selections));
            }}
            disabled={!allAnswered}
            accessibilityRole="button"
            accessibilityLabel="Submit answers"
          >
            <Text
              style={[
                styles.submitText,
                !allAnswered && styles.submitTextDisabled,
              ]}
            >
              Submit
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: "100%" },
  scrollContent: { flexGrow: 0 },
  card: {
    backgroundColor: colors.brewMedium,
    borderWidth: 1,
    borderColor: colors.claudeAmber,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
    shadowColor: colors.claudeAmber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  label: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 11,
    color: colors.claudeAmber,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  questionBlock: { gap: spacing.sm },
  header: {
    fontFamily: typography.jetbrainsMono.medium,
    fontSize: 11,
    color: colors.cremaDark,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  question: {
    fontFamily: typography.dmSans.semibold,
    fontSize: 16,
    color: colors.cremaLight,
    lineHeight: 22,
  },
  multiHint: {
    fontFamily: typography.dmSans.light,
    fontSize: 12,
    color: colors.brewMuted,
  },
  options: { gap: spacing.sm },
  option: {
    backgroundColor: colors.brewDark,
    borderRadius: radii.sm,
    padding: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.brewSurface,
    gap: 2,
  },
  optionSelected: {
    borderColor: colors.claudeAmber,
    backgroundColor: colors.claudeAmber + "14",
  },
  optionLabel: {
    fontFamily: typography.dmSans.semibold,
    fontSize: 14,
    color: colors.crema,
  },
  optionLabelSelected: {
    color: colors.claudeGold,
  },
  optionDesc: {
    fontFamily: typography.dmSans.regular,
    fontSize: 12,
    color: colors.cremaDark,
    lineHeight: 17,
  },
  buttons: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  skipBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.sm,
    alignItems: "center",
    backgroundColor: colors.brewDark,
    borderWidth: 1,
    borderColor: colors.brewSurface,
  },
  skipText: {
    fontFamily: typography.jetbrainsMono.medium,
    fontSize: 14,
    color: colors.brewMuted,
  },
  submitBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.sm,
    alignItems: "center",
    backgroundColor: colors.claudeAmber,
  },
  submitDisabled: {
    opacity: 0.4,
  },
  submitText: {
    fontFamily: typography.jetbrainsMono.medium,
    fontSize: 14,
    color: colors.brewDark,
  },
  submitTextDisabled: {
    color: colors.brewDark,
  },
});
