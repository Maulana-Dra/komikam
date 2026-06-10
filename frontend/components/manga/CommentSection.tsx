import React from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Text } from "@/components/ui/app-text";
import { useAppTheme } from "@/src/theme/ThemeContext";
import { getProfile, type AccountProfile } from "@/src/store/account";
import {
  apiGetComments,
  apiPostComment,
  apiPostReply,
  apiLikeComment,
  apiReportComment,
  type ApiComment,
} from "@/src/api/komikamApi";

interface CommentSectionProps {
  mangaId: string;
}

export default function CommentSection({ mangaId }: CommentSectionProps) {
  const router = useRouter();
  const { resolved } = useAppTheme();
  const isDark = resolved === "dark";

  const colors = React.useMemo(
    () => ({
      bg: isDark ? "#0B0B0E" : "#F6F1E9",
      card: isDark ? "#121218" : "#FBF6EE",
      text: isDark ? "#F2F2F7" : "#1E2329",
      subtext: isDark ? "#B3B3C2" : "#6A625A",
      border: isDark ? "#242434" : "#E6DED2",
      chip: isDark ? "#1A1A24" : "#EFE6DA",
      chipText: isDark ? "#B3B3C2" : "#6A625A",
      button: isDark ? "#F2F2F7" : "#1E2A3A",
      buttonText: isDark ? "#111111" : "#F7F2EA",
      ghost: isDark ? "#1A1A24" : "#F2E9DD",
      ghostText: isDark ? "#F2F2F7" : "#1E2329",
      inputBg: isDark ? "#121218" : "#FBF5EC",
      inputText: isDark ? "#F2F2F7" : "#1E2329",
      placeholder: isDark ? "#7E7E91" : "#9A8F83",
      accent: isDark ? "#6C63FF" : "#3B30CC",
      danger: isDark ? "#FF5C5C" : "#D32F2F",
    }),
    [isDark]
  );

  // ── State ────────────────────────────────────────────────────────────────
  const [profile, setProfile] = React.useState<AccountProfile | null>(null);
  const [comments, setComments] = React.useState<ApiComment[]>([]);
  const [page, setPage] = React.useState(1);
  const [lastPage, setLastPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [sort, setSort] = React.useState<"latest" | "popular">("latest");
  const [commentText, setCommentText] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // New states for reply feature
  const [activeReplyId, setActiveReplyId] = React.useState<number | null>(null);
  const [replyText, setReplyText] = React.useState("");
  const [submittingReply, setSubmittingReply] = React.useState(false);
  const [expandedCommentIds, setExpandedCommentIds] = React.useState<Record<number, boolean>>({});

  // Memoized target comment being replied to
  const targetComment = React.useMemo(() => {
    if (activeReplyId === null) return null;
    for (const c of comments) {
      if (c.id === activeReplyId) return c;
      if (c.replies) {
        const found = c.replies.find((r) => r.id === activeReplyId);
        if (found) return found;
      }
    }
    return null;
  }, [activeReplyId, comments]);

  // Memoized clean reply character count (ignoring prefix mention)
  const replyCharCount = React.useMemo(() => {
    if (!targetComment) return replyText.length;
    const prefix = `@${targetComment.user_name} `;
    if (replyText.startsWith(prefix)) {
      return replyText.slice(prefix.length).length;
    }
    return replyText.length;
  }, [replyText, targetComment]);

  // Load user profile & initial comments
  React.useEffect(() => {
    const init = async () => {
      try {
        const p = await getProfile();
        setProfile(p);
      } catch (e) {
        console.warn("Failed to load profile in CommentSection:", e);
      }
    };
    void init();
  }, []);

  const loadComments = React.useCallback(
    async (pageNum: number, isRefresh = false) => {
      try {
        if (pageNum === 1 && !isRefresh) setLoading(true);
        else if (pageNum > 1) setLoadingMore(true);

        const res = await apiGetComments(mangaId, sort, pageNum);

        setComments((prev) =>
          isRefresh || pageNum === 1 ? res.data : [...prev, ...res.data]
        );
        setPage(res.current_page);
        setLastPage(res.last_page);
        setTotal(res.total);
      } catch (e) {
        console.error("Failed to load comments:", e);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [mangaId, sort]
  );

  // Reload comments when sort or mangaId changes
  React.useEffect(() => {
    void loadComments(1, true);
  }, [loadComments]);

  // ── Action Handlers ───────────────────────────────────────────────────────

  const handlePostComment = React.useCallback(async () => {
    const trimmed = commentText.trim();
    if (!trimmed || trimmed.length > 200 || submitting) return;

    setSubmitting(true);
    try {
      const res = await apiPostComment(mangaId, trimmed);
      setCommentText("");

      if (sort === "latest") {
        setComments((prev) => [res.comment, ...prev]);
        setTotal((prev) => prev + 1);
      } else {
        await loadComments(1, true);
      }
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : "Gagal mengirim komentar";
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Terjadi Kesalahan", msg);
      }
    } finally {
      setSubmitting(false);
    }
  }, [commentText, mangaId, sort, loadComments, submitting]);

  const handleReplyPress = React.useCallback((comment: ApiComment) => {
    if (!profile) {
      if (Platform.OS === "web") {
        window.alert("Silakan login terlebih dahulu untuk membalas komentar.");
      } else {
        Alert.alert("Perlu Login", "Silakan login terlebih dahulu untuk membalas komentar.");
      }
      return;
    }
    const parentId = comment.parent_id || comment.id;
    setActiveReplyId(comment.id);
    setReplyText(`@${comment.user_name} `);

    // Auto-expand parent replies
    setExpandedCommentIds((prev) => ({
      ...prev,
      [parentId]: true,
    }));
  }, [profile]);

  const handlePostReply = React.useCallback(async (parentCommentId: number) => {
    const trimmed = replyText.trim();
    if (!trimmed || submittingReply) return;

    // Calculate length excluding mention for validation
    let actualLength = trimmed.length;
    let replyToUserId: number | undefined = undefined;

    if (targetComment) {
      const prefix = `@${targetComment.user_name} `;
      if (trimmed.startsWith(prefix)) {
        actualLength = trimmed.slice(prefix.length).length;
        replyToUserId = targetComment.user_id;
      }
    }

    if (actualLength > 200) {
      if (Platform.OS === "web") {
        window.alert("Balasan tidak boleh lebih dari 200 karakter.");
      } else {
        Alert.alert("Terjadi Kesalahan", "Balasan tidak boleh lebih dari 200 karakter.");
      }
      return;
    }

    setSubmittingReply(true);
    try {
      const res = await apiPostReply(activeReplyId!, trimmed, replyToUserId);
      setReplyText("");
      setActiveReplyId(null);

      // Add reply to parent comment in state
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === parentCommentId) {
            const currentReplies = c.replies || [];
            return {
              ...c,
              replies: [...currentReplies, res.comment],
            };
          }
          return c;
        })
      );

      // Auto expand replies for this comment
      setExpandedCommentIds((prev) => ({
        ...prev,
        [parentCommentId]: true,
      }));
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : "Gagal mengirim balasan";
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Terjadi Kesalahan", msg);
      }
    } finally {
      setSubmittingReply(false);
    }
  }, [replyText, submittingReply, activeReplyId, targetComment]);

  const handleLike = React.useCallback(
    async (commentId: number) => {
      if (!profile) {
        if (Platform.OS === "web") {
          window.alert("Silakan login terlebih dahulu untuk menyukai komentar.");
        } else {
          Alert.alert("Perlu Login", "Silakan login terlebih dahulu untuk menyukai komentar.");
        }
        return;
      }

      // Optimistic update
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === commentId) {
            const nextLiked = !c.liked_by_me;
            return {
              ...c,
              liked_by_me: nextLiked,
              likes_count: nextLiked
                ? c.likes_count + 1
                : Math.max(0, c.likes_count - 1),
            };
          }
          if (c.replies && c.replies.length > 0) {
            return {
              ...c,
              replies: c.replies.map((r) => {
                if (r.id === commentId) {
                  const nextLiked = !r.liked_by_me;
                  return {
                    ...r,
                    liked_by_me: nextLiked,
                    likes_count: nextLiked
                      ? r.likes_count + 1
                      : Math.max(0, r.likes_count - 1),
                  };
                }
                return r;
              }),
            };
          }
          return c;
        })
      );

      try {
        const res = await apiLikeComment(commentId);
        // Sync response state
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === commentId) {
              return {
                ...c,
                liked_by_me: res.liked,
                likes_count: res.likes_count,
              };
            }
            if (c.replies && c.replies.length > 0) {
              return {
                ...c,
                replies: c.replies.map((r) => {
                  if (r.id === commentId) {
                    return {
                      ...r,
                      liked_by_me: res.liked,
                      likes_count: res.likes_count,
                    };
                  }
                  return r;
                }),
              };
            }
            return c;
          })
        );
      } catch (e) {
        console.error("Failed to like comment:", e);
        // Reload as fallback if out of sync
        void loadComments(1, true);
      }
    },
    [profile, loadComments]
  );

  const handleReport = React.useCallback(
    async (commentId: number) => {
      if (!profile) {
        if (Platform.OS === "web") {
          window.alert("Silakan login terlebih dahulu untuk melaporkan komentar.");
        } else {
          Alert.alert("Perlu Login", "Silakan login terlebih dahulu untuk melaporkan komentar.");
        }
        return;
      }

      const performReport = async () => {
        try {
          const res = await apiReportComment(commentId);
          setComments((prev) =>
            prev.map((c) => {
              if (c.id === commentId) {
                return { ...c, status: "reported" as const };
              }
              if (c.replies && c.replies.length > 0) {
                return {
                  ...c,
                  replies: c.replies.map((r) => {
                    if (r.id === commentId) {
                      return { ...r, status: "reported" as const };
                    }
                    return r;
                  }),
                };
              }
              return c;
            })
          );
          if (Platform.OS === "web") {
            window.alert(res.message);
          } else {
            Alert.alert("Berhasil", res.message);
          }
        } catch (e: any) {
          const msg = e instanceof Error ? e.message : "Gagal melaporkan komentar";
          if (Platform.OS === "web") {
            window.alert(msg);
          } else {
            Alert.alert("Terjadi Kesalahan", msg);
          }
        }
      };

      if (Platform.OS === "web") {
        if (
          window.confirm(
            "Apakah kamu yakin ingin melaporkan komentar ini karena tidak pantas?"
          )
        ) {
          void performReport();
        }
      } else {
        Alert.alert(
          "Laporkan Komentar",
          "Apakah kamu yakin ingin melaporkan komentar ini karena tidak pantas?",
          [
            { text: "Batal", style: "cancel" },
            { text: "Laporkan", style: "destructive", onPress: performReport },
          ]
        );
      }
    },
    [profile]
  );

  // ── Helper UI Functions ───────────────────────────────────────────────────

  const getAvatarBgColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorsList = [
      "#FF5E36",
      "#FF9F43",
      "#1DD1A1",
      "#54A0FF",
      "#5F27CD",
      "#00D2D3",
      "#FF6B6B",
      "#48DBFB",
      "#10AC84",
      "#576574",
    ];
    const index = Math.abs(hash) % colorsList.length;
    return colorsList[index];
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const now = new Date();
      const date = new Date(dateStr);
      const diffMs = now.getTime() - date.getTime();
      if (diffMs < 0) return "Baru saja";
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "Baru saja";
      if (diffMins < 60) return `${diffMins}m yang lalu`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}j yang lalu`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays} hari yang lalu`;

      return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "-";
    }
  };

  const inputCharCount = commentText.length;
  const isInputOverLimit = inputCharCount > 200;

  return (
    <View style={styles.container}>
      {/* Header & Sort Toggle */}
      <View style={styles.headerRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="chatbubbles-outline" size={20} color={colors.text} />
          <Text style={[styles.titleText, { color: colors.text }]}>
            Komentar ({total})
          </Text>
        </View>

        <View style={styles.sortToggleContainer}>
          {(["latest", "popular"] as const).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => setSort(mode)}
              style={[
                styles.sortButton,
                sort === mode && { backgroundColor: colors.button },
              ]}
            >
              <Text
                style={[
                  styles.sortButtonText,
                  { color: sort === mode ? colors.buttonText : colors.subtext },
                ]}
              >
                {mode === "latest" ? "Terbaru" : "Terpopuler"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Input Form */}
      {profile ? (
        <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.inputInnerRow}>
            {/* User Initials Avatar */}
            <View
              style={[
                styles.avatarCircle,
                { backgroundColor: getAvatarBgColor(profile.name) },
              ]}
            >
              <Text style={styles.avatarText}>{getInitials(profile.name)}</Text>
            </View>

            <View style={{ flex: 1, gap: 4 }}>
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Tulis pendapatmu tentang komik ini..."
                placeholderTextColor={colors.placeholder}
                multiline
                maxLength={250} // Sedikit buffer untuk input
                style={[styles.textInput, { color: colors.inputText }]}
              />

              <View style={styles.inputFooter}>
                <Text
                  style={[
                    styles.charCounter,
                    {
                      color: isInputOverLimit
                        ? colors.danger
                        : inputCharCount > 180
                        ? "#FFA500"
                        : colors.subtext,
                    },
                  ]}
                >
                  {inputCharCount}/200
                </Text>

                <Pressable
                  onPress={handlePostComment}
                  disabled={!commentText.trim() || isInputOverLimit || submitting}
                  style={({ pressed }) => [
                    styles.sendButton,
                    {
                      backgroundColor:
                        !commentText.trim() || isInputOverLimit
                          ? colors.chip
                          : colors.accent,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.sendButtonText}>Kirim</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      ) : (
        /* Guest Banner to Prompt Login */
        <View style={[styles.guestCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="lock-closed-outline" size={24} color={colors.subtext} />
          <Text style={[styles.guestText, { color: colors.subtext }]}>
            Masuk ke akun Komikam untuk menulis komentar, menyukai, dan melaporkan komentar lain.
          </Text>
          <Pressable
            onPress={() => router.push("/account")}
            style={({ pressed }) => [
              styles.guestLoginButton,
              { backgroundColor: colors.button, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.guestLoginButtonText, { color: colors.buttonText }]}>
              Masuk Akun
            </Text>
          </Pressable>
        </View>
      )}

      {/* Comments List */}
      {loading ? (
        <View style={{ paddingVertical: 32 }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : comments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.chipText} />
          <Text style={[styles.emptyText, { color: colors.subtext }]}>
            Belum ada komentar. Jadilah yang pertama memberikan review!
          </Text>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          {comments.map((item) => {
            const isFormActiveForThisComment =
              activeReplyId === item.id ||
              (item.replies && item.replies.some((r) => r.id === activeReplyId));

            return (
              <View key={`comment-group-${item.id}`} style={{ gap: 8 }}>
                {/* Main Comment Card */}
                <View
                  style={[
                    styles.commentItem,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.commentHeader}>
                    <View style={styles.commentUserRow}>
                      {/* Profile Avatar */}
                      <View
                        style={[
                          styles.avatarCircleSmall,
                          { backgroundColor: getAvatarBgColor(item.user_name) },
                        ]}
                      >
                        <Text style={styles.avatarTextSmall}>
                          {getInitials(item.user_name)}
                        </Text>
                      </View>
                      <View style={{ gap: 2 }}>
                        <Text style={[styles.userNameText, { color: colors.text }]}>
                          {item.user_name}
                        </Text>
                        <Text style={[styles.timeText, { color: colors.subtext }]}>
                          {formatRelativeTime(item.created_at)}
                        </Text>
                      </View>
                    </View>

                    {/* Report Action Button */}
                    {item.status === "reported" ? (
                      <View style={styles.reportedIndicator}>
                        <Ionicons name="alert-circle-outline" size={13} color={colors.danger} />
                        <Text style={[styles.reportedIndicatorText, { color: colors.danger }]}>
                          Dilaporkan
                        </Text>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => handleReport(item.id)}
                        style={({ pressed }) => [
                          styles.reportButton,
                          { opacity: pressed ? 0.6 : 1 },
                        ]}
                      >
                        <Ionicons name="flag-outline" size={16} color={colors.placeholder} />
                      </Pressable>
                    )}
                  </View>

                  <Text style={[styles.commentContentText, { color: colors.text }]}>
                    {item.content}
                  </Text>

                  {/* Comment Footer (Like & Reply buttons) */}
                  <View style={[styles.commentFooterRow, { gap: 12 }]}>
                    <Pressable
                      onPress={() => handleLike(item.id)}
                      style={({ pressed }) => [
                        styles.likeButton,
                        { opacity: pressed ? 0.8 : 1 },
                      ]}
                    >
                      <Ionicons
                        name={item.liked_by_me ? "heart" : "heart-outline"}
                        size={16}
                        color={item.liked_by_me ? colors.accent : colors.subtext}
                      />
                      <Text
                        style={[
                          styles.likeCountText,
                          { color: item.liked_by_me ? colors.accent : colors.subtext },
                        ]}
                      >
                        {item.likes_count}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleReplyPress(item)}
                      style={({ pressed }) => [
                        styles.replyButton,
                        { opacity: pressed ? 0.8 : 1 },
                      ]}
                    >
                      <Ionicons
                        name="chatbubble-outline"
                        size={15}
                        color={colors.subtext}
                      />
                      <Text style={[styles.replyButtonText, { color: colors.subtext }]}>
                        Balas
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Toggle replies button if replies exist */}
                {item.replies && item.replies.length > 0 && (
                  <Pressable
                    onPress={() => {
                      setExpandedCommentIds((prev) => ({
                        ...prev,
                        [item.id]: !prev[item.id],
                      }));
                    }}
                    style={styles.toggleRepliesButton}
                  >
                    <Ionicons
                      name={expandedCommentIds[item.id] ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={colors.accent}
                    />
                    <Text style={[styles.toggleRepliesText, { color: colors.accent }]}>
                      {expandedCommentIds[item.id]
                        ? "Sembunyikan balasan"
                        : `Lihat ${item.replies.length} balasan`}
                    </Text>
                  </Pressable>
                )}

                {/* Render Nested Replies container if expanded OR if the reply form is active for this comment */}
                {(expandedCommentIds[item.id] || isFormActiveForThisComment) && (
                  <View style={[styles.repliesListContainer, { borderLeftColor: colors.border }]}>
                    {expandedCommentIds[item.id] &&
                      item.replies &&
                      item.replies.map((reply) => (
                        <View
                          key={`reply-${reply.id}`}
                          style={[
                            styles.replyItem,
                            {
                              backgroundColor: colors.card,
                              borderColor: colors.border,
                            },
                          ]}
                        >
                          <View style={styles.commentHeader}>
                            <View style={styles.commentUserRow}>
                              <View
                                style={[
                                  styles.avatarCircleSmall,
                                  { backgroundColor: getAvatarBgColor(reply.user_name) },
                                ]}
                              >
                                <Text style={styles.avatarTextSmall}>
                                  {getInitials(reply.user_name)}
                                </Text>
                              </View>
                              <View style={{ gap: 2 }}>
                                <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                                  <Text style={[styles.userNameText, { color: colors.text }]}>
                                    {reply.user_name}
                                  </Text>
                                  {reply.reply_to_username && (
                                    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.accent }}>
                                      → @{reply.reply_to_username}
                                    </Text>
                                  )}
                                </View>
                                <Text style={[styles.timeText, { color: colors.subtext }]}>
                                  {formatRelativeTime(reply.created_at)}
                                </Text>
                              </View>
                            </View>

                            {/* Report Action Button */}
                            {reply.status === "reported" ? (
                              <View style={styles.reportedIndicator}>
                                <Ionicons name="alert-circle-outline" size={13} color={colors.danger} />
                                <Text style={[styles.reportedIndicatorText, { color: colors.danger }]}>
                                  Dilaporkan
                                </Text>
                              </View>
                            ) : (
                              <Pressable
                                onPress={() => handleReport(reply.id)}
                                style={({ pressed }) => [
                                  styles.reportButton,
                                  { opacity: pressed ? 0.6 : 1 },
                                ]}
                              >
                                <Ionicons name="flag-outline" size={16} color={colors.placeholder} />
                              </Pressable>
                            )}
                          </View>

                          <Text style={[styles.commentContentText, { color: colors.text }]}>
                            {reply.content}
                          </Text>

                          {/* Reply Footer (Like & Reply buttons) */}
                          <View style={[styles.commentFooterRow, { gap: 12 }]}>
                            <Pressable
                              onPress={() => handleLike(reply.id)}
                              style={({ pressed }) => [
                                styles.likeButton,
                                { opacity: pressed ? 0.8 : 1 },
                              ]}
                            >
                              <Ionicons
                                name={reply.liked_by_me ? "heart" : "heart-outline"}
                                size={16}
                                color={reply.liked_by_me ? colors.accent : colors.subtext}
                              />
                              <Text
                                style={[
                                  styles.likeCountText,
                                  { color: reply.liked_by_me ? colors.accent : colors.subtext },
                                ]}
                              >
                                {reply.likes_count}
                              </Text>
                            </Pressable>

                            <Pressable
                              onPress={() => handleReplyPress(reply)}
                              style={({ pressed }) => [
                                styles.replyButton,
                                { opacity: pressed ? 0.8 : 1 },
                              ]}
                            >
                              <Ionicons
                                name="chatbubble-outline"
                                size={15}
                                color={colors.subtext}
                              />
                              <Text style={[styles.replyButtonText, { color: colors.subtext }]}>
                                Balas
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      ))}

                    {/* Inline Reply Form at the bottom of the list */}
                    {isFormActiveForThisComment && (
                      <View
                        style={[
                          styles.replyFormContainer,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <View style={styles.inputInnerRow}>
                          {profile && (
                            <View
                              style={[
                                styles.avatarCircleSmall,
                                { backgroundColor: getAvatarBgColor(profile.name) },
                              ]}
                            >
                              <Text style={styles.avatarTextSmall}>{getInitials(profile.name)}</Text>
                            </View>
                          )}
                          <View style={{ flex: 1, gap: 4 }}>
                            <TextInput
                              value={replyText}
                              onChangeText={setReplyText}
                              placeholder="Tulis balasan..."
                              placeholderTextColor={colors.placeholder}
                              multiline
                              maxLength={250}
                              style={[styles.textInput, { color: colors.inputText }]}
                              autoFocus
                            />
                            <View style={styles.inputFooter}>
                              <Text
                                style={[
                                  styles.charCounter,
                                  {
                                    color: replyCharCount > 200
                                      ? colors.danger
                                      : replyCharCount > 180
                                      ? "#FFA500"
                                      : colors.subtext,
                                  },
                                ]}
                              >
                                {replyCharCount}/200
                              </Text>
                              <View style={{ flexDirection: "row", gap: 8 }}>
                                <Pressable
                                  onPress={() => setActiveReplyId(null)}
                                  style={styles.cancelReplyButton}
                                >
                                  <Text style={[styles.cancelReplyText, { color: colors.subtext }]}>Batal</Text>
                                </Pressable>
                                <Pressable
                                  onPress={() => handlePostReply(item.id)}
                                  disabled={!replyText.trim() || replyCharCount > 200 || submittingReply}
                                  style={({ pressed }) => [
                                    styles.sendButton,
                                    {
                                      backgroundColor:
                                        !replyText.trim() || replyCharCount > 200
                                          ? colors.chip
                                          : colors.accent,
                                      opacity: pressed ? 0.8 : 1,
                                    },
                                  ]}
                                >
                                  {submittingReply ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                  ) : (
                                    <Text style={styles.sendButtonText}>Balas</Text>
                                  )}
                                </Pressable>
                              </View>
                            </View>
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {/* Load More Button */}
          {page < lastPage && (
            <Pressable
              onPress={() => void loadComments(page + 1)}
              disabled={loadingMore}
              style={({ pressed }) => [
                styles.loadMoreButton,
                {
                  backgroundColor: colors.chip,
                  borderColor: colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color={colors.chipText} />
              ) : (
                <Text style={[styles.loadMoreText, { color: colors.chipText }]}>
                  Muat Lebih Banyak Komentar
                </Text>
              )}
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleText: {
    fontSize: 16,
    fontWeight: "900",
  },
  sortToggleContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(100,100,100,0.06)",
    borderRadius: 8,
    padding: 2,
  },
  sortButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: "800",
  },
  inputCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  inputInnerRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFF",
    fontWeight: "900",
    fontSize: 15,
  },
  textInput: {
    fontSize: 14,
    fontWeight: "500",
    minHeight: 50,
    textAlignVertical: "top",
    padding: 0,
  },
  inputFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  charCounter: {
    fontSize: 11,
    fontWeight: "700",
  },
  sendButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonText: {
    color: "#FFF",
    fontWeight: "900",
    fontSize: 13,
  },
  guestCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    gap: 10,
  },
  guestText: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  guestLoginButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  guestLoginButtonText: {
    fontWeight: "900",
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 18,
  },
  commentItem: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  commentUserRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarCircleSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTextSmall: {
    color: "#FFF",
    fontWeight: "900",
    fontSize: 12,
  },
  userNameText: {
    fontSize: 13,
    fontWeight: "800",
  },
  timeText: {
    fontSize: 11,
    fontWeight: "500",
  },
  reportButton: {
    padding: 4,
  },
  reportedIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 92, 92, 0.08)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  reportedIndicatorText: {
    fontSize: 10,
    fontWeight: "800",
  },
  commentContentText: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  commentFooterRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(100,100,100,0.05)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  likeCountText: {
    fontSize: 12,
    fontWeight: "800",
  },
  loadMoreButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: "800",
  },
  repliesListContainer: {
    marginLeft: 24,
    paddingLeft: 12,
    borderLeftWidth: 2,
    gap: 8,
    marginTop: 4,
  },
  replyItem: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  replyFormContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
    marginTop: 4,
  },
  cancelReplyButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelReplyText: {
    fontSize: 13,
    fontWeight: "700",
  },
  toggleRepliesButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: "flex-start",
  },
  toggleRepliesText: {
    fontSize: 13,
    fontWeight: "700",
  },
  replyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(100,100,100,0.05)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  replyButtonText: {
    fontSize: 12,
    fontWeight: "800",
  },
});
