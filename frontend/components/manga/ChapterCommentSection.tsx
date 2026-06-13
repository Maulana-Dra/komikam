import React from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Text } from "@/components/ui/app-text";
import { getProfile, type AccountProfile } from "@/src/store/account";
import {
  apiGetComments,
  apiPostComment,
  apiPostReply,
  apiLikeComment,
  type ApiComment,
} from "@/src/api/komikamApi";

interface ChapterCommentSectionProps {
  mangaId: string;
  chapterId: string;
  chapterNumber?: string | number;
  isNested?: boolean;
  readerBg?: "black" | "dark" | "white";
}

// Dark color palette khusus untuk reader
const DARK = {
  bg: "#0B0B0E",
  card: "#14141C",
  text: "#F2F2F7",
  subtext: "#9494A8",
  border: "rgba(255,255,255,0.08)",
  chip: "#1E1E2A",
  chipText: "#9494A8",
  button: "#F2F2F7",
  buttonText: "#111111",
  ghost: "#1A1A28",
  ghostText: "#F2F2F7",
  inputBg: "#12121A",
  inputText: "#F2F2F7",
  placeholder: "#5C5C72",
  accent: "#4A8FE2",
  danger: "#FF5C5C",
};

const LIGHT = {
  bg: "#FFF",
  card: "#F6F1E9",
  text: "#1E2329",
  subtext: "#6A625A",
  border: "rgba(0,0,0,0.08)",
  chip: "#EFE6DA",
  chipText: "#6A625A",
  button: "#1E2329",
  buttonText: "#FFF",
  ghost: "#E6DED2",
  ghostText: "#1E2329",
  inputBg: "#FBF6EE",
  inputText: "#1E2329",
  placeholder: "#A8A095",
  accent: "#4A8FE2",
  danger: "#FF5C5C",
};

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

export default function ChapterCommentSection({
  mangaId,
  chapterId,
  chapterNumber,
  isNested = false,
  readerBg = "black",
}: ChapterCommentSectionProps) {
  const router = useRouter();
  const colors = readerBg === "white" ? LIGHT : DARK;

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

  // Reply states
  const [activeReplyId, setActiveReplyId] = React.useState<number | null>(null);
  const [replyText, setReplyText] = React.useState("");
  const [submittingReply, setSubmittingReply] = React.useState(false);
  const [expandedIds, setExpandedIds] = React.useState<Record<number, boolean>>({});

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

  const replyCharCount = React.useMemo(() => {
    if (!targetComment) return replyText.length;
    const prefix = `@${targetComment.user_name} `;
    if (replyText.startsWith(prefix)) return replyText.slice(prefix.length).length;
    return replyText.length;
  }, [replyText, targetComment]);

  // Load profile
  React.useEffect(() => {
    void getProfile().then(setProfile).catch(() => {});
  }, []);

  // Load comments
  const loadComments = React.useCallback(
    async (pageNum: number, isRefresh = false) => {
      try {
        if (pageNum === 1 && !isRefresh) setLoading(true);
        else if (pageNum > 1) setLoadingMore(true);

        const res = await apiGetComments(mangaId, sort, pageNum, chapterId);

        setComments((prev) => {
          const combined = isRefresh || pageNum === 1 ? res.data : [...prev, ...res.data];
          return combined.slice(0, 100);
        });
        setPage(res.current_page);
        setLastPage(res.last_page);
        setTotal(Math.min(res.total, 100));
      } catch (e) {
        console.error("Gagal memuat komentar chapter:", e);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [mangaId, chapterId, sort]
  );

  React.useEffect(() => {
    void loadComments(1, true);
  }, [loadComments]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handlePostComment = React.useCallback(async () => {
    const trimmed = commentText.trim();
    if (!trimmed || trimmed.length > 100 || submitting) return;

    if (containsProfanity(trimmed)) {
      if (Platform.OS === "web") window.alert("Pesan Anda mengandung kata-kata kasar yang tidak diperbolehkan.");
      else Alert.alert("Terjadi Kesalahan", "Pesan Anda mengandung kata-kata kasar yang tidak diperbolehkan.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiPostComment(mangaId, trimmed, chapterId);
      setCommentText("");
      if (sort === "latest") {
        setComments((prev) => [res.comment, ...prev]);
        setTotal((prev) => prev + 1);
      } else {
        await loadComments(1, true);
      }
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : "Gagal mengirim komentar";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Terjadi Kesalahan", msg);
    } finally {
      setSubmitting(false);
    }
  }, [commentText, mangaId, chapterId, sort, loadComments, submitting]);

  const handleReplyPress = React.useCallback(
    (comment: ApiComment) => {
      if (!profile) {
        if (Platform.OS === "web") window.alert("Silakan login terlebih dahulu untuk membalas komentar.");
        else Alert.alert("Perlu Login", "Silakan login terlebih dahulu untuk membalas komentar.");
        return;
      }
      const parentId = comment.parent_id || comment.id;
      setActiveReplyId(comment.id);
      setReplyText(`@${comment.user_name} `);
      setExpandedIds((prev) => ({ ...prev, [parentId]: true }));
    },
    [profile]
  );

  const handlePostReply = React.useCallback(
    async (parentCommentId: number) => {
      const trimmed = replyText.trim();
      if (!trimmed || submittingReply) return;

      let actualLength = trimmed.length;
      let replyToUserId: number | undefined;

      if (targetComment) {
        const prefix = `@${targetComment.user_name} `;
        if (trimmed.startsWith(prefix)) {
          actualLength = trimmed.slice(prefix.length).length;
          replyToUserId = targetComment.user_id;
        }
      }

      if (actualLength > 100) {
        if (Platform.OS === "web") window.alert("Balasan tidak boleh lebih dari 100 karakter.");
        else Alert.alert("Terjadi Kesalahan", "Balasan tidak boleh lebih dari 100 karakter.");
        return;
      }

      if (containsProfanity(trimmed)) {
        if (Platform.OS === "web") window.alert("Pesan Anda mengandung kata-kata kasar yang tidak diperbolehkan.");
        else Alert.alert("Terjadi Kesalahan", "Pesan Anda mengandung kata-kata kasar yang tidak diperbolehkan.");
        return;
      }

      setSubmittingReply(true);
      try {
        const res = await apiPostReply(activeReplyId!, trimmed, replyToUserId);
        setReplyText("");
        setActiveReplyId(null);
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === parentCommentId) {
              return { ...c, replies: [...(c.replies || []), res.comment] };
            }
            return c;
          })
        );
        setExpandedIds((prev) => ({ ...prev, [parentCommentId]: true }));
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : "Gagal mengirim balasan";
        if (Platform.OS === "web") window.alert(msg);
        else Alert.alert("Terjadi Kesalahan", msg);
      } finally {
        setSubmittingReply(false);
      }
    },
    [replyText, submittingReply, activeReplyId, targetComment]
  );

  const handleLike = React.useCallback(
    async (commentId: number) => {
      if (!profile) {
        if (Platform.OS === "web") window.alert("Silakan login terlebih dahulu untuk menyukai komentar.");
        else Alert.alert("Perlu Login", "Silakan login terlebih dahulu untuk menyukai komentar.");
        return;
      }
      // Optimistic update
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === commentId) {
            const next = !c.liked_by_me;
            return { ...c, liked_by_me: next, likes_count: next ? c.likes_count + 1 : Math.max(0, c.likes_count - 1) };
          }
          if (c.replies?.length) {
            return {
              ...c,
              replies: c.replies.map((r) => {
                if (r.id === commentId) {
                  const next = !r.liked_by_me;
                  return { ...r, liked_by_me: next, likes_count: next ? r.likes_count + 1 : Math.max(0, r.likes_count - 1) };
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
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === commentId) return { ...c, liked_by_me: res.liked, likes_count: res.likes_count };
            if (c.replies?.length) {
              return {
                ...c,
                replies: c.replies.map((r) =>
                  r.id === commentId ? { ...r, liked_by_me: res.liked, likes_count: res.likes_count } : r
                ),
              };
            }
            return c;
          })
        );
      } catch {
        void loadComments(1, true);
      }
    },
    [profile, loadComments]
  );



  // ── Helpers ───────────────────────────────────────────────────────────────

  const getAvatarBg = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const palette = ["#FF5E36", "#FF9F43", "#1DD1A1", "#54A0FF", "#5F27CD", "#00D2D3", "#FF6B6B", "#48DBFB", "#10AC84", "#576574"];
    return palette[Math.abs(hash) % palette.length];
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const formatTime = (dateStr: string) => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      if (diffMs < 0) return "Baru saja";
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return "Baru saja";
      if (mins < 60) return `${mins}m lalu`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}j lalu`;
      const days = Math.floor(hrs / 24);
      if (days < 7) return `${days} hari lalu`;
      return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return "-";
    }
  };

  const inputLen = commentText.length;
  const inputOver = inputLen > 100;

  // ── Render Helpers ────────────────────────────────────────────────────────

  const renderAvatar = (name: string, small = false) => (
    <View style={[small ? s.avatarSm : s.avatar, { backgroundColor: getAvatarBg(name) }]}>
      <Text style={small ? s.avatarTextSm : s.avatarText}>{getInitials(name)}</Text>
    </View>
  );

  const renderComment = (item: ApiComment, isReply = false) => {
    const isFormActive = activeReplyId === item.id || (item.replies?.some((r) => r.id === activeReplyId) ?? false);

    return (
      <View key={`cmt-${item.id}`} style={{ gap: 6 }}>
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }, isReply && s.replyCard]}>
          {/* Header */}
          <View style={s.cardHeader}>
            <View style={s.userRow}>
              {renderAvatar(item.user_name, true)}
              <View style={{ gap: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                  <Text style={[s.userName, { color: colors.text }]}>{item.user_name}</Text>
                  {item.reply_to_username && (
                    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.accent }}>
                      → @{item.reply_to_username}
                    </Text>
                  )}
                </View>
                <Text style={[s.time, { color: colors.subtext }]}>{formatTime(item.created_at)}</Text>
              </View>
            </View>


          </View>

          {/* Content */}
          <Text style={[s.content, { color: colors.text }]}>{item.content}</Text>

          {/* Footer */}
          <View style={s.footer}>
            <Pressable
              onPress={() => handleLike(item.id)}
              style={({ pressed }) => [s.likeBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons
                name={item.liked_by_me ? "heart" : "heart-outline"}
                size={15}
                color={item.liked_by_me ? colors.accent : colors.subtext}
              />
              <Text style={[s.likeCount, { color: item.liked_by_me ? colors.accent : colors.subtext }]}>
                {item.likes_count}
              </Text>
            </Pressable>

            {!isReply && (
              <Pressable
                onPress={() => handleReplyPress(item)}
                style={({ pressed }) => [s.replyBtn, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Ionicons name="chatbubble-outline" size={14} color={colors.subtext} />
                <Text style={[s.replyBtnText, { color: colors.subtext }]}>Balas</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Toggle & nested replies */}
        {!isReply && item.replies && item.replies.length > 0 && (
          <Pressable
            onPress={() => setExpandedIds((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
            style={s.toggleBtn}
          >
            <Ionicons
              name={expandedIds[item.id] ? "chevron-up" : "chevron-down"}
              size={15}
              color={colors.accent}
            />
            <Text style={[s.toggleText, { color: colors.accent }]}>
              {expandedIds[item.id] ? "Sembunyikan balasan" : `Lihat ${item.replies.length} balasan`}
            </Text>
          </Pressable>
        )}

        {!isReply && (expandedIds[item.id] || isFormActive) && (
          <View style={[s.repliesContainer, { borderLeftColor: colors.border }]}>
            {expandedIds[item.id] && item.replies?.map((reply) => renderComment(reply, true))}

            {/* Reply input form */}
            {isFormActive && (
              <View style={[s.replyForm, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={s.inputRow}>
                  {profile && renderAvatar(profile.name, true)}
                  <View style={{ flex: 1, gap: 4 }}>
                    <TextInput
                      value={replyText}
                      onChangeText={setReplyText}
                      placeholder="Tulis balasan..."
                      placeholderTextColor={colors.placeholder}
                      multiline
                      maxLength={150}
                      style={[s.input, { color: colors.inputText }]}
                      autoFocus
                    />
                    <View style={s.inputFooter}>
                      <Text style={[s.counter, { color: replyCharCount > 100 ? colors.danger : replyCharCount > 90 ? "#FFA500" : colors.subtext }]}>
                        {replyCharCount}/100
                      </Text>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <Pressable onPress={() => setActiveReplyId(null)} style={s.cancelBtn}>
                          <Text style={[s.cancelText, { color: colors.subtext }]}>Batal</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handlePostReply(item.id)}
                          disabled={!replyText.trim() || replyCharCount > 100 || submittingReply}
                          style={({ pressed }) => [
                            s.sendBtn,
                            { backgroundColor: !replyText.trim() || replyCharCount > 100 ? colors.chip : colors.accent, opacity: pressed ? 0.8 : 1 },
                          ]}
                        >
                          {submittingReply ? (
                            <ActivityIndicator size="small" color="#FFF" />
                          ) : (
                            <Text style={s.sendText}>Balas</Text>
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
  };

  // ── Main Render ───────────────────────────────────────────────────────────

  const Container = isNested ? View : ScrollView;
  const containerProps = isNested
    ? { style: { padding: 16, gap: 16, paddingBottom: 40 } }
    : {
        showsVerticalScrollIndicator: false,
        contentContainerStyle: { padding: 16, gap: 16, paddingBottom: 40 },
        keyboardShouldPersistTaps: "handled" as const,
      };

  const { width } = useWindowDimensions();
  const isSmallScreen = width < 600;

  return (
    <View style={{ flex: 1, backgroundColor: "transparent" }}>
      {/* Header */}
      <View
        style={[
          s.header,
          {
            flexDirection: isSmallScreen ? "column" : "row",
            alignItems: isSmallScreen ? "stretch" : "center",
            gap: isSmallScreen ? 12 : 8,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="chatbubbles-outline" size={18} color={colors.text} />
          <Text style={[s.headerTitle, { color: colors.text }]}>
            Ulasan Chapter {chapterNumber ? `${chapterNumber}` : ""} ({total})
          </Text>
        </View>

        {/* Sort toggle */}
        <View
          style={[
            s.sortRow,
            {
              backgroundColor: "rgba(255,255,255,0.06)",
              alignSelf: isSmallScreen ? "stretch" : "auto",
            },
          ]}
        >
          {[
            { mode: "latest" as const, label: "Terbaru" },
            { mode: "oldest" as const, label: "Terlama" },
            { mode: "popular" as const, label: "Populer" },
          ].map(({ mode, label }) => (
            <Pressable
              key={mode}
              onPress={() => setSort(mode)}
              style={[
                s.sortBtn,
                { flex: isSmallScreen ? 1 : undefined, alignItems: "center" },
                sort === mode && { backgroundColor: colors.button },
              ]}
            >
              <Text style={[s.sortText, { color: sort === mode ? colors.buttonText : colors.subtext }]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Container {...containerProps}>
        {/* Input area */}
        {profile ? (
          <View style={[s.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.inputRow}>
              {renderAvatar(profile.name)}
              <View style={{ flex: 1, gap: 4 }}>
                <TextInput
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder="Tulis ulasanmu tentang chapter ini..."
                  placeholderTextColor={colors.placeholder}
                  multiline
                  maxLength={100}
                  style={[s.input, { color: colors.inputText }]}
                />
                <View style={s.inputFooter}>
                  <Text style={[s.counter, { color: inputOver ? colors.danger : inputLen > 90 ? "#FFA500" : colors.subtext }]}>
                    {inputLen}/100
                  </Text>
                  <Pressable
                    onPress={handlePostComment}
                    disabled={!commentText.trim() || inputOver || submitting}
                    style={({ pressed }) => [
                      s.sendBtn,
                      { backgroundColor: !commentText.trim() || inputOver ? colors.chip : colors.accent, opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={s.sendText}>Kirim</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={[s.guestCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="lock-closed-outline" size={22} color={colors.subtext} />
            <Text style={[s.guestText, { color: colors.subtext }]}>
              Masuk ke akun Komikam untuk menulis ulasan dan berinteraksi.
            </Text>
            <Pressable
              onPress={() => router.push("/account")}
              style={({ pressed }) => [s.guestBtn, { backgroundColor: colors.button, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[s.guestBtnText, { color: colors.buttonText }]}>Masuk Akun</Text>
            </Pressable>
          </View>
        )}

        {/* Comments */}
        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator color={colors.accent} />
            <Text style={{ color: colors.subtext, marginTop: 8 }}>Memuat ulasan...</Text>
          </View>
        ) : comments.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="chatbubble-ellipses-outline" size={44} color={colors.chipText} />
            <Text style={[s.emptyText, { color: colors.subtext }]}>
              Belum ada ulasan untuk chapter ini. Jadilah yang pertama!
            </Text>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            {comments.map((item) => renderComment(item))}

            {page < lastPage && comments.length < 100 ? (
              <Pressable
                onPress={() => void loadComments(page + 1)}
                disabled={loadingMore}
                style={({ pressed }) => [
                  s.loadMoreBtn,
                  { backgroundColor: colors.chip, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color={colors.chipText} />
                ) : (
                  <Text style={[s.loadMoreText, { color: colors.chipText }]}>Muat Lebih Banyak</Text>
                )}
              </Pressable>
            ) : (
              comments.length >= 100 && (
                <Text style={{ textAlign: "center", color: colors.subtext, fontSize: 12, marginTop: 10 }}>
                  *Maksimal 100 ulasan yang ditampilkan
                </Text>
              )
            )}
          </View>
        )}
      </Container>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  sortRow: {
    flexDirection: "row",
    borderRadius: 8,
    padding: 2,
  },
  sortBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  sortText: {
    fontSize: 12,
    fontWeight: "800",
  },
  inputCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  inputRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFF",
    fontWeight: "900",
    fontSize: 14,
  },
  avatarSm: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTextSm: {
    color: "#FFF",
    fontWeight: "900",
    fontSize: 11,
  },
  input: {
    fontSize: 14,
    fontWeight: "500",
    minHeight: 48,
    textAlignVertical: "top",
    padding: 0,
  },
  inputFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  counter: {
    fontSize: 11,
    fontWeight: "700",
  },
  sendBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: {
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
  },
  guestBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  guestBtnText: {
    fontWeight: "900",
    fontSize: 13,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 18,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  replyCard: {
    borderRadius: 12,
    padding: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userName: {
    fontSize: 13,
    fontWeight: "800",
  },
  time: {
    fontSize: 11,
    fontWeight: "500",
  },
  reported: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255,92,92,0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  reportedText: {
    fontSize: 10,
    fontWeight: "800",
  },
  content: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  likeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  likeCount: {
    fontSize: 12,
    fontWeight: "800",
  },
  replyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  replyBtnText: {
    fontSize: 12,
    fontWeight: "800",
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: "flex-start",
  },
  toggleText: {
    fontSize: 13,
    fontWeight: "700",
  },
  repliesContainer: {
    marginLeft: 20,
    paddingLeft: 12,
    borderLeftWidth: 2,
    gap: 8,
    marginTop: 2,
  },
  replyForm: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 6,
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 13,
    fontWeight: "700",
  },
  loadMoreBtn: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: "800",
  },
});
