import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { colors, spacing, radii, typography } from "../theme/tokens";
import { PermissionRequestMessage } from "../types/protocol";

interface Props {
  msg: PermissionRequestMessage;
  onResponse: (decision: "allow" | "deny", reason?: string) => void;
}

export function PlanPrompt({ msg, onResponse }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");

  const planContent = msg.planContent;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.card} accessibilityRole="alert">
        <Text style={styles.label}>PLAN REVIEW</Text>

        {planContent ? (
          <View style={styles.planBlock}>
            <ScrollView
              style={[styles.planScroll, expanded && styles.planScrollExpanded]}
              nestedScrollEnabled
            >
              <Text style={styles.planText}>{planContent}</Text>
            </ScrollView>
            <TouchableOpacity
              onPress={() => setExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={expanded ? "Collapse plan" : "Expand plan"}
            >
              <Text style={styles.expandToggle}>
                {expanded ? "▲ Collapse" : "▼ Expand"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.planBlock}>
            <Text style={styles.noContent}>Plan content not available</Text>
          </View>
        )}

        {showFeedback ? (
          <View style={styles.feedbackBlock}>
            <TextInput
              style={styles.feedbackInput}
              placeholder="Describe what to change..."
              placeholderTextColor={colors.brewMuted}
              value={feedback}
              onChangeText={setFeedback}
              multiline
              autoFocus
              textAlignVertical="top"
            />
            <View style={styles.feedbackButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowFeedback(false);
                  setFeedback("");
                }}
                accessibilityRole="button"
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  !feedback.trim() && styles.sendDisabled,
                ]}
                onPress={() => {
                  if (feedback.trim()) {
                    onResponse(
                      "deny",
                      `Plan changes requested via ClaudeBrew:\n\n${feedback.trim()}`,
                    );
                  }
                }}
                disabled={!feedback.trim()}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.sendText,
                    !feedback.trim() && styles.sendTextDisabled,
                  ]}
                >
                  Send
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.approveBtn}
              onPress={() => onResponse("allow")}
              accessibilityRole="button"
              accessibilityLabel="Start implementing"
            >
              <Text style={styles.approveText}>Start implementing</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.changesBtn}
              onPress={() => setShowFeedback(true)}
              accessibilityRole="button"
              accessibilityLabel="Request changes to the plan"
            >
              <Text style={styles.changesText}>Request changes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rejectBtn}
              onPress={() => onResponse("deny", "Plan rejected")}
              accessibilityRole="button"
              accessibilityLabel="Reject plan"
            >
              <Text style={styles.rejectText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}
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
  planBlock: {
    backgroundColor: colors.brewDark,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brewSurface,
    overflow: "hidden",
  },
  planScroll: {
    maxHeight: 250,
    padding: spacing.sm,
  },
  planScrollExpanded: {
    maxHeight: 500,
  },
  planText: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 11,
    color: colors.terminalMuted,
    lineHeight: 17,
  },
  expandToggle: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 11,
    color: colors.brewMuted,
    textAlign: "center",
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.brewSurface,
  },
  noContent: {
    fontFamily: typography.dmSans.light,
    fontSize: 13,
    color: colors.brewMuted,
    textAlign: "center",
    padding: spacing.md,
  },
  buttons: {
    gap: spacing.sm,
  },
  approveBtn: {
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
    alignItems: "center",
    backgroundColor: colors.claudeAmber,
  },
  approveText: {
    fontFamily: typography.jetbrainsMono.medium,
    fontSize: 16,
    color: colors.brewDark,
  },
  changesBtn: {
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
    alignItems: "center",
    backgroundColor: colors.brewDark,
    borderWidth: 1,
    borderColor: colors.claudeAmber,
  },
  changesText: {
    fontFamily: typography.jetbrainsMono.medium,
    fontSize: 16,
    color: colors.claudeAmber,
  },
  rejectBtn: {
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
    alignItems: "center",
    backgroundColor: colors.brewDark,
    borderWidth: 1,
    borderColor: colors.offline,
  },
  rejectText: {
    fontFamily: typography.jetbrainsMono.medium,
    fontSize: 16,
    color: colors.offline,
  },
  feedbackBlock: {
    gap: spacing.sm,
  },
  feedbackInput: {
    backgroundColor: colors.brewDark,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.claudeAmber,
    padding: spacing.sm,
    fontFamily: typography.dmSans.regular,
    fontSize: 14,
    color: colors.cremaLight,
    minHeight: 80,
    lineHeight: 20,
  },
  feedbackButtons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.sm,
    alignItems: "center",
    backgroundColor: colors.brewDark,
    borderWidth: 1,
    borderColor: colors.brewSurface,
  },
  cancelText: {
    fontFamily: typography.jetbrainsMono.medium,
    fontSize: 14,
    color: colors.brewMuted,
  },
  sendBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.sm,
    alignItems: "center",
    backgroundColor: colors.claudeAmber,
  },
  sendDisabled: {
    opacity: 0.4,
  },
  sendText: {
    fontFamily: typography.jetbrainsMono.medium,
    fontSize: 14,
    color: colors.brewDark,
  },
  sendTextDisabled: {
    color: colors.brewDark,
  },
});
