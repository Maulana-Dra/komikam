import { Image as ExpoImage } from "expo-image";
import { Animated, Image as RNImage } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  PanResponder,
  Pressable,
  View,
} from "react-native";

import { Text } from "@/components/ui/app-text";
import { useAppTheme } from "@/src/theme/ThemeContext";
import { getChapterDetail } from "../../src/api/shngmClient";
import { getLatestProgressByManga, upsertProgress } from "../../src/store/history";
import { getReaderSettings, setReaderSettings, ReaderSettings } from "../../src/store/readerSettings";
import type { ShngmChapterDetailData } from "../../src/api/shngmTypes";

type PageItem = {
  key: string;
  index: number;
  url: string;
};

function joinUrl(baseUrl: string, path: string, filename: string): string {
  const b = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const p = path.startsWith("/") ? path : `/${path}`;
  const pp = p.endsWith("/") ? p : `${p}/`;
  return `${b}${pp}${filename}`;
}

function PageImage({ uri, onSingleTap, bg }: { uri: string; onSingleTap: () => void; bg: string }) {
  const screenW = Dimensions.get("window").width;
  const [height, setHeight] = React.useState<number>(screenW * 1.4);
  const lastTapRef = React.useRef<number>(0);
  const tapTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const scale = React.useRef(new Animated.Value(1)).current;
  const zoomedRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    let alive = true;

    RNImage.getSize(
      uri,
      (w: number, h: number) => {
        if (!alive) return;
        setHeight(screenW * (h / w));
      },
      () => {
        // fallback: biarin height default
      }
    );

    return () => {
      alive = false;
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
      }
    };
  }, [uri, screenW]);

  React.useEffect(() => {
    zoomedRef.current = false;
    scale.setValue(1);
  }, [scale, uri]);

  const handleTap = React.useCallback(() => {
    const now = Date.now();

    if (now - lastTapRef.current < 250) {
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }

      lastTapRef.current = 0;
      const next = !zoomedRef.current;
      zoomedRef.current = next;
      Animated.timing(scale, {
        toValue: next ? 2 : 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
      return;
    }

    lastTapRef.current = now;
    tapTimerRef.current = setTimeout(() => {
      onSingleTap();
      tapTimerRef.current = null;
    }, 260);
  }, [onSingleTap, scale]);

  return (
    <Pressable onPress={handleTap}>
      <View
        style={{
          width: screenW,
          height,
          backgroundColor: bg,
          overflow: "hidden",
        }}
      >
        <Animated.View
          style={{
            width: screenW,
            height,
            transform: [{ scale }],
          }}
        >
          <ExpoImage
            source={{ uri }}
            style={{
              width: screenW,
              height,
            }}
            contentFit="contain"
            cachePolicy="disk"
            transition={0}
            allowDownscaling={false}
          />
        </Animated.View>
      </View>
    </Pressable>
  );
}


export default function ReaderScreen() {
  const router = useRouter();
  const { chapterId, mangaTitle, coverUrl } = useLocalSearchParams<{
    chapterId: string;
    mangaTitle?: string;
    coverUrl?: string;
  }>();
  const id = typeof chapterId === "string" ? chapterId : "";
  const safeTitle = typeof mangaTitle === "string" ? mangaTitle : "";
  const safeCoverUrl = typeof coverUrl === "string" ? coverUrl : "";

  const { resolved } = useAppTheme();
  const isDark = resolved === "dark";
  const insets = useSafeAreaInsets();
  const colors = React.useMemo(
    () => ({
      bg: isDark ? "#0B0B0E" : "#F6F1E9",
      text: isDark ? "#F2F2F7" : "#1E2329",
      subtext: isDark ? "#B3B3C2" : "#6A625A",
      border: isDark ? "#242434" : "#E6DED2",
      header: isDark ? "#121218" : "#FBF6EE",
      headerBtn: isDark ? "#1A1A24" : "#EFE6DA",
      headerBtnText: isDark ? "#F2F2F7" : "#1E2329",
    }),
    [isDark]
  );

  const [title, setTitle] = React.useState<string>("Reader");
  const [chapterData, setChapterData] = React.useState<ShngmChapterDetailData | null>(null);
  const [prevId, setPrevId] = React.useState<string | null>(null);
  const [nextId, setNextId] = React.useState<string | null>(null);
  const [mangaId, setMangaId] = React.useState<string>("");
  const [chapterNumber, setChapterNumber] = React.useState<number>(0);
  const [currentIndex, setCurrentIndex] = React.useState<number>(0);
  const [controlsVisible, setControlsVisible] = React.useState<boolean>(true);
  const [sliderWidth, setSliderWidth] = React.useState<number>(0);
  const [sliderPageX, setSliderPageX] = React.useState<number>(0);
  const [isScrubbing, setIsScrubbing] = React.useState<boolean>(false);
  const [scrubIndex, setScrubIndex] = React.useState<number | null>(null);
  const [resumeIndex, setResumeIndex] = React.useState<number | null>(null);
  const [resumeVisible, setResumeVisible] = React.useState<boolean>(false);

  const listRef = React.useRef<FlatList<PageItem>>(null);
  const sliderRef = React.useRef<View>(null);
  const resumeCheckedRef = React.useRef<string>("");
  const scrubIndexRef = React.useRef<number | null>(null);

  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  // Settings state
  const [settings, setSettings] = React.useState<ReaderSettings>({ imageQuality: "high", readerBg: "black" });
  const [settingsVisible, setSettingsVisible] = React.useState(false);
  const settingsAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    void getReaderSettings().then(setSettings);
  }, []);

  const updateSetting = React.useCallback(async (partial: Partial<ReaderSettings>) => {
    const next = await setReaderSettings(partial);
    setSettings(next);
  }, []);

  const toggleSettings = React.useCallback(() => {
    const next = !settingsVisible;
    setSettingsVisible(next);
    Animated.timing(settingsAnim, {
      toValue: next ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [settingsVisible, settingsAnim]);

  const pages = React.useMemo(() => {
    if (!chapterData) return [];
    const base = settings.imageQuality === "low" ? chapterData.base_url_low : chapterData.base_url;
    const path = chapterData.chapter.path;
    return chapterData.chapter.data.map((filename, idx) => ({
      key: `${chapterData.chapter_id}:${idx}:${filename}`,
      index: idx,
      url: joinUrl(base, path, filename),
    }));
  }, [chapterData, settings.imageQuality]);

  const load = React.useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

      const res = await getChapterDetail(id);
      const d = res.data;

      setMangaId(d.manga_id);
      setChapterNumber(d.chapter_number);
      setTitle(`Chapter ${d.chapter_number}`);

      setPrevId(d.prev_chapter_id);
      setNextId(d.next_chapter_id);

      const base = d.base_url;
      const path = d.chapter.path;

      setChapterData(d);

      setCurrentIndex(0);
      setScrubIndex(null);
      scrubIndexRef.current = null;
      setResumeIndex(null);
      setResumeVisible(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // save progress (throttle)
  const lastSavedRef = React.useRef<number>(0);
  const initialSavedRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    if (initialSavedRef.current) return;
    if (!mangaId || !id || pages.length === 0) return;

    initialSavedRef.current = true;
    void upsertProgress({
      mangaId,
      chapterId: id,
      chapterNumber,
      pageIndex: 0,
      totalPages: pages.length,
      updatedAt: Date.now(),
      mangaTitle: safeTitle || undefined,
      coverUrl: safeCoverUrl || undefined,
    });
  }, [mangaId, id, chapterNumber, pages.length, safeTitle, safeCoverUrl]);

  React.useEffect(() => {
    if (!mangaId || !id || pages.length === 0) return;

    const key = `${mangaId}:${id}:${pages.length}`;
    if (resumeCheckedRef.current === key) return;
    resumeCheckedRef.current = key;

    let alive = true;
    void (async () => {
      const latest = await getLatestProgressByManga(mangaId);
      if (!alive) return;
      if (!latest || latest.chapterId !== id) return;
      if (latest.pageIndex <= 0 || latest.pageIndex >= pages.length) return;

      setResumeIndex(latest.pageIndex);
      setResumeVisible(true);
    })();

    return () => {
      alive = false;
    };
  }, [mangaId, id, pages.length]);

  React.useEffect(() => {
    if (resumeIndex === null) return;
    if (currentIndex >= resumeIndex) {
      setResumeVisible(false);
    }
  }, [currentIndex, resumeIndex]);

  React.useEffect(() => {
    if (pages.length === 0) return;

    const candidates = [currentIndex - 1, currentIndex + 1, currentIndex + 2];
    const unique = Array.from(new Set(candidates));

    unique.forEach((idx) => {
      if (idx < 0 || idx >= pages.length) return;
      const url = pages[idx]?.url;
      if (!url) return;
      void RNImage.prefetch(url).catch(() => undefined);
    });
  }, [currentIndex, pages]);

  const onViewableItemsChanged = React.useCallback(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      const first = viewableItems
        .map((v) => v.index)
        .find((idx): idx is number => typeof idx === "number" && idx >= 0);

      if (first === undefined) return;
      setCurrentIndex(first);

      const now = Date.now();
      if (now - lastSavedRef.current < 2000) return;
      lastSavedRef.current = now;

      if (!mangaId || !id) return;

      void upsertProgress({
        mangaId,
        chapterId: id,
        chapterNumber,
        pageIndex: first,
        totalPages: pages.length,
        updatedAt: now,
        mangaTitle: safeTitle || undefined,
        coverUrl: safeCoverUrl || undefined,
      });
    },
    [mangaId, id, chapterNumber, pages.length, safeTitle, safeCoverUrl]
  );

  const handleToggleControls = React.useCallback(() => {
    setControlsVisible((v) => !v);
  }, []);

  const scrollToIndex = React.useCallback((index: number, animated = true) => {
    listRef.current?.scrollToIndex({ index, animated });
  }, []);

  const onScrollToIndexFailed = React.useCallback(
    (info: { index: number; highestMeasuredFrameIndex: number }) => {
      const target = Math.max(0, Math.min(info.index, info.highestMeasuredFrameIndex));
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index: target, animated: false });
      }, 60);
    },
    []
  );

  const totalPages = pages.length;
  const displayIndex = isScrubbing && scrubIndex !== null ? scrubIndex : currentIndex;
  const pageLabel = totalPages > 0 ? `${displayIndex + 1} / ${totalPages}` : "0 / 0";
  const progress = totalPages > 0 ? (displayIndex + 1) / totalPages : 0;
  const sliderPadding = 10;
  const sliderUsable = Math.max(1, sliderWidth - sliderPadding * 2);

  const handleSliderTouch = React.useCallback(
    (x: number) => {
      if (totalPages <= 0 || sliderUsable <= 0) return;
      const localX = Math.max(0, Math.min(sliderUsable, x - sliderPadding));
      const ratio = Math.max(0, Math.min(1, localX / sliderUsable));
      const idx = Math.min(totalPages - 1, Math.max(0, Math.round(ratio * (totalPages - 1))));
      setScrubIndex(idx);
      scrubIndexRef.current = idx;
    },
    [sliderPadding, sliderUsable, totalPages]
  );

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          setIsScrubbing(true);
          const localX = event.nativeEvent.pageX - sliderPageX;
          handleSliderTouch(localX);
        },
        onPanResponderMove: (event) => {
          const localX = event.nativeEvent.pageX - sliderPageX;
          handleSliderTouch(localX);
        },
        onPanResponderRelease: () => {
          setIsScrubbing(false);
          const target = scrubIndexRef.current;
          if (target !== null) {
            scrollToIndex(target);
          }
          scrubIndexRef.current = null;
        },
        onPanResponderTerminate: () => {
          setIsScrubbing(false);
          scrubIndexRef.current = null;
        },
      }),
    [handleSliderTouch, scrollToIndex, sliderPageX]
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.subtext} />
        <Text style={{ marginTop: 8, color: colors.subtext }}>Loading chapter...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16, gap: 12, paddingTop: insets.top + 16 }}>
        <Text style={{ fontWeight: "900", color: colors.text }}>Gagal load chapter</Text>
        <Text style={{ color: colors.subtext }}>{error}</Text>

        <Pressable
          onPress={() => void load()}
          style={{ paddingVertical: 12, paddingHorizontal: 14, backgroundColor: colors.headerBtn, borderRadius: 12 }}
        >
          <Text style={{ color: colors.headerBtnText, fontWeight: "900" }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {controlsVisible && (
        <View
          style={{
            paddingHorizontal: 12,
            paddingTop: insets.top + 10,
            paddingBottom: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.header,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            zIndex: 2,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 10,
              backgroundColor: colors.headerBtn,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: colors.headerBtnText, fontWeight: "900" }}>Back</Text>
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.subtext, fontWeight: "700" }} numberOfLines={1}>
              {safeTitle || "Manga"}
            </Text>
            <Text style={{ color: colors.text, fontWeight: "900" }} numberOfLines={1}>
              {title}
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            {/* Settings Button */}
            <Pressable
              onPress={toggleSettings}
              style={({ pressed }) => ({
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 10,
                backgroundColor: colors.headerBtn,
                opacity: pressed ? 0.85 : 1,
                justifyContent: "center",
                alignItems: "center",
              })}
            >
              <Text style={{ fontSize: 16 }}>⚙️</Text>
            </Pressable>

            <Pressable
              disabled={!prevId}
              onPress={() =>
                prevId &&
                router.replace({
                  pathname: "/reader/[chapterId]",
                  params: {
                    chapterId: prevId,
                    mangaTitle: safeTitle,
                    coverUrl: safeCoverUrl,
                  },
                })
              }
              style={({ pressed }) => ({
                opacity: prevId ? (pressed ? 0.85 : 1) : 0.35,
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 10,
                backgroundColor: colors.headerBtn,
              })}
            >
              <Text style={{ color: colors.headerBtnText, fontWeight: "900" }}>Prev</Text>
            </Pressable>

            <Pressable
              disabled={!nextId}
              onPress={() =>
                nextId &&
                router.replace({
                  pathname: "/reader/[chapterId]",
                  params: {
                    chapterId: nextId,
                    mangaTitle: safeTitle,
                    coverUrl: safeCoverUrl,
                  },
                })
              }
              style={({ pressed }) => ({
                opacity: nextId ? (pressed ? 0.85 : 1) : 0.35,
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 10,
                backgroundColor: colors.headerBtn,
              })}
            >
              <Text style={{ color: colors.headerBtnText, fontWeight: "900" }}>Next</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Pages */}
      <FlatList
        ref={listRef}
        data={pages}
        keyExtractor={(it) => it.key}
        renderItem={({ item }) => (
          <PageImage
            uri={item.url}
            onSingleTap={handleToggleControls}
            bg={settings.readerBg === "white" ? "#FFF" : settings.readerBg === "dark" ? "#121218" : "#000"}
          />
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        initialNumToRender={3}
        windowSize={5}
        removeClippedSubviews
        onEndReachedThreshold={0.4}
        onScrollToIndexFailed={onScrollToIndexFailed}
      />

      {controlsVisible && (
        <View
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 14 + insets.bottom,
            gap: 10,
            zIndex: 2,
          }}
        >
          <View
            style={{
              alignItems: "center",
              paddingVertical: 4,
              paddingHorizontal: 10,
              borderRadius: 10,
              backgroundColor: colors.headerBtn,
            }}
          >
            <Text style={{ color: colors.headerBtnText, fontWeight: "700" }}>
              Tap image to show or hide. Double tap to zoom.
            </Text>
          </View>

          {resumeVisible && resumeIndex !== null && (
            <View
              style={{
                backgroundColor: colors.headerBtn,
                borderRadius: 12,
                paddingVertical: 8,
                paddingHorizontal: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Pressable
                style={{ flex: 1 }}
                onPress={() => {
                  scrollToIndex(resumeIndex);
                  setResumeVisible(false);
                }}
              >
                <Text style={{ color: colors.headerBtnText, fontWeight: "900" }}>Resume here</Text>
                <Text style={{ color: colors.subtext }}>Page {resumeIndex + 1}</Text>
              </Pressable>

              <Pressable
                onPress={() => setResumeVisible(false)}
                style={({ pressed }) => ({
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  backgroundColor: colors.border,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ color: colors.text, fontWeight: "800" }}>Dismiss</Text>
              </Pressable>
            </View>
          )}

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: colors.headerBtnText, fontWeight: "800" }}>{pageLabel}</Text>
            <Text style={{ color: colors.subtext }}>Drag to quick jump</Text>
          </View>

          <View
            ref={sliderRef}
            onLayout={(event) => {
              setSliderWidth(event.nativeEvent.layout.width);
              setTimeout(() => {
                sliderRef.current?.measureInWindow((x) => {
                  setSliderPageX(x);
                });
              }, 0);
            }}
            style={{
              height: 28,
              borderRadius: 999,
              backgroundColor: colors.headerBtn,
              justifyContent: "center",
              paddingHorizontal: sliderPadding,
            }}
            {...panResponder.panHandlers}
          >
            <View
              style={{
                height: 6,
                borderRadius: 999,
                backgroundColor: colors.border,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: "100%",
                  width: `${Math.min(100, Math.max(0, progress * 100))}%`,
                  backgroundColor: colors.text,
                }}
              />
            </View>

            <View
              style={{
                position: "absolute",
                left: Math.min(
                  Math.max(sliderPadding - 8, sliderPadding + progress * sliderUsable - 8),
                  sliderPadding + sliderUsable - 8
                ),
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: colors.text,
              }}
            />
          </View>
        </View>
      )}

      {/* Settings Panel Overlay */}
      {settingsVisible && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }}>
          <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={toggleSettings} />
          <Animated.View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: colors.header,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: 20,
              paddingBottom: insets.bottom + 20,
              transform: [
                {
                  translateY: settingsAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [300, 0],
                  }),
                },
              ],
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>Pengaturan Baca</Text>
              <Pressable onPress={toggleSettings}>
                <Text style={{ color: colors.subtext, fontSize: 20, fontWeight: "900" }}>✕</Text>
              </Pressable>
            </View>

            <View style={{ gap: 20 }}>
              {/* Image Quality */}
              <View>
                <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 10 }}>Kualitas Gambar</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {(["high", "low"] as const).map((q) => (
                    <Pressable
                      key={q}
                      onPress={() => updateSetting({ imageQuality: q })}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        alignItems: "center",
                        borderRadius: 10,
                        backgroundColor: settings.imageQuality === q ? colors.text : colors.headerBtn,
                      }}
                    >
                      <Text
                        style={{
                          color: settings.imageQuality === q ? colors.bg : colors.subtext,
                          fontWeight: settings.imageQuality === q ? "900" : "600",
                        }}
                      >
                        {q === "high" ? "High (HQ)" : "Low (Data Saver)"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Reader Background */}
              <View>
                <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 10 }}>Warna Latar (Background)</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {[
                    { val: "black", label: "Hitam", color: "#000" },
                    { val: "dark", label: "Gelap", color: "#121218" },
                    { val: "white", label: "Putih", color: "#FFF", txtColor: "#000" },
                  ].map((bg) => (
                    <Pressable
                      key={bg.val}
                      onPress={() => updateSetting({ readerBg: bg.val as any })}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        alignItems: "center",
                        borderRadius: 10,
                        backgroundColor: bg.color,
                        borderWidth: 2,
                        borderColor: settings.readerBg === bg.val ? (isDark ? "#4A90E2" : "#005bb5") : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          color: bg.txtColor || "#FFF",
                          fontWeight: settings.readerBg === bg.val ? "900" : "600",
                        }}
                      >
                        {bg.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          </Animated.View>
        </View>
      )}
    </View>
  );
}
