import { useFocusEffect } from "@react-navigation/native";
import { Image as ExpoImage } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
  Platform
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";

import { Text } from "@/components/ui/app-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAppTheme } from "@/src/theme/ThemeContext";
import { getChapterList, getMangaDetail } from "../../src/api/shngmClient";
import type { ShngmChapter, ShngmManga } from "../../src/api/shngmTypes";
import { isBookmarked, toggleBookmark } from "../../src/store/bookmarks";
import { getLatestProgressByManga, getReadChaptersLocal } from "../../src/store/history";
import { getToken } from "../../src/store/authToken";
import CommentSection from "@/components/manga/CommentSection";
import { useQuery } from '@tanstack/react-query';
import { isChapterDownloaded, downloadChapter, deleteDownloadedChapter } from "@/src/utils/downloader";

type ResumeState = {
  chapterId: string;
  chapterNumber: number;
  pageIndex: number;
  totalPages: number;
} | null;

type ScreenState = {
  chapters: ShngmChapter[];
  allChapters: ShngmChapter[];
  page: number;
  totalPage: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
};

function isOfflineError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("network request failed") ||
      msg.includes("failed to fetch") ||
      msg.includes("networkerror") ||
      msg.includes("offline")
    );
  }
  return false;
}

export default function MangaDetailScreen() {
  const { mangaId, title, description, coverUrl, countryId, userRate } =
    useLocalSearchParams<{
      mangaId: string;
      title?: string;
      description?: string;
      coverUrl?: string;
      countryId?: string;
      userRate?: string;
    }>();
  const id = typeof mangaId === "string" ? mangaId : "";

  const router = useRouter();
  const { resolved } = useAppTheme();
  const isDark = resolved === "dark";
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 768;
  const contentPadding = isWide ? 24 : 16;

  const colors = React.useMemo(
    () => ({
      bg: isDark ? "#0B0B0E" : "#F6F1E9",
      card: isDark ? "#121218" : "#FBF6EE",
      text: isDark ? "#F2F2F7" : "#1E2329",
      subtext: isDark ? "#B3B3C2" : "#6A625A",
      border: isDark ? "#242434" : "#E6DED2",
      chip: isDark ? "#1A1A24" : "#EFE6DA",
      button: isDark ? "#F2F2F7" : "#1E2A3A",
      buttonText: isDark ? "#111111" : "#F7F2EA",
      ghost: isDark ? "#1A1A24" : "#F2E9DD",
      ghostText: isDark ? "#F2F2F7" : "#1E2329",
      inputBg: isDark ? "#121218" : "#FBF5EC",
      inputText: isDark ? "#F2F2F7" : "#1E2329",
      placeholder: isDark ? "#7E7E91" : "#9A8F83",
      shimmerBase: isDark ? "#1A1A24" : "#EFE6DA",
      shimmerHighlight: isDark ? "#2A2A36" : "#F7F1E8",
      primary: isDark ? "#00FFF5" : "#1D1135",
      primaryText: isDark ? "#1D1135" : "#F7F2EA",
    }),
    [isDark],
  );

  const [resume, setResume] = React.useState<ResumeState>(null);
  const [bookmarked, setBookmarked] = React.useState<boolean>(false);
  const [descExpanded, setDescExpanded] = React.useState(false);
  const [sortDir, setSortDir] = React.useState<"desc" | "asc">("desc");
  const [toast, setToast] = React.useState<string | null>(null);
  const [offline, setOffline] = React.useState(false);
  const [readChapters, setReadChapters] = React.useState<string[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [firstChapter, setFirstChapter] = React.useState<ShngmChapter | null>(null);

  const [customAlert, setCustomAlert] = React.useState<{
    visible: boolean;
    title: string;
    description: string;
    type?: "info" | "confirm" | "error";
    onConfirm?: () => void;
  } | null>(null);

  const showAlert = React.useCallback(
    (title: string, description: string, type: "info" | "confirm" | "error" = "info", onConfirm?: () => void) => {
      setCustomAlert({ visible: true, title, description, type, onConfirm });
    },
    []
  );

  const shimmer = React.useRef(new Animated.Value(0)).current;
  const SHIMMER_WIDTH = 140;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const shimmerOverlayStyle = (width: number, radius: number) => ({
    position: "absolute" as const,
    top: 0,
    bottom: 0,
    width: SHIMMER_WIDTH,
    borderRadius: radius,
    backgroundColor: colors.shimmerHighlight,
    opacity: 0.85,
    transform: [
      {
        translateX: shimmer.interpolate({
          inputRange: [0, 1],
          outputRange: [-SHIMMER_WIDTH, width + SHIMMER_WIDTH],
        }),
      },
    ],
  });

  const { data: mangaDetail } = useQuery({
    queryKey: ['mangaDetail', id],
    queryFn: () => getMangaDetail(id!).then(res => res.data),
    enabled: !!id,
  });

  const [state, setState] = React.useState<ScreenState>({
    chapters: [],
    allChapters: [],
    page: 1,
    totalPage: 1,
    loading: true,
    loadingMore: false,
    error: null,
  });

  const [downloadedChapters, setDownloadedChapters] = React.useState<Record<string, boolean>>({});
  const [downloadProgress, setDownloadProgress] = React.useState<Record<string, number>>({});

  // Batch-check downloaded chapters — native only (web has no download feature)
  React.useEffect(() => {
    if (Platform.OS === 'web' || state.chapters.length === 0 || !id) return;
    let alive = true;
    void (async () => {
      const mapping: Record<string, boolean> = {};
      try {
        const FileSystem = require('expo-file-system/src/legacy');
        const mangaDir = `${FileSystem.documentDirectory}downloaded_manga/${id}`;
        const dirInfo = await FileSystem.getInfoAsync(mangaDir);
        if (dirInfo.exists) {
          const downloadedIds = await FileSystem.readDirectoryAsync(mangaDir + '/');
          for (const ch of state.chapters) {
            if (downloadedIds.includes(ch.chapter_id)) {
              mapping[ch.chapter_id] = await isChapterDownloaded(id, ch.chapter_id);
            } else {
              mapping[ch.chapter_id] = false;
            }
          }
        } else {
          for (const ch of state.chapters) {
            mapping[ch.chapter_id] = false;
          }
        }
      } catch (err) {
        console.error("Failed to batch check downloaded chapters:", err);
        for (const ch of state.chapters) {
          mapping[ch.chapter_id] = await isChapterDownloaded(id, ch.chapter_id);
        }
      }
      if (alive) setDownloadedChapters(mapping);
    })();
    return () => { alive = false; };
  }, [state.chapters, id]);

  const handleDownload = React.useCallback(async (chapterId: string) => {
    if (!id || Platform.OS === 'web') return;

    const token = await getToken();
    if (!token) {
      showAlert("Perlu Login", "Silakan login terlebih dahulu untuk mengunduh chapter.", "info");
      return;
    }

    const isDownloaded = downloadedChapters[chapterId];

    if (isDownloaded) {
      showAlert(
        "Hapus Unduhan?",
        "Apakah Anda yakin ingin menghapus chapter ini dari penyimpanan lokal?",
        "confirm",
        async () => {
          await deleteDownloadedChapter(id, chapterId);
          setDownloadedChapters(prev => ({ ...prev, [chapterId]: false }));
          setToast("Unduhan dihapus");
        }
      );
    } else {
      try {
        setDownloadProgress(prev => ({ ...prev, [chapterId]: 0 }));
        const mTitle = typeof title === "string" ? title : (mangaDetail?.title || "Manga");
        const mCover = typeof coverUrl === "string" ? coverUrl : (mangaDetail?.cover_portrait_url || mangaDetail?.cover_image_url || "");
        await downloadChapter(id, chapterId, mTitle, mCover, (progress) => {
          setDownloadProgress(prev => ({ ...prev, [chapterId]: progress }));
        });
        setDownloadedChapters(prev => ({ ...prev, [chapterId]: true }));
        setToast("Unduhan selesai!");
      } catch (err) {
        showAlert("Gagal Mengunduh", err instanceof Error ? err.message : "Kesalahan tidak dikenal", "error");
      } finally {
        setDownloadProgress(prev => {
          const next = { ...prev };
          delete next[chapterId];
          return next;
        });
      }
    }
  }, [id, downloadedChapters, title, coverUrl, mangaDetail, showAlert]);

  const [chapterOffset, setChapterOffset] = React.useState(0);

  const routeTitle = typeof title === "string" ? title : "";
  const routeDescription = typeof description === "string" ? description : "";
  const routeCoverUrl = typeof coverUrl === "string" ? coverUrl : "";
  const routeCountryId = typeof countryId === "string" ? countryId : "";
  const parsedUserRate =
    typeof userRate === "string" && userRate.trim() !== ""
      ? parseFloat(userRate)
      : null;

  const displayTitle = mangaDetail?.title || routeTitle || "Manga";
  const displayDescription =
    mangaDetail?.description || routeDescription || "-";
  const displayCover =
    mangaDetail?.cover_portrait_url ??
    mangaDetail?.cover_image_url ??
    routeCoverUrl ??
    "";
  const displayCountryId = mangaDetail?.country_id || routeCountryId;
  const displayUserRate =
    typeof mangaDetail?.user_rate === "number"
      ? mangaDetail.user_rate
      : Number.isFinite(parsedUserRate) ? parsedUserRate : null;

  // --- Helper format angka (1200 → "1.2K") ---
  function formatCount(n: number): string {
    if (n >= 1_000_000)
      return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
    return String(n);
  }

  // --- Derived metadata dari API detail ---
  const displayMeta = React.useMemo(() => {
    const m = mangaDetail;
    if (!m) return null;
    return {
      genres: (m.taxonomy.Genre ?? []).filter((g) => g.name),
      authors: (m.taxonomy.Author ?? []).filter((a) => a.name),
      artists: (m.taxonomy.Artist ?? []).filter((a) => a.name),
      formats: (m.taxonomy.Format ?? []).filter((a) => a.name),
      types: (m.taxonomy.Type ?? []).filter((a) => a.name),
      status: m.status, // 1=Ongoing, 2=Completed, 0=Unknown
      year: m.release_year,
      views: m.view_count,
      bookmarks: m.bookmark_count,
    };
  }, [mangaDetail]);

  const metadataSections = React.useMemo(() => {
    if (!displayMeta) return [];
    const list = [];

    // Genre
    if (displayMeta.genres && displayMeta.genres.length > 0) {
      list.push({
        key: "genres",
        label: "Genre",
        items: displayMeta.genres.map((g) => g.name),
      });
    }

    // Author
    if (displayMeta.authors) {
      list.push({
        key: "authors",
        label: "Author",
        items: displayMeta.authors.length > 0 ? displayMeta.authors.map((a) => a.name) : ["Menyusul"],
      });
    }

    // Artist
    if (displayMeta.artists) {
      list.push({
        key: "artists",
        label: "Artist",
        items: displayMeta.artists.length > 0 ? displayMeta.artists.map((a) => a.name) : ["Menyusul"],
      });
    }

    // Format
    if (displayMeta.formats && displayMeta.formats.length > 0) {
      list.push({
        key: "formats",
        label: "Format",
        items: displayMeta.formats.map((f) => f.name),
      });
    }

    // Type
    if (displayMeta.types && displayMeta.types.length > 0) {
      list.push({
        key: "types",
        label: "Type",
        items: displayMeta.types.map((t) => t.name),
      });
    }

    // Country
    if (displayCountryId) {
      list.push({
        key: "country",
        label: "Country",
        items: [displayCountryId],
      });
    }

    return list;
  }, [displayMeta, displayCountryId]);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const loadResume = React.useCallback(async () => {
    if (!id) return;

    const token = await getToken();
    if (!token) {
      setResume(null);
      const localRead = await getReadChaptersLocal(id);
      setReadChapters(localRead);
      return;
    }

    const [progress, localRead] = await Promise.all([
      getLatestProgressByManga(id),
      getReadChaptersLocal(id),
    ]);
    setReadChapters(localRead);
    setResume(
      progress
        ? {
            chapterId: progress.chapterId,
            chapterNumber: progress.chapterNumber,
            pageIndex: progress.pageIndex,
            totalPages: progress.totalPages,
          }
        : null,
    );
  }, [id]);

  const loadBookmarkState = React.useCallback(async () => {
    if (!id) return;
    const bm = await isBookmarked(id);
    setBookmarked(bm);
  }, [id]);

  const load = React.useCallback(async () => {
    if (!id) return;

    try {
      setState((s) => ({ ...s, loading: true, error: null }));

      // Ambil chapter terbaru (page 1), dan cari chapter pertama (sort asc)
      const [chapterRes, firstChRes] = await Promise.all([
        getChapterList({ mangaId: id, page: 1, pageSize: 20, sortOrder: sortDir }),
        // Gunakan getChapterList yang sudah ada untuk ambil chapter paling awal
        getChapterList({ mangaId: id, page: 1, pageSize: 1, sortOrder: "asc" }).catch(() => null)
      ]);

      if (firstChRes && firstChRes.retcode === 0 && firstChRes.data.length > 0) {
        setFirstChapter(firstChRes.data[0]);
      }

      setState((s) => ({
        ...s,
        chapters: chapterRes.data,
        page: chapterRes.meta.page,
        totalPage: chapterRes.meta.total_page,
        loading: false,
        loadingMore: false,
        error: null,
      }));
      setOffline(false);

      await Promise.all([loadResume(), loadBookmarkState()]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (isOfflineError(e)) setOffline(true);
      setState((s) => ({
        ...s,
        loading: false,
        loadingMore: false,
        error: msg,
      }));
    }
  }, [id, sortDir, loadResume, loadBookmarkState]);

  const loadChapters = React.useCallback(async (pageNum: number) => {
    if (!id) return;

    try {
      setState((s) => ({ ...s, loadingMore: true, error: null }));

      const res = await getChapterList({
        mangaId: id,
        page: pageNum,
        pageSize: 25,
        sortOrder: sortDir,
      });

      setState((s) => ({
        ...s,
        chapters: res.data,
        page: res.meta.page,
        totalPage: res.meta.total_page,
        loadingMore: false,
      }));
      setOffline(false);
      setTimeout(() => {
        listRef.current?.scrollToOffset({ offset: chapterOffset, animated: true });
      }, 50);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (isOfflineError(e)) setOffline(true);
      setState((s) => ({ ...s, loadingMore: false, error: msg }));
    }
  }, [id, sortDir, chapterOffset]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Load all chapters in background after initial page loading finishes
  React.useEffect(() => {
    if (state.loading || !id) return;

    const loadAll = async () => {
      try {
        const res = await getChapterList({
          mangaId: id,
          page: 1,
          pageSize: 5000,
          sortOrder: sortDir,
        });
        setState((s) => ({
          ...s,
          allChapters: res.data,
        }));
      } catch (e) {
        console.warn("Background load of all chapters failed:", e);
      }
    };

    void loadAll();
  }, [state.loading, id, sortDir]);

  // saat balik ke screen ini dari reader / tab lain, refresh resume + bookmark
  useFocusEffect(
    React.useCallback(() => {
      void loadResume();
      void loadBookmarkState();
    }, [loadResume, loadBookmarkState]),
  );

  const showDescToggle = displayDescription.length > 140;
  const orderedChapters = React.useMemo(() => {
    // Jika sedang mencari, lakukan filter pada seluruh list chapter (allChapters)
    // Jika tidak sedang mencari, gunakan list chapter per halaman (chapters)
    const source = searchQuery.trim() !== "" && state.allChapters.length > 0
      ? state.allChapters
      : state.chapters;

    let copy = [...source];

    if (searchQuery.trim() !== "") {
      const q = searchQuery.trim().toLowerCase();
      copy = copy.filter((c) => {
        const numStr = String(c.chapter_number ?? "");
        const titleStr = String(c.chapter_title ?? "").toLowerCase();
        return numStr.includes(q) || titleStr.includes(q);
      });
    }

    copy.sort((a, b) => {
      const aNum = typeof a.chapter_number === "number" ? a.chapter_number : 0;
      const bNum = typeof b.chapter_number === "number" ? b.chapter_number : 0;
      return sortDir === "desc" ? bNum - aNum : aNum - bNum;
    });
    return copy;
  }, [state.chapters, state.allChapters, sortDir, searchQuery]);

  const listRef = React.useRef<FlatList<ShngmChapter>>(null);

  const resumeCta = resume ? (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/reader/[chapterId]",
          params: {
            chapterId: resume.chapterId,
            mangaTitle: displayTitle,
            coverUrl: displayCover,
            mangaId: id,
          },
        })
      }
      style={{
        backgroundColor: colors.button,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      <IconSymbol name="play.fill" size={18} color={colors.buttonText} />
      <Text style={{ color: colors.buttonText, fontWeight: "900" }}>
        Lanjutkan: Chapter {resume.chapterNumber}
      </Text>
    </Pressable>
  ) : null;
  const bottomInset = insets.bottom + (resume ? 100 : 0) + (toast ? 60 : 0) + 40;

  if (state.loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
          <View style={{ width: "100%", maxWidth: 1000, alignSelf: "center", paddingHorizontal: contentPadding, paddingTop: insets.top + 24, gap: 16 }}>
            {/* Header Detail Skeleton */}
            <View
              style={{
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                padding: 16,
                flexDirection: "row",
                gap: 16,
              }}
            >
              <View
                style={{
                  width: 96,
                  height: 128,
                  borderRadius: 14,
                  backgroundColor: colors.shimmerBase,
                  overflow: "hidden",
                }}
              >
                <Animated.View style={shimmerOverlayStyle(96, 14)} />
              </View>

              <View style={{ flex: 1, gap: 8 }}>
                <View
                  style={{
                    height: 18,
                    borderRadius: 6,
                    backgroundColor: colors.shimmerBase,
                    overflow: "hidden",
                  }}
                >
                  <Animated.View style={shimmerOverlayStyle(220, 6)} />
                </View>
                <View
                  style={{
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: colors.shimmerBase,
                    width: 180,
                    overflow: "hidden",
                  }}
                >
                  <Animated.View style={shimmerOverlayStyle(180, 6)} />
                </View>
                <View
                  style={{
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: colors.shimmerBase,
                    width: 140,
                    overflow: "hidden",
                  }}
                >
                  <Animated.View style={shimmerOverlayStyle(140, 6)} />
                </View>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                  <View
                    style={{
                      width: 70,
                      height: 28,
                      borderRadius: 999,
                      backgroundColor: colors.shimmerBase,
                      overflow: "hidden",
                    }}
                  >
                    <Animated.View style={shimmerOverlayStyle(70, 999)} />
                  </View>
                  <View
                    style={{
                      width: 70,
                      height: 28,
                      borderRadius: 999,
                      backgroundColor: colors.shimmerBase,
                      overflow: "hidden",
                    }}
                  >
                    <Animated.View style={shimmerOverlayStyle(70, 999)} />
                  </View>
                </View>
              </View>
            </View>

            {/* Actions / Search Bar Skeleton */}
            <View
              style={{
                height: 48,
                borderRadius: 14,
                backgroundColor: colors.shimmerBase,
                overflow: "hidden",
              }}
            >
              <Animated.View style={shimmerOverlayStyle(screenWidth - 32, 14)} />
            </View>

            {/* Chapters Skeleton */}
            <View style={{ gap: 12 }}>
              {Array.from({ length: 8 }).map((_, idx) => (
                <View
                  key={`chapter-skeleton-${idx}`}
                  style={{
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 16,
                    padding: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 14,
                      backgroundColor: colors.shimmerBase,
                      overflow: "hidden",
                    }}
                  >
                    <Animated.View style={shimmerOverlayStyle(56, 14)} />
                  </View>
                  <View style={{ flex: 1, gap: 8 }}>
                    <View
                      style={{
                        height: 14,
                        borderRadius: 6,
                        backgroundColor: colors.shimmerBase,
                        overflow: "hidden",
                      }}
                    >
                      <Animated.View style={shimmerOverlayStyle(220, 6)} />
                    </View>
                    <View
                      style={{
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: colors.shimmerBase,
                        width: 180,
                        overflow: "hidden",
                      }}
                    >
                      <Animated.View style={shimmerOverlayStyle(180, 6)} />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (state.error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: contentPadding,
        }}
      >
        <View style={{ width: "100%", maxWidth: 500, alignItems: "center", gap: 16 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: colors.ghost,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 8,
            }}
          >
            <IconSymbol
              name={offline ? "wifi.slash" : "exclamationmark.triangle.fill"}
              size={40}
              color={colors.text}
            />
          </View>
          <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text, textAlign: "center" }}>
            {offline ? "Kamu Sedang Offline" : "Gagal load"}
          </Text>
          <Text style={{ fontSize: 16, color: colors.subtext, textAlign: "center", paddingHorizontal: 20 }}>
            {offline ? "Cek koneksi internetmu lalu coba muat ulang halaman ini." : state.error}
          </Text>

          <Pressable
            onPress={() => void load()}
            style={({ pressed }) => ({
              marginTop: 10,
              paddingVertical: 14,
              paddingHorizontal: 32,
              backgroundColor: colors.text,
              borderRadius: 999,
              opacity: pressed ? 0.8 : 1,
              shadowColor: colors.text,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 4,
            })}
          >
            <Text style={{ color: colors.bg, fontWeight: "900", fontSize: 16 }}>
              {offline ? "Coba Lagi" : "Retry"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const header = (
    <View style={{ backgroundColor: colors.bg, paddingBottom: 16 }}>
      {/* ── Hero Blurred Banner ── */}
      <View style={{ width: "100%", height: 260, backgroundColor: "#000", overflow: "hidden" }}>
        <ExpoImage
          source={{ uri: displayCover }}
          style={{ width: "100%", height: "100%", opacity: 0.45 }}
          blurRadius={18}
          contentFit="cover"
        />
        <LinearGradient
          colors={
            isDark
              ? ["rgba(11,11,14,0.1)", "rgba(11,11,14,0.5)", "rgba(11,11,14,0.85)", colors.bg]
              : ["rgba(246,241,233,0.15)", "rgba(246,241,233,0.55)", "rgba(246,241,233,0.85)", colors.bg]
          }
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
        />
        
        {/* Floating Nav Bar (Back & Home buttons centered on wide viewport) */}
        <View 
          style={{ 
            position: "absolute", 
            top: Platform.OS === 'android' ? Math.max(insets.top, 24) + 12 : Math.max(insets.top, 20) + 8, 
            left: 0, 
            right: 0, 
            alignItems: "center", 
            zIndex: 12 
          }}
        >
          <View style={{ width: "100%", maxWidth: 1000, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: contentPadding }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Pressable
                onPress={() => router.back()}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: "rgba(14,14,20,0.65)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.12)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="arrow-back" size={20} color="#FFF" />
              </Pressable>
              {offline && (
                <View
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    backgroundColor: "rgba(26,26,36,0.85)",
                    borderWidth: 1,
                    borderColor: colors.border,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Ionicons name="wifi-outline" size={14} color="#FFF" />
                  <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 12 }}>
                    Offline
                  </Text>
                </View>
              )}
            </View>

            <Pressable
              onPress={() => router.push("/")}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: "rgba(14,14,20,0.65)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="home-outline" size={20} color="#FFF" />
            </Pressable>
          </View>
        </View>
      </View>

      {/* ── Content Container (Centered & Responsive Margin) ── */}
      <View style={{ width: "100%", maxWidth: 1000, alignSelf: "center", paddingHorizontal: contentPadding }}>
        <View style={{ flexDirection: isWide ? "row" : "column", marginTop: -100, alignItems: isWide ? "flex-end" : "center", gap: 16, zIndex: 10 }}>
          <ExpoImage
            source={{ uri: displayCover }}
            style={{ width: isWide ? 160 : 140, height: isWide ? 240 : 210, borderRadius: 14, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.2)", backgroundColor: colors.chip }}
            contentFit="cover" cachePolicy="memory-disk" transition={120}
          />
          <View style={{ flex: isWide ? 1 : undefined, alignItems: isWide ? "flex-start" : "center", paddingBottom: isWide ? 8 : 0, gap: 4 }}>
            <Text
              style={{ 
                fontSize: 24, 
                fontWeight: "900", 
                color: isDark ? "#FFF" : colors.text, 
                textShadowColor: isDark ? "rgba(0,0,0,0.85)" : "transparent", 
                textShadowOffset: isDark ? { width: 0, height: 2 } : { width: 0, height: 0 }, 
                textShadowRadius: isDark ? 4 : 0,
                textAlign: isWide ? "left" : "center"
              }}
              numberOfLines={2}
            >
              {displayTitle}
            </Text>
            {!!mangaDetail?.alternative_title && (
              <Text 
                style={{ 
                  fontSize: 13, 
                  fontWeight: "600", 
                  color: isDark ? "rgba(255,255,255,0.7)" : colors.subtext,
                  textAlign: isWide ? "left" : "center" 
                }} 
                numberOfLines={1}
              >
                {mangaDetail.alternative_title}
              </Text>
            )}
          </View>
        </View>

        {/* ── Buttons & Stats Row ── */}
        {(() => {
          const stats = [
            { icon: "star", color: "#FF9F43", value: typeof displayUserRate === "number" ? displayUserRate.toFixed(1) : "-" },
            { icon: "bookmark", color: "#00D2D3", value: displayMeta ? formatCount(displayMeta.bookmarks) : "0" },
            { icon: "eye", color: "#54A0FF", value: displayMeta ? formatCount(displayMeta.views) : "0" },
            { icon: "trophy", color: "#9B59B6", value: mangaDetail?.rank ? `#${mangaDetail.rank}` : "-" },
          ];

          const buttonStyle = {
            flexDirection: "row" as const,
            alignItems: "center" as const,
            justifyContent: "center" as const,
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 10,
            gap: 6,
            ...(isWide ? {} : { flex: 1 }),
          };

          const bacaBtn = (
            <Pressable
              onPress={() => {
                const targetId = resume?.chapterId ?? mangaDetail?.latest_chapter_id;
                if (targetId) {
                  router.push({
                    pathname: "/reader/[chapterId]",
                    params: {
                      chapterId: targetId,
                      mangaTitle: displayTitle,
                      coverUrl: displayCover,
                      mangaId: id,
                    },
                  });
                }
              }}
              style={{
                ...buttonStyle,
                backgroundColor: "#6C5CE7",
              }}
            >
              <Ionicons name="play" size={17} color="#FFF" />
              <Text style={{ color: "#FFF", fontWeight: "900", fontSize: 16 }}>
                {resume ? "Lanjut" : "Baca"}
              </Text>
            </Pressable>
          );

          const bookmarkBtn = (
            <Pressable
              onPress={async () => {
                if (!id) return;
                const token = await getToken();
                if (!token) {
                  showAlert("Perlu Login", "Silakan login terlebih dahulu untuk menggunakan fitur Bookmark.", "info");
                  return;
                }
                const cover = displayCover;
                const next = await toggleBookmark({
                  mangaId: id,
                  title: displayTitle,
                  coverUrl: cover,
                });
                setBookmarked(next);
                setToast(next ? "Ditambahkan ke bookmark" : "Dihapus dari bookmark");
              }}
              style={{
                ...buttonStyle,
                backgroundColor: "#2C2C35",
              }}
            >
              <Ionicons name={bookmarked ? "bookmark" : "bookmark-outline"} size={17} color="#FFF" />
              <Text style={{ color: "#FFF", fontWeight: "900", fontSize: 15 }}>
                {bookmarked ? "Bookmarked" : "Bookmark"}
              </Text>
            </Pressable>
          );

          const statsRow = (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 19 }}>
              {stats.map((s, idx) => (
                <View key={idx} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                  <Ionicons name={s.icon as any} size={21} color={s.color} />
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>{s.value}</Text>
                </View>
              ))}
            </View>
          );

          if (isWide) {
            return (
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {bacaBtn}
                  {bookmarkBtn}
                </View>
                {statsRow}
              </View>
            );
          }

          return (
            <View style={{ marginTop: 20, gap: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "center", gap: 10 }}>
                {bacaBtn}
                {bookmarkBtn}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 14 }}>
                {statsRow}
              </View>
            </View>
          );
        })()}

        {/* ── Description ── */}
        <View style={{ marginTop: 18 }}>
          <Text
            style={{ color: colors.text, lineHeight: 22, fontSize: 14 }}
            numberOfLines={descExpanded ? 0 : 4}
          >
            {displayDescription}
          </Text>
          {showDescToggle && (
            <Pressable onPress={() => setDescExpanded((v) => !v)} style={{ marginTop: 6 }}>
              <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 13 }}>
                {descExpanded ? "Lebih sedikit" : "Selengkapnya"}
              </Text>
            </Pressable>
          )}
        </View>

        {/* ── Metadata Chips Section (Genre, Author, Artist, Format, Type) ── */}
        {metadataSections.length > 0 && (
          <View
            style={{
              marginTop: 20,
              flexDirection: isWide ? "row" : "column",
              flexWrap: isWide ? "wrap" : undefined,
              alignItems: isWide ? "center" : "stretch",
              gap: isWide ? 16 : 14,
            }}
          >
            {metadataSections.map((sec, idx) => (
              <React.Fragment key={sec.key}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: isWide ? "center" : "flex-start",
                    gap: 12,
                  }}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "700",
                      fontSize: 15,
                      minWidth: isWide ? undefined : 75,
                      marginTop: isWide ? 0 : 4,
                    }}
                  >
                    {sec.label}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 8,
                      flex: isWide ? undefined : 1,
                    }}
                  >
                    {sec.items.map((item, itemIdx) => (
                      <View
                        key={`${sec.key}-${itemIdx}`}
                        style={{
                          backgroundColor: colors.chip,
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.subtext,
                            fontWeight: "600",
                            fontSize: 14,
                          }}
                        >
                          {item}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
                {isWide && idx < metadataSections.length - 1 && (
                  <Text
                    style={{
                      color: colors.border,
                      fontSize: 16,
                      marginHorizontal: 6,
                    }}
                  >
                    |
                  </Text>
                )}
              </React.Fragment>
            ))}
          </View>
        )}

        {/* Spacer between metadata and chapter list */}
        <View
          onLayout={(e) => {
            setChapterOffset(e.nativeEvent.layout.y);
          }}
          style={{ height: 1, backgroundColor: colors.border, marginTop: 22 }}
        />

        {/* ── Chapter List Header Row (Chapter, Awal, Sort) ── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 20,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>
            Chapter
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable
              onPress={() => {
                const target = firstChapter ?? (state.chapters.length > 0 ? state.chapters[state.chapters.length - 1] : null);
                if (!target) return;

                router.push({
                  pathname: "/reader/[chapterId]",
                  params: {
                    chapterId: target.chapter_id,
                    mangaTitle: displayTitle,
                    coverUrl: displayCover,
                  },
                });
              }}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: colors.chip,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <IconSymbol name="book.fill" size={14} color={colors.subtext} />
              <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 12 }}>Awal</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setSortDir((v) => (v === "desc" ? "asc" : "desc"));
              }}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: colors.chip,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <IconSymbol
                name="arrow.up.arrow.down"
                size={14}
                color={colors.subtext}
              />
              <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 12 }}>
                {sortDir === "desc" ? "Terbaru" : "Terlama"}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* 🔹 CHAPTER SEARCH */}
        <View
          style={{
            backgroundColor: colors.inputBg,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginTop: 14,
          }}
        >
          <IconSymbol
            name="magnifyingglass"
            size={16}
            color={colors.placeholder}
          />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Cari chapter (contoh: 15, ep 20)"
            placeholderTextColor={colors.placeholder}
            style={{
              flex: 1,
              color: colors.inputText,
              fontWeight: "700",
              padding: 0,
            }}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <IconSymbol
                name="xmark.circle.fill"
                size={18}
                color={colors.placeholder}
              />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        ref={listRef}
        data={orderedChapters}
        keyExtractor={(c) => c.chapter_id}
        ListHeaderComponent={header}
        contentContainerStyle={{
          paddingBottom: bottomInset,
          paddingTop: 0,
        }}
        ListEmptyComponent={
          <View style={{ width: "100%", maxWidth: 1000, alignSelf: "center", paddingHorizontal: contentPadding, paddingVertical: 48, alignItems: "center", gap: 12 }}>
            {offline ? (
              <>
                <Text style={{ color: colors.subtext }}>
                  Offline. Tidak bisa memuat daftar chapter.
                </Text>
                <Pressable
                  onPress={() => void load()}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    backgroundColor: colors.ghost,
                  }}
                >
                  <Text style={{ color: colors.ghostText, fontWeight: "800" }}>
                    Coba lagi
                  </Text>
                </Pressable>
              </>
            ) : (
              <Text style={{ color: colors.subtext }}>
                Belum ada chapter untuk manga ini.
              </Text>
            )}
          </View>
        }
        initialNumToRender={10}
        windowSize={7}
        removeClippedSubviews
        ListFooterComponent={
          <View style={{ width: "100%", maxWidth: 1000, alignSelf: "center", paddingHorizontal: contentPadding }}>
            {state.loadingMore ? (
              <View style={{ paddingVertical: 24 }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null}

            {/* Pagination Controls */}
            {!state.loadingMore && searchQuery.trim() === "" && state.totalPage > 1 && (
              <View style={{ alignItems: "center", marginVertical: 20, gap: 10 }}>
                {/* Page indicator above buttons */}
                <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14 }}>
                  Halaman {state.page} dari {state.totalPage}
                </Text>

                {/* Inline page buttons row */}
                <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 }}>
                  {/* Prev Button */}
                  <Pressable
                    disabled={state.page <= 1}
                    onPress={() => void loadChapters(state.page - 1)}
                    style={({ pressed }) => ({
                      width: 50,
                      height: 50,
                      borderRadius: 8,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: colors.chip,
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity: state.page <= 1 ? 0.35 : pressed ? 0.75 : 1,
                    })}
                  >
                    <Ionicons name="chevron-back" size={18} color={state.page <= 1 ? colors.subtext : colors.text} />
                  </Pressable>

                  {/* Page Number Buttons */}
                  {(() => {
                    const pages = [];
                    const total = state.totalPage;
                    const current = state.page;

                    // Show up to 5 page buttons around the current page
                    let start = Math.max(1, current - 2);
                    let end = Math.min(total, current + 2);
                    if (current <= 3) {
                      end = Math.min(total, 5);
                    } else if (current >= total - 2) {
                      start = Math.max(1, total - 4);
                    }

                    for (let i = start; i <= end; i++) {
                      pages.push(i);
                    }

                    return pages.map((p) => {
                      const isActive = p === current;
                      return (
                        <Pressable
                          key={`page-btn-${p}`}
                          onPress={() => void loadChapters(p)}
                          style={({ pressed }) => ({
                            width: 42,
                            height: 42,
                            borderRadius: 8,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: isActive ? "#6C5CE7" : colors.chip,
                            borderWidth: 1,
                            borderColor: isActive ? "#6C5CE7" : colors.border,
                            opacity: pressed ? 0.8 : 1,
                          })}
                        >
                          <Text
                            style={{
                              color: isActive ? "#FFF" : colors.text,
                              fontWeight: "900",
                              fontSize: 15,
                            }}
                          >
                            {p}
                          </Text>
                        </Pressable>
                      );
                    });
                  })()}
                  
                  {/* Next Button */}
                  <Pressable
                    disabled={state.page >= state.totalPage}
                    onPress={() => void loadChapters(state.page + 1)}
                    style={({ pressed }) => ({
                      width: 50,
                      height: 50,
                      borderRadius: 8,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: colors.chip,
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity: state.page >= state.totalPage ? 0.35 : pressed ? 0.75 : 1,
                    })}
                  >
                    <Ionicons name="chevron-forward" size={18} color={state.page >= state.totalPage ? colors.subtext : colors.text} />
                  </Pressable>
                </View>
              </View>
            )}

            <CommentSection mangaId={id} />
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ width: "100%", maxWidth: 1000, alignSelf: "center", paddingHorizontal: contentPadding, paddingVertical: 6 }}>
            <View
              style={{
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                flexDirection: "row",
                alignItems: "center",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isDark ? 0.4 : 0.05,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/reader/[chapterId]",
                    params: {
                      chapterId: item.chapter_id,
                      mangaTitle: displayTitle,
                      coverUrl: displayCover,
                      mangaId: id,
                    },
                  })
                }
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 16,
                  padding: 16,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <ExpoImage
                  source={{ uri: item.thumbnail_image_url ?? "" }}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 14,
                    backgroundColor: colors.chip,
                  }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={120}
                />

                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text 
                       style={{ 
                         fontWeight: resume && item.chapter_number === resume.chapterNumber ? "700" : "900", 
                         color: resume && item.chapter_number === resume.chapterNumber ? colors.subtext : colors.text 
                       }}
                    >
                      Chapter {item.chapter_number}
                      {item.chapter_title ? ` - ${item.chapter_title}` : ""}
                    </Text>
                    {resume && item.chapter_number === resume.chapterNumber && (
                      <View style={{ backgroundColor: colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "800" }}>Terakhir Dibaca</Text>
                      </View>
                    )}
                    {readChapters.includes(item.chapter_id) && (!resume || item.chapter_number !== resume.chapterNumber) && (
                      <View style={{ backgroundColor: colors.chip, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ color: colors.subtext, fontSize: 10, fontWeight: "800" }}>Sudah Dibaca</Text>
                      </View>
                    )}
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <IconSymbol name="eye" size={14} color={colors.subtext} />
                      <Text style={{ color: colors.subtext }}>
                        {item.view_count.toLocaleString("id-ID")}
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <IconSymbol
                        name="calendar"
                        size={14}
                        color={colors.subtext}
                      />
                      <Text style={{ color: colors.subtext }}>
                        {new Date(item.release_date).toLocaleDateString("id-ID")}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingRight: 16 }}>
                {/* Download Button / Indicator — native only */}
                {Platform.OS !== 'web' && (
                  <Pressable
                    onPress={() => handleDownload(item.chapter_id)}
                    hitSlop={12}
                    style={({ pressed }) => ({ opacity: pressed ? 0.4 : 1, padding: 8 })}
                  >
                    {downloadProgress[item.chapter_id] !== undefined ? (
                      <Text style={{ fontSize: 11, fontWeight: "900", color: "#4A8FE2" }}>
                        {Math.round(downloadProgress[item.chapter_id] * 100)}%
                      </Text>
                    ) : downloadedChapters[item.chapter_id] ? (
                      <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                    ) : (
                      <Ionicons name="download-outline" size={20} color={colors.subtext} />
                    )}
                  </Pressable>
                )}

                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/reader/[chapterId]",
                      params: {
                        chapterId: item.chapter_id,
                        mangaTitle: displayTitle,
                        coverUrl: displayCover,
                        mangaId: id,
                      },
                    })
                  }
                  hitSlop={8}
                  style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4 })}
                >
                  <IconSymbol
                    name="chevron.right"
                    size={18}
                    color={colors.subtext}
                  />
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />

      {/* ── Dynamic Bottom Overlay (Centering toast and resume banners) ── */}
      {(resumeCta || toast) && (
        <View style={{ 
          position: "absolute", 
          left: 0, 
          right: 0, 
          bottom: insets.bottom > 0 ? insets.bottom + 12 : 16, 
          alignItems: "center", 
          paddingHorizontal: contentPadding,
          zIndex: 99
        }}>
          <View style={{ width: "100%", maxWidth: 600, gap: 12 }}>
            {resumeCta}
            {toast && (
              <View
                style={{
                  backgroundColor: colors.ghost,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 12,
                  elevation: 6,
                }}
              >
                <IconSymbol name="bookmark.fill" size={16} color={colors.subtext} />
                <Text style={{ color: colors.subtext, fontWeight: "800" }}>
                  {toast}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ── Custom Alert Modal ── */}
      {customAlert?.visible && (
        <Modal
          visible={customAlert.visible}
          transparent
          animationType="fade"
          onRequestClose={() => setCustomAlert(null)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.6)",
              justifyContent: "center",
              alignItems: "center",
              padding: 24,
            }}
          >
            <View
              style={{
                width: "100%",
                maxWidth: 320,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                padding: 24,
                alignItems: "center",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 10,
                elevation: 10,
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  justifyContent: "center",
                  alignItems: "center",
                  marginBottom: 16,
                  backgroundColor:
                    customAlert.type === "error"
                      ? isDark ? "rgba(255, 92, 92, 0.15)" : "rgba(211, 47, 47, 0.15)"
                      : customAlert.type === "confirm"
                      ? isDark ? "rgba(255, 179, 0, 0.15)" : "rgba(245, 124, 0, 0.15)"
                      : isDark ? "rgba(74, 143, 226, 0.15)" : "rgba(0, 91, 181, 0.15)",
                }}
              >
                <Ionicons
                  name={
                    customAlert.type === "error"
                      ? "alert-circle"
                      : customAlert.type === "confirm"
                      ? "help-circle"
                      : "information-circle"
                  }
                  size={32}
                  color={
                    customAlert.type === "error"
                      ? "#FF5C5C"
                      : customAlert.type === "confirm"
                      ? "#FFB300"
                      : colors.primary || "#4A8FE2"
                  }
                />
              </View>

              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "900",
                  color: colors.text,
                  marginBottom: 8,
                  textAlign: "center",
                }}
              >
                {customAlert.title}
              </Text>
              
              <Text
                style={{
                  fontSize: 14,
                  color: colors.subtext,
                  textAlign: "center",
                  lineHeight: 20,
                  marginBottom: 24,
                }}
              >
                {customAlert.description}
              </Text>

              <View style={{ flexDirection: "row", width: "100%", gap: 12 }}>
                {customAlert.type === "confirm" ? (
                  <>
                    <Pressable
                      onPress={() => setCustomAlert(null)}
                      style={({ pressed }) => ({
                        flex: 1,
                        height: 48,
                        borderRadius: 12,
                        justifyContent: "center",
                        alignItems: "center",
                        backgroundColor: isDark ? "#242434" : "#EFE6DA",
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text }}>Batal</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        const onConfirm = customAlert.onConfirm;
                        setCustomAlert(null);
                        if (onConfirm) onConfirm();
                      }}
                      style={({ pressed }) => ({
                        flex: 1,
                        height: 48,
                        borderRadius: 12,
                        justifyContent: "center",
                        alignItems: "center",
                        backgroundColor: "#FF5C5C",
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <Text style={{ color: "#FFF", fontSize: 15, fontWeight: "800" }}>Hapus</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    onPress={() => setCustomAlert(null)}
                    style={({ pressed }) => ({
                      flex: 1,
                      height: 48,
                      borderRadius: 12,
                      justifyContent: "center",
                      alignItems: "center",
                      backgroundColor: colors.primary || "#4A8FE2",
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "800",
                        color: colors.primaryText || "#FFF",
                      }}
                    >
                      Mengerti
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}