import React from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Text } from "@/components/ui/app-text";
import { useAppTheme } from "@/src/theme/ThemeContext";
import { getProfile, type AccountProfile } from "@/src/store/account";
import { getToken } from "@/src/store/authToken";
import {
  apiGetComments,
  apiPostComment,
  apiPostReply,
  apiLikeComment,
  apiDeleteComment,
  type ApiComment,
} from "@/src/api/komikamApi";

interface CommentSectionProps {
  mangaId: string;
}

const PROFANITY_WORDS = new Set([
  // Indonesian
  "anjing", "babi", "bangsat", "bajingan", "kontol", "memek", "pepek", "ngentot", "ngewe", "pantek", "perek", "lonte", "jembut", "goblok", "tolol", "peler", "itil", "coli", "asu", "keparat", "brengsek", "pejuh",
  // English
  "fuck", "shit", "bitch", "asshole", "cunt", "bastard", "dick", "pussy", "slut", "whore", "motherfucker"
]);

const SPECIFIC_PROFANITY_SUBSTRINGS = [
  "anjing", "kontol", "memek", "ngentot", "ngewe", "bajingan", "goblok", "tolol", "jembut", "lonte",
  "fuck", "bitch", "cunt", "motherfucker", "asshole"
];

function containsProfanity(text: string): boolean {
  if (!text) return false;
  
  // Normalize leetspeak and symbols
  let normalized = text.toLowerCase()
    .replace(/[0@]/g, "a")
    .replace(/[1!]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[$]/g, "s")
    .replace(/[5]/g, "s");

  // 1. Check direct word matches (split by word boundaries / non-alphanumeric)
  const words = normalized.split(/[^a-z0-9]+/);
  for (const word of words) {
    if (PROFANITY_WORDS.has(word)) {
      return true;
    }
  }

  // 2. Check for bypassed specific words
  const stripped = normalized.replace(/[^a-z0-9]/g, "");
  for (const badWord of SPECIFIC_PROFANITY_SUBSTRINGS) {
    if (stripped.includes(badWord)) {
      return true;
    }
  }

  return false;
}

export default function CommentSection({ mangaId }: CommentSectionProps) {
  const router = useRouter();
  const { resolved } = useAppTheme();
  const isDark = resolved === "dark";
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 600;

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
  const [sort, setSort] = React.useState<"latest" | "popular" | "oldest">("latest");
  const [commentText, setCommentText] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // New states for reply feature
  const [activeReplyId, setActiveReplyId] = React.useState<number | null>(null);
  const [replyText, setReplyText] = React.useState("");
  const [submittingReply, setSubmittingReply] = React.useState(false);
  const [expandedCommentIds, setExpandedCommentIds] = React.useState<Record<number, boolean>>({});
  const [menuTarget, setMenuTarget] = React.useState<{ id: number; parentId: number | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: number; parentId: number | null } | null>(null);

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

        setComments((prev) => {
          const combined = isRefresh || pageNum === 1 ? res.data : [...prev, ...res.data];
          return combined.slice(0, 100);
        });
        setPage(res.current_page);
        setLastPage(res.last_page);
        setTotal(Math.min(res.total, 100));
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
    if (!trimmed || trimmed.length > 100 || submitting) return;

    const token = await getToken();
    if (!token) {
      if (Platform.OS === "web") {
        window.alert("Silakan login terlebih dahulu untuk menulis komentar.");
      } else {
        Alert.alert("Perlu Login", "Silakan login terlebih dahulu untuk menulis komentar.");
      }
      return;
    }

    if (containsProfanity(trimmed)) {
      if (Platform.OS === "web") {
        window.alert("Pesan Anda mengandung kata-kata kasar yang tidak diperbolehkan.");
      } else {
        Alert.alert("Terjadi Kesalahan", "Pesan Anda mengandung kata-kata kasar yang tidak diperbolehkan.");
      }
      return;
    }

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

  const handleOpenMenu = React.useCallback((commentId: number, parentId: number | null) => {
    setMenuTarget({ id: commentId, parentId });
  }, []);

  const handleMenuDeleteSelect = React.useCallback(() => {
    if (!menuTarget) return;
    setDeleteTarget(menuTarget);
    setMenuTarget(null);
  }, [menuTarget]);

  const confirmDeleteComment = React.useCallback(async () => {
    if (!deleteTarget) return;
    const { id: commentId, parentId } = deleteTarget;
    try {
      await apiDeleteComment(commentId);
      if (parentId === null) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        setTotal((prev) => Math.max(0, prev - 1));
      } else {
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === parentId) {
              return {
                ...c,
                replies: c.replies?.filter((r) => r.id !== commentId) || [],
              };
            }
            return c;
          })
        );
      }
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : "Gagal menghapus komentar";
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Terjadi Kesalahan", msg);
      }
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget]);

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

    if (actualLength > 100) {
      if (Platform.OS === "web") {
        window.alert("Balasan tidak boleh lebih dari 100 karakter.");
      } else {
        Alert.alert("Terjadi Kesalahan", "Balasan tidak boleh lebih dari 100 karakter.");
      }
      return;
    }

    if (containsProfanity(trimmed)) {
      if (Platform.OS === "web") {
        window.alert("Pesan Anda mengandung kata-kata kasar yang tidak diperbolehkan.");
      } else {
        Alert.alert("Terjadi Kesalahan", "Pesan Anda mengandung kata-kata kasar yang tidak diperbolehkan.");
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
  const isInputOverLimit = inputCharCount > 100;

  return (
    <View style={styles.container}>
      {/* Header & Sort Toggle */}
      <View
        style={[
          styles.headerRow,
          {
            flexDirection: isSmallScreen ? "column" : "row",
            alignItems: isSmallScreen ? "stretch" : "center",
            gap: isSmallScreen ? 12 : 8,
          }
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="chatbubbles-outline" size={20} color={colors.text} />
          <Text style={[styles.titleText, { color: colors.text }]}>
            Komentar ({total})
          </Text>
        </View>

        <View
          style={[
            styles.sortToggleContainer,
            {
              alignSelf: isSmallScreen ? "stretch" : "auto",
            }
          ]}
        >
          {[
            { mode: "latest" as const, label: "Terbaru" },
            { mode: "oldest" as const, label: "Terlama" },
            { mode: "popular" as const, label: "Terpopuler" },
          ].map(({ mode, label }) => (
            <Pressable
              key={mode}
              onPress={() => setSort(mode)}
              style={[
                styles.sortButton,
                { flex: isSmallScreen ? 1 : undefined, alignItems: "center" },
                sort === mode && { backgroundColor: colors.button },
              ]}
            >
              <Text
                style={[
                  styles.sortButtonText,
                  { color: sort === mode ? colors.buttonText : colors.subtext },
                ]}
              >
                {label}
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
                maxLength={100}
                style={[styles.textInput, { color: colors.inputText }]}
              />

              <View style={styles.inputFooter}>
                <Text
                  style={[
                    styles.charCounter,
                    {
                      color: inputCharCount > 100
                        ? colors.danger
                        : inputCharCount > 90
                        ? "#FFA500"
                        : colors.subtext,
                    },
                  ]}
                >
                  {inputCharCount}/100
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

                    {/* Titik tiga icon untuk pemilik komentar */}
                    {profile && item.user_id === profile.id ? (
                      <Pressable
                        onPress={() => handleOpenMenu(item.id, null)}
                        style={({ pressed }) => ({
                          padding: 6,
                          opacity: pressed ? 0.6 : 1,
                        })}
                      >
                        <Ionicons
                          name="ellipsis-vertical"
                          size={18}
                          color={colors.subtext}
                        />
                      </Pressable>
                    ) : null}
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

                            {/* Titik tiga icon untuk pemilik komentar balasan */}
                            {profile && reply.user_id === profile.id ? (
                              <Pressable
                                onPress={() => handleOpenMenu(reply.id, item.id)}
                                style={({ pressed }) => ({
                                  padding: 6,
                                  opacity: pressed ? 0.6 : 1,
                                })}
                              >
                                <Ionicons
                                  name="ellipsis-vertical"
                                  size={18}
                                  color={colors.subtext}
                                />
                              </Pressable>
                            ) : null}
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
                              maxLength={100}
                              style={[styles.textInput, { color: colors.inputText }]}
                              autoFocus
                            />
                            <View style={styles.inputFooter}>
                              <Text
                                style={[
                                  styles.charCounter,
                                  {
                                    color: replyCharCount > 100
                                      ? colors.danger
                                      : replyCharCount > 90
                                      ? "#FFA500"
                                      : colors.subtext,
                                  },
                                ]}
                              >
                                {replyCharCount}/100
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
                                  disabled={!replyText.trim() || replyCharCount > 100 || submittingReply}
                                  style={({ pressed }) => [
                                    styles.sendButton,
                                    {
                                      backgroundColor:
                                        !replyText.trim() || replyCharCount > 100
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
          {page < lastPage && comments.length < 100 ? (
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
          ) : (
            comments.length >= 100 && (
              <Text style={{ textAlign: "center", color: colors.subtext, fontSize: 12, marginTop: 10 }}>
                *Maksimal 100 komentar yang ditampilkan
              </Text>
            )
          )}
        </View>
      )}

      {/* ── Menu Aksi Komentar Modal ── */}
      <Modal
        visible={menuTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuTarget(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setMenuTarget(null)}
        >
          <View style={[styles.menuContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.menuTitle, { color: colors.subtext }]}>Pilih Aksi</Text>
            
            <Pressable
              onPress={handleMenuDeleteSelect}
              style={({ pressed }) => [
                styles.menuItem,
                pressed && { backgroundColor: isDark ? "rgba(255, 92, 92, 0.1)" : "rgba(211, 47, 47, 0.1)" }
              ]}
            >
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
              <Text style={[styles.menuItemText, { color: colors.danger }]}>Hapus Komentar</Text>
            </Pressable>

            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

            <Pressable
              onPress={() => setMenuTarget(null)}
              style={({ pressed }) => [
                styles.menuItem,
                pressed && { backgroundColor: colors.border }
              ]}
            >
              <Ionicons name="close-outline" size={20} color={colors.text} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>Batal</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ── Custom Centered Confirm Delete Modal ── */}
      <Modal
        visible={deleteTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.warningIconBg, { backgroundColor: isDark ? "rgba(255, 92, 92, 0.15)" : "rgba(211, 47, 47, 0.15)" }]}>
              <Ionicons name="alert-circle" size={32} color={colors.danger} />
            </View>

            <Text style={[styles.confirmTitle, { color: colors.text }]}>Hapus Komentar?</Text>
            <Text style={[styles.confirmDesc, { color: colors.subtext }]}>
              Apakah Anda yakin ingin menghapus komentar ini? Tindakan ini tidak dapat dibatalkan.
            </Text>

            <View style={styles.confirmActionsRow}>
              <Pressable
                onPress={() => setDeleteTarget(null)}
                style={({ pressed }) => [
                  styles.confirmCancelBtn,
                  { backgroundColor: isDark ? "#242434" : "#EFE6DA" },
                  pressed && { opacity: 0.8 }
                ]}
              >
                <Text style={[styles.confirmCancelBtnText, { color: colors.text }]}>Batal</Text>
              </Pressable>

              <Pressable
                onPress={confirmDeleteComment}
                style={({ pressed }) => [
                  styles.confirmDeleteBtn,
                  { backgroundColor: colors.danger },
                  pressed && { opacity: 0.8 }
                ]}
              >
                <Text style={styles.confirmDeleteBtnText}>Hapus</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  menuContainer: {
    width: "100%",
    maxWidth: 280,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  menuTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "700",
  },
  menuDivider: {
    height: 1,
    marginVertical: 4,
  },
  confirmContainer: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  warningIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 8,
    textAlign: "center",
  },
  confirmDesc: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  confirmActionsRow: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
  },
  confirmCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmCancelBtnText: {
    fontSize: 15,
    fontWeight: "800",
  },
  confirmDeleteBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmDeleteBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
