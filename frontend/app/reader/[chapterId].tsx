import Ionicons from "@expo/vector-icons/Ionicons";
import { Image as ExpoImage } from "expo-image";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Platform,
  Image as RNImage,
  PanResponder,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui/app-text";
import { getChapterDetail, getChapterList, getMangaDetail } from "../../src/api/shngmClient";
import type { 
  ShngmChapter,
  ShngmChapterDetailData,
} from "../../src/api/shngmTypes";
import {
  getLatestProgressByManga,
  upsertProgress,
  markChapterAsReadLocal,
} from "../../src/store/history";
import {
  getReaderSettings,
  ReaderSettings,
  setReaderSettings,
} from "../../src/store/readerSettings";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import AnimatedReanimated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from "react-native-reanimated";
import ChapterCommentSection from "../../components/manga/ChapterCommentSection";

function joinUrl(base: string, path: string, filename: string) {
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = path.startsWith("/") ? path : `/${path}`;
  const pp = p.endsWith("/") ? p : `${p}/`;
  return `${b}${pp}${filename}`;
}

type PageItem = {
  key: string;
  index: number;
  url: string;
};

const sizeCache = new Map<string, number>();

const SliderCustom = ({
  value,
  min = 30,
  max = 100,
  onChange,
  disabled = false,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (val: number) => void;
  disabled?: boolean;
}) => {
  const [layoutWidth, setLayoutWidth] = React.useState(0);

  const handleTouch = (event: any) => {
    if (disabled || layoutWidth === 0) return;
    const locationX = event.nativeEvent.locationX;
    const percentage = Math.max(0, Math.min(1, locationX / layoutWidth));
    const rawVal = min + percentage * (max - min);
    onChange(Math.round(rawVal));
  };

  const percentage = (value - min) / (max - min);

  return (
    <View
      onLayout={(e) => {
        setLayoutWidth(e.nativeEvent.layout.width);
      }}
      onTouchStart={handleTouch}
      onTouchMove={handleTouch}
      style={{
        height: 40,
        justifyContent: "center",
        width: "100%",
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <View 
        pointerEvents="none"
        style={{ height: 6, borderRadius: 3, backgroundColor: "#1A1A24", position: "relative" }}
      >
        <View
          style={{
            height: "100%",
            width: `${percentage * 100}%`,
            borderRadius: 3,
            backgroundColor: "#4A8FE2",
          }}
        />
        <View
          style={{
            position: "absolute",
            top: -6,
            left: `${percentage * 100}%`,
            marginLeft: -9,
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: "#F2F2F7",
            borderWidth: 2,
            borderColor: "#4A8FE2",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 2,
            elevation: 3,
          }}
        />
      </View>
    </View>
  );
};

function PageImage({
  uri,
  onSingleTap,
  bg,
  contentWidth,
}: {
  uri: string;
  onSingleTap: () => void;
  bg: string;
  contentWidth: number;
}) {
  const screenW = Dimensions.get("window").width;
  const imgW = contentWidth;
  const cachedRatio = sizeCache.get(uri);
  const [height, setHeight] = React.useState<number>(imgW * (cachedRatio ?? 1.4));

  React.useEffect(() => {
    if (cachedRatio) {
      setHeight(imgW * cachedRatio);
    }
  }, [cachedRatio, imgW]);

  const [isZoomed, setIsZoomed] = React.useState(false);
  const [loadingState, setLoadingState] = React.useState({ loading: true, progress: 0 });

  // Reanimated shared values for zoom/pan gestures
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const maxScale = 4;
  const minScale = 1;

  // Double Tap gesture: Toggles between 1x and 2.5x scale
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((_event, success) => {
      if (success) {
        if (scale.value > 1) {
          scale.value = withTiming(1);
          translateX.value = withTiming(0);
          translateY.value = withTiming(0);
          savedScale.value = 1;
          savedTranslateX.value = 0;
          savedTranslateY.value = 0;
          runOnJS(setIsZoomed)(false);
        } else {
          scale.value = withTiming(2.5);
          savedScale.value = 2.5;
          runOnJS(setIsZoomed)(true);
        }
      }
    });

  // Single Tap gesture: Toggles UI overlay controls
  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .requireExternalGestureToFail(doubleTap)
    .onEnd((_event, success) => {
      if (success) {
        runOnJS(onSingleTap)();
      }
    });

  // Pinch gesture for multi-touch zoom
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.max(minScale, Math.min(savedScale.value * event.scale, maxScale));
      if (scale.value > 1 && !isZoomed) {
        runOnJS(setIsZoomed)(true);
      }
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1.1) {
        scale.value = withTiming(1);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        runOnJS(setIsZoomed)(false);
      }
    });

  // Pan gesture for dragging while zoomed in
  const panGesture = Gesture.Pan()
    .enabled(isZoomed)
    .onUpdate((event) => {
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + event.translationX;
        translateY.value = savedTranslateY.value + event.translationY;
      }
    })
    .onEnd(() => {
      if (scale.value > 1) {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      }
    });

  const composedGesture = Gesture.Simultaneous(
    Gesture.Exclusive(doubleTap, singleTap),
    Gesture.Simultaneous(pinchGesture, panGesture)
  );

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  return (
    <GestureDetector gesture={composedGesture}>
      <View style={{ width: screenW, backgroundColor: bg, alignItems: "center", overflow: "hidden", position: "relative" }}>
        <AnimatedReanimated.View style={[{ width: imgW, height }, animatedStyle]}>
          <ExpoImage
            source={{ uri }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            cachePolicy="disk"
            transition={0}
            onLoadStart={() => setLoadingState({ loading: true, progress: 0 })}
            onProgress={({ loaded, total }) => {
              const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
              setLoadingState({ loading: true, progress: pct });
            }}
            onLoad={(event) => {
              setLoadingState({ loading: false, progress: 100 });
              if (event.source) {
                const ratio = event.source.height / event.source.width;
                sizeCache.set(uri, ratio);
                setHeight(imgW * ratio);
              }
            }}
            onError={() => setLoadingState({ loading: false, progress: 0 })}
          />
          {loadingState.loading && (
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(11, 11, 14, 0.96)",
                justifyContent: "center",
                alignItems: "center",
                gap: 12,
              }}
            >
              <ActivityIndicator color="#4A8FE2" size="large" />
              <Text style={{ color: "#F2F2F7", fontWeight: "900", fontSize: 13 }}>
                Memuat Halaman... {loadingState.progress}%
              </Text>
            </View>
          )}
        </AnimatedReanimated.View>
      </View>
    </GestureDetector>
  );
}

const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 60 };

export default function ReaderScreen() {
  React.useEffect(() => {
    const tag = "itzkomik-reader";
    let active = true;
    let activated = false;

    try {
      activateKeepAwakeAsync(tag)
        .then(() => {
          if (active) {
            activated = true;
          } else {
            try {
              void deactivateKeepAwake(tag).catch(() => {});
            } catch (e) {}
          }
        })
        .catch((err) => {
          console.warn("Keep awake activation denied/failed:", err);
        });
    } catch (e) {}

    return () => {
      active = false;
      if (activated) {
        try {
          void deactivateKeepAwake(tag).catch(() => {});
        } catch (e) {}
      }
    };
  }, []);
  const router = useRouter();
  const { chapterId, mangaTitle, coverUrl, mangaId: mangaIdParam } = useLocalSearchParams<{
    chapterId: string;
    mangaTitle?: string;
    coverUrl?: string;
    mangaId?: string;
  }>();
  const id = typeof chapterId === "string" ? chapterId : "";
  const safeTitle = typeof mangaTitle === "string" ? mangaTitle : "";
  const safeCoverUrl = typeof coverUrl === "string" ? coverUrl : "";

  const insets = useSafeAreaInsets();

  const [fetchedMangaTitle, setFetchedMangaTitle] = React.useState<string | null>(null);
  const [fetchedCoverUrl, setFetchedCoverUrl] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState<string>("Reader");
  const [chapterData, setChapterData] =
    React.useState<ShngmChapterDetailData | null>(null);
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
  const [loadingNext, setLoadingNext] = React.useState<boolean>(false);

  // Settings state
  const [settings, setSettings] = React.useState<ReaderSettings>({
    imageQuality: "high",
    readerBg: "black",
    readingMode: "scroll",
    imageWidth: 100,
    fitToWidth: true,
  });

  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = screenWidth >= 1024; // Naikkan threshold ke 1024 agar tidak kena di HP high-res
  const defaultWidth = isDesktop ? Math.min(640, screenWidth * 0.65) : Math.min(screenWidth, 500);
  const contentWidth = settings.fitToWidth ? defaultWidth : (screenWidth * (settings.imageWidth / 100));
  const [settingsVisible, setSettingsVisible] = React.useState(false);
  const settingsAnim = React.useRef(new Animated.Value(0)).current;
  const [chapterListVisible, setChapterListVisible] = React.useState(false);
  const chapterListAnim = React.useRef(new Animated.Value(0)).current;

  const [chapters, setChapters] = React.useState<ShngmChapter[]>([]);

  React.useEffect(() => {
    void getReaderSettings().then(setSettings);
  }, []);

  const updateSetting = React.useCallback(
    async (partial: Partial<ReaderSettings>) => {
      const next = await setReaderSettings(partial);
      setSettings(next);
    },
    [],
  );

  const toggleSettings = React.useCallback(() => {
    const next = !settingsVisible;
    setSettingsVisible(next);
    Animated.timing(settingsAnim, {
      toValue: next ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [settingsVisible, settingsAnim]);

  const toggleChapterList = React.useCallback(() => {
    const next = !chapterListVisible;
    setChapterListVisible(next);
    Animated.timing(chapterListAnim, {
      toValue: next ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [chapterListVisible, chapterListAnim]);



  // Load chapter list when mangaId is known
  React.useEffect(() => {
    if (!mangaId) return;
    void getChapterList({ mangaId, page: 1, pageSize: 200 })
      .then((res) => setChapters(res.data))
      .catch(() => {});
  }, [mangaId]);

  const [isOfflineReader, setIsOfflineReader] = React.useState<boolean>(false);

  const pages = React.useMemo(() => {
    if (!chapterData) return [];
    if (isOfflineReader) {
      // Offline reading is native-only
      const FileSystem = require('expo-file-system/src/legacy');
      const localDir = `${FileSystem.documentDirectory}downloaded_manga/${mangaId}/${id}/`;
      return chapterData.chapter.data.map((filename, idx) => ({
        key: `${chapterData.chapter_id}:${idx}:${filename}`,
        index: idx,
        url: `${localDir}${filename}`,
      }));
    }
    const base =
      settings.imageQuality === "low"
        ? chapterData.base_url_low
        : chapterData.base_url;
    const path = chapterData.chapter.path;
    return chapterData.chapter.data.map((filename, idx) => ({
      key: `${chapterData.chapter_id}:${idx}:${filename}`,
      index: idx,
      url: joinUrl(base, path, filename),
    }));
  }, [chapterData, isOfflineReader, settings.imageQuality, mangaId, id]);

  const load = React.useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);
      setIsOfflineReader(false);

      let d: ShngmChapterDetailData | null = null;
      let offlineMode = false;

      // Native offline reading only — skip on web
      if (Platform.OS !== 'web') {
        const FileSystem = require('expo-file-system/src/legacy');
        const rootDir = `${FileSystem.documentDirectory}downloaded_manga/`;
        let manifestPath = "";

        try {
          if (mangaIdParam) {
            const chapDir = `${rootDir}${mangaIdParam}/${id}`;
            const manifestFile = `${chapDir}/manifest.json`;
            const manifestInfo = await FileSystem.getInfoAsync(manifestFile);
            if (manifestInfo.exists) {
              manifestPath = manifestFile;
            }
          }

          if (!manifestPath) {
            const rootDirNoSlash = rootDir.endsWith('/') ? rootDir.slice(0, -1) : rootDir;
            const rootInfo = await FileSystem.getInfoAsync(rootDirNoSlash);
            if (rootInfo.exists) {
              const mangaDirs = await FileSystem.readDirectoryAsync(rootDirNoSlash + '/');
              for (const mId of mangaDirs) {
                const chapDir = `${rootDir}${mId}/${id}`;
                const manifestFile = `${chapDir}/manifest.json`;
                const manifestInfo = await FileSystem.getInfoAsync(manifestFile);
                if (manifestInfo.exists) {
                  manifestPath = manifestFile;
                  break;
                }
              }
            }
          }
        } catch {}

        if (manifestPath) {
          const raw = await FileSystem.readAsStringAsync(manifestPath);
          const manifest = JSON.parse(raw);
          d = {
            chapter_id: String(manifest.chapterId || id),
            manga_id: String(manifest.mangaId || mangaIdParam || ""),
            chapter_number: manifest.chapterNumber,
            chapter_title: manifest.chapterTitle,
            prev_chapter_id: "",
            next_chapter_id: "",
            base_url: manifest.base_url,
            base_url_low: manifest.base_url_low || manifest.base_url,
            chapter: {
              path: manifest.chapter.path,
              data: manifest.chapter.data
            }
          } as unknown as ShngmChapterDetailData;
          offlineMode = true;
        }
      }

      if (!offlineMode || !d) {
        const res = await getChapterDetail(id);
        d = res.data;
      }

      setMangaId(d.manga_id);
      setChapterNumber(d.chapter_number);
      setTitle(`Ch ${d.chapter_number}`);

      if (!safeTitle || !safeCoverUrl) {
        try {
          const mangaRes = await getMangaDetail(d.manga_id);
          if (!safeTitle) setFetchedMangaTitle(mangaRes.data.title);
          if (!safeCoverUrl) setFetchedCoverUrl(mangaRes.data.cover_portrait_url || mangaRes.data.cover_image_url || "");
        } catch {}
      }

      setPrevId(d.prev_chapter_id);
      setNextId(d.next_chapter_id);
      setIsOfflineReader(offlineMode);


      setChapterData(d);

      setCurrentIndex(0);
      setScrubIndex(null);
      scrubIndexRef.current = null;
      setResumeIndex(null);
      setResumeVisible(false);
      setLoadingNext(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id, mangaIdParam, safeTitle, safeCoverUrl]);

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
      mangaTitle: fetchedMangaTitle || safeTitle || undefined,
      coverUrl: fetchedCoverUrl || safeCoverUrl || undefined,
    });
    void markChapterAsReadLocal(mangaId, id);
  }, [mangaId, id, chapterNumber, pages.length, safeTitle, safeCoverUrl, fetchedMangaTitle, fetchedCoverUrl]);

  // Next chapter background prefetching
  React.useEffect(() => {
    if (!nextId || isOfflineReader) return;

    let active = true;
    const timer = setTimeout(async () => {
      try {
        const res = await getChapterDetail(nextId);
        if (!active) return;
        
        const nextData = res.data;
        if (!nextData || !nextData.chapter || !Array.isArray(nextData.chapter.data)) {
          return;
        }

        const base = settings.imageQuality === "low" ? nextData.base_url_low : nextData.base_url;
        const path = nextData.chapter.path;
        if (!base || !path) return;

        const urls = nextData.chapter.data
          .map((filename: string) => {
            if (!filename) return "";
            return joinUrl(base, path, filename);
          })
          .filter((url: string) => url && (url.startsWith("http://") || url.startsWith("https://")));
        
        // Prefetch each url sequentially to prevent overloading and native crashes
        for (const url of urls) {
          if (!active) break;
          try {
            await ExpoImage.prefetch(url);
          } catch (err) {
            console.warn("Safe prefetch failed for:", url, err);
          }
        }
      } catch (err) {
        console.warn("Background prefetch failed:", err);
      }
    }, 3000); // 3 seconds delay to prioritize current chapter loading

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [nextId, isOfflineReader, settings.imageQuality]);

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
      
      // Prefetch and pre-measure only remote HTTP/HTTPS URLs
      if (url.startsWith("http://") || url.startsWith("https://")) {
        void RNImage.prefetch(url).catch(() => undefined);

        // Pre-measure image size to populate sizeCache
        if (!sizeCache.has(url)) {
          RNImage.getSize(
            url,
            (w: number, h: number) => {
              sizeCache.set(url, h / w);
            },
            () => {}
          );
        }
      }
    });
  }, [currentIndex, pages]);

  const progressDataRef = React.useRef({ mangaId, id, chapterNumber, totalPages: pages.length, safeTitle: fetchedMangaTitle || safeTitle, safeCoverUrl: fetchedCoverUrl || safeCoverUrl });
  progressDataRef.current = { mangaId, id, chapterNumber, totalPages: pages.length, safeTitle: fetchedMangaTitle || safeTitle, safeCoverUrl: fetchedCoverUrl || safeCoverUrl };

  const onViewableItemsChanged = React.useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      const first = viewableItems
        .map((v) => v.index)
        .find((idx): idx is number => typeof idx === "number" && idx >= 0);

      if (first === undefined) return;
      setCurrentIndex(first);

      const now = Date.now();
      if (now - lastSavedRef.current < 2000) return;
      lastSavedRef.current = now;

      const pd = progressDataRef.current;
      if (!pd.mangaId || !pd.id) return;

      void upsertProgress({
        mangaId: pd.mangaId,
        chapterId: pd.id,
        chapterNumber: pd.chapterNumber,
        pageIndex: first,
        totalPages: pd.totalPages,
        updatedAt: now,
        mangaTitle: pd.safeTitle || undefined,
        coverUrl: pd.safeCoverUrl || undefined,
      });
    }
  ).current;

  const renderFooter = React.useCallback(() => {
    const isReaderWhite = settings.readerBg === "white";
    const pageBgColor = isReaderWhite ? "#FFF" : settings.readerBg === "dark" ? "#121218" : "#000";
    const prevBtnTextColor = isReaderWhite ? "#1E2329" : "#F2F2F7";
    
    return (
      <View style={{ backgroundColor: pageBgColor, paddingBottom: insets.bottom + 40 }}>
        {/* Navigation Buttons Row */}
        <View style={{ flexDirection: "row", gap: 10, paddingVertical: 12, width: contentWidth, alignSelf: "center", paddingHorizontal: 16, justifyContent: "center" }}>
          {/* Prev Chapter Button */}
          {!!prevId && (
            <Pressable
              onPress={() => {
                router.replace({
                  pathname: "/reader/[chapterId]",
                  params: { chapterId: prevId, mangaTitle: safeTitle, coverUrl: safeCoverUrl, mangaId: mangaId },
                });
              }}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isReaderWhite ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)",
                borderWidth: 1,
                borderColor: isReaderWhite ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)",
                paddingVertical: 10,
                borderRadius: 10,
                opacity: pressed ? 0.75 : 1,
                gap: 6,
                maxWidth: 160,
              })}
            >
              <Ionicons name="arrow-back" size={16} color={prevBtnTextColor} />
              <Text style={{ color: prevBtnTextColor, fontWeight: "900", fontSize: 13 }}>
                Sebelumnya
              </Text>
            </Pressable>
          )}

          {/* Next Chapter Button */}
          {!!nextId && (
            <Pressable
              onPress={() => {
                router.replace({
                  pathname: "/reader/[chapterId]",
                  params: { chapterId: nextId, mangaTitle: safeTitle, coverUrl: safeCoverUrl, mangaId: mangaId },
                });
              }}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#4A8FE2",
                paddingVertical: 10,
                borderRadius: 10,
                opacity: pressed ? 0.85 : 1,
                gap: 6,
                maxWidth: 160,
              })}
            >
              <Text style={{ color: "#FFF", fontWeight: "900", fontSize: 13 }}>
                Selanjutnya
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#FFF" />
            </Pressable>
          )}
        </View>

        {/* If no next chapter, show indicator */}
        {!nextId && (
          <View style={{ paddingVertical: 15, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: settings.readerBg === "white" ? "rgba(0,0,0,0.4)" : "rgba(242,242,247,0.4)", fontWeight: "700" }}>Akhir dari Manga ini</Text>
          </View>
        )}

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: settings.readerBg === "white" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)", marginVertical: 20, width: contentWidth, alignSelf: "center" }} />

        {/* Comment Section Container */}
        <View style={{ width: contentWidth, alignSelf: "center", paddingHorizontal: isDesktop ? 0 : 16 }}>
          {mangaId && id ? (
            <ChapterCommentSection
              mangaId={mangaId}
              chapterId={id}
              chapterNumber={chapterNumber || undefined}
              isNested={true}
              readerBg={settings.readerBg}
            />
          ) : null}
        </View>
      </View>
    );
  }, [nextId, prevId, settings.readerBg, mangaId, id, chapterNumber, safeTitle, safeCoverUrl, insets.bottom, router, contentWidth, isDesktop]);

  const handleToggleControls = React.useCallback(() => {
    setControlsVisible((v) => !v);
  }, []);

  const scrollToIndex = React.useCallback((index: number, animated = true) => {
    listRef.current?.scrollToIndex({ index, animated });
  }, []);

  const onScrollToIndexFailed = React.useCallback(
    (info: { index: number; highestMeasuredFrameIndex: number }) => {
      const target = Math.max(
        0,
        Math.min(info.index, info.highestMeasuredFrameIndex),
      );
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index: target, animated: false });
      }, 60);
    },
    [],
  );

  const totalPages = pages.length;
  const displayIndex =
    isScrubbing && scrubIndex !== null ? scrubIndex : currentIndex;
  const pageLabel =
    totalPages > 0 ? `${displayIndex + 1} / ${totalPages}` : "0 / 0";
  const progress = totalPages > 0 ? (displayIndex + 1) / totalPages : 0;
  const sliderPadding = 10;
  const sliderUsable = Math.max(1, sliderWidth - sliderPadding * 2);

  const handleSliderTouch = React.useCallback(
    (x: number) => {
      if (totalPages <= 0 || sliderUsable <= 0) return;
      const localX = Math.max(0, Math.min(sliderUsable, x - sliderPadding));
      const ratio = Math.max(0, Math.min(1, localX / sliderUsable));
      const idx = Math.min(
        totalPages - 1,
        Math.max(0, Math.round(ratio * (totalPages - 1))),
      );
      setScrubIndex(idx);
      scrubIndexRef.current = idx;
    },
    [sliderPadding, sliderUsable, totalPages],
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
    [handleSliderTouch, scrollToIndex, sliderPageX],
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#F2F2F7" />
        <Text style={{ marginTop: 8, color: "#B3B3C2" }}>Memuat chapter...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", padding: 20, gap: 12, paddingTop: insets.top + 20 }}>
        <Pressable
          onPress={() => router.back()}
          style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color="#F2F2F7" />
          <Text style={{ color: "#F2F2F7", fontWeight: "700" }}>Kembali</Text>
        </Pressable>
        <Text style={{ fontWeight: "900", color: "#F2F2F7", fontSize: 16 }}>Gagal load chapter</Text>
        <Text style={{ color: "#B3B3C2" }}>{error}</Text>
        <Pressable
          onPress={() => void load()}
          style={{ paddingVertical: 12, paddingHorizontal: 14, backgroundColor: "#1A1A24", borderRadius: 12, alignSelf: "flex-start" }}
        >
          <Text style={{ color: "#F2F2F7", fontWeight: "900" }}>Coba Lagi</Text>
        </Pressable>
      </View>
    );
  }

  const pageBg = settings.readerBg === "white" ? "#FFF" : settings.readerBg === "dark" ? "#121218" : "#000";
  const ICON_SIZE = 22;
  const ICON_COLOR = "#F2F2F7";
  const ICON_DISABLED = "rgba(242,242,247,0.28)";
  const BOX = {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(14,14,20,0.92)" as const,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000" }}>

      {/* ── Top Header (breadcrumb) ──────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════
          TOP HEADER — 3-level breadcrumb
          Layout: [←] [MangaTitle › ChapterNum › ArcTitle] [🏠]
          Matches screenshots exactly.
      ══════════════════════════════════════════════════════════════════════ */}
      {controlsVisible && (
        <View
          style={{
            paddingTop: insets.top + (Platform.OS === "android" ? 4 : 0),
            paddingBottom: 10,
            paddingHorizontal: 14,
            backgroundColor: "rgba(12,12,18,0.97)",
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            borderBottomWidth: 1,
            borderBottomColor: "rgba(255,255,255,0.07)",
            zIndex: 10,
          }}
        >
          {/* Back arrow */}
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
          >
            <Ionicons name="arrow-back" size={22} color="#F2F2F7" />
          </Pressable>
 
          {/* Breadcrumb: MangaTitle › Chapter N › Arc */}
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", overflow: "hidden" }}>
            {/* Manga title */}
            <Text
              numberOfLines={1}
              style={{
                color: "#F2F2F7",
                fontWeight: "700",
                fontSize: 13,
                flexShrink: 1,
                flexGrow: 0,
                maxWidth: isDesktop ? 260 : 100,
              }}
            >
              {fetchedMangaTitle || safeTitle || "Judul Manga"}
            </Text>
 
            {/* Separator 1 */}
            <Text style={{ color: "rgba(242,242,247,0.4)", fontSize: 13, marginHorizontal: 4 }}>›</Text>
 
            {/* Chapter number — highlighted blue */}
            <Text
              numberOfLines={1}
              style={{
                color: "#4A8FE2",
                fontWeight: "700",
                fontSize: 13,
                flexShrink: 1,
                flexGrow: 0,
                maxWidth: isDesktop ? 120 : 72,
              }}
            >
              {title}
            </Text>

            {/* Arc / Subtitle (optional) */}
            {!!chapterData?.chapter_title && (
              <>
                <Text style={{ color: "rgba(242,242,247,0.4)", fontSize: 13, marginHorizontal: 4 }}>›</Text>
                <Text
                  numberOfLines={1}
                  style={{
                    color: "#4A8FE2",
                    fontWeight: "700",
                    fontSize: 13,
                    flexShrink: 1,
                    flexGrow: 0,
                    maxWidth: isDesktop ? 160 : 90,
                  }}
                >
                  {chapterData.chapter_title}
                </Text>
              </>
            )}
          </View>

          {/* Home icon — right side */}
          <Pressable
            onPress={() => router.push("/")}
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
          >
            <Ionicons name="home-outline" size={21} color="#F2F2F7" />
          </Pressable>
        </View>
      )}
 
      {/* ── Pages ──────────────────────────────────────────── */}
      <FlatList
        ref={listRef}
        data={pages}
        keyExtractor={(it) => it.key}
        style={{ backgroundColor: pageBg }}
        renderItem={({ item }) => (
          <PageImage
            uri={item.url}
            onSingleTap={handleToggleControls}
            bg={pageBg}
            contentWidth={contentWidth}
          />
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY_CONFIG}
        initialNumToRender={3}
        windowSize={5}
        removeClippedSubviews
        ListFooterComponent={renderFooter}
        onScrollToIndexFailed={onScrollToIndexFailed}
      />
 
      {controlsVisible && (
        <>
          {/* ── Resume banner ───────────────────────────────── */}
          {resumeVisible && resumeIndex !== null && (
            <View
              style={{
                position: "absolute",
                top: insets.top + 56,
                left: 16, right: 16,
                backgroundColor: "rgba(26,26,36,0.97)",
                borderRadius: 14,
                paddingVertical: 10,
                paddingHorizontal: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                zIndex: 8,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.1)",
              }}
            >
              <Pressable style={{ flex: 1 }} onPress={() => { scrollToIndex(resumeIndex); setResumeVisible(false); }}>
                <Text style={{ color: "#F2F2F7", fontWeight: "900" }}>Lanjutkan di halaman {resumeIndex + 1}</Text>
                <Text style={{ color: "#B3B3C2", fontSize: 12 }}>Tap untuk loncat ke sana</Text>
              </Pressable>
              <Pressable onPress={() => setResumeVisible(false)} style={{ padding: 6 }}>
                <Ionicons name="close" size={18} color="#B3B3C2" />
              </Pressable>
            </View>
          )}

          {/* ── Floating scroll up/down (right) ─────────────── */}
          <View
            style={{
              position: "absolute",
              right: 12,
              bottom: insets.bottom + 90,
              gap: 8,
              zIndex: 8,
            }}
          >
            <Pressable
              onPress={() => scrollToIndex(0)}
              style={({ pressed }) => ({ ...BOX, opacity: pressed ? 0.7 : 1 })}
            >
              <Ionicons name="chevron-up" size={ICON_SIZE} color={ICON_COLOR} />
            </Pressable>
            <Pressable
              onPress={() => listRef.current?.scrollToEnd({ animated: true })}
              style={({ pressed }) => ({ ...BOX, opacity: pressed ? 0.7 : 1 })}
            >
              <Ionicons name="chevron-down" size={ICON_SIZE} color={ICON_COLOR} />
            </Pressable>
          </View>

          {/* ── Floating bottom toolbar (4 box buttons) ──────── */}
          <View
            style={{
              position: "absolute",
              bottom: insets.bottom + 16,
              left: 0,
              right: 0,
              alignItems: "center",
              zIndex: 8,
            }}
          >

            {/* 4 box buttons row */}
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              {/* Prev chapter */}
              <Pressable
                disabled={!prevId}
                onPress={() =>
                  prevId && router.replace({
                    pathname: "/reader/[chapterId]",
                    params: { chapterId: prevId, mangaTitle: safeTitle, coverUrl: safeCoverUrl, mangaId: mangaId },
                  })
                }
                style={({ pressed }) => ({
                  ...BOX,
                  opacity: prevId ? (pressed ? 0.6 : 1) : 0.3,
                })}
              >
                <Ionicons name="chevron-back" size={ICON_SIZE} color={prevId ? ICON_COLOR : ICON_DISABLED} />
              </Pressable>

              {/* Settings */}
              <Pressable
                onPress={toggleSettings}
                style={({ pressed }) => ({ ...BOX, opacity: pressed ? 0.6 : 1 })}
              >
                <Ionicons name="settings-outline" size={ICON_SIZE} color={ICON_COLOR} />
              </Pressable>

              {/* Chapter list */}
              <Pressable
                onPress={toggleChapterList}
                style={({ pressed }) => ({ ...BOX, opacity: pressed ? 0.6 : 1 })}
              >
                <Ionicons name="list-outline" size={ICON_SIZE} color={ICON_COLOR} />
              </Pressable>

              {/* Home */}
              <Pressable
                onPress={() => router.push("/")}
                style={({ pressed }) => ({ ...BOX, opacity: pressed ? 0.6 : 1 })}
              >
                <Ionicons name="home-outline" size={ICON_SIZE} color={ICON_COLOR} />
              </Pressable>

              {/* Next chapter */}
              <Pressable
                disabled={!nextId}
                onPress={() =>
                  nextId && router.replace({
                    pathname: "/reader/[chapterId]",
                    params: { chapterId: nextId, mangaTitle: safeTitle, coverUrl: safeCoverUrl, mangaId: mangaId },
                  })
                }
                style={({ pressed }) => ({
                  ...BOX,
                  opacity: nextId ? (pressed ? 0.6 : 1) : 0.3,
                })}
              >
                <Ionicons name="chevron-forward" size={ICON_SIZE} color={nextId ? ICON_COLOR : ICON_DISABLED} />
              </Pressable>
            </View>
          </View>
        </>
      )}

      {/* ── Chapter List Panel (bottom sheet) ───────────────── */}
      {chapterListVisible && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 }}>
          <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }} onPress={toggleChapterList} />
          <Animated.View
            style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              backgroundColor: "#121218",
              borderTopLeftRadius: 20, borderTopRightRadius: 20,
              paddingTop: 16, paddingBottom: insets.bottom + 12,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
              maxHeight: "70%",
              transform: [{ translateY: chapterListAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }],
            }}
          >
            {/* Handle bar */}
            <View style={{ alignItems: "center", marginBottom: 12 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)" }} />
            </View>
            {/* Header */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 12 }}>
              <Text style={{ color: "#F2F2F7", fontSize: 17, fontWeight: "900" }}>Daftar Chapter</Text>
              <Pressable onPress={toggleChapterList} hitSlop={10}>
                <Ionicons name="close" size={22} color="#B3B3C2" />
              </Pressable>
            </View>
            {/* Chapter list */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 8, gap: 6 }}
            >
              {chapters.length === 0 ? (
                <Text style={{ color: "#B3B3C2", textAlign: "center", paddingVertical: 20 }}>Memuat chapter...</Text>
              ) : (
                chapters.map((ch) => {
                  const isActive = String(ch.chapter_id) === id;
                  return (
                    <Pressable
                      key={ch.chapter_id}
                      onPress={() => {
                        toggleChapterList();
                        if (!isActive) {
                          router.replace({
                            pathname: "/reader/[chapterId]",
                            params: { chapterId: String(ch.chapter_id), mangaTitle: safeTitle, coverUrl: safeCoverUrl },
                          });
                        }
                      }}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 12,
                        paddingHorizontal: 14,
                        borderRadius: 12,
                        backgroundColor: isActive ? "rgba(74,143,226,0.18)" : (pressed ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.03)"),
                        borderWidth: 1,
                        borderColor: isActive ? "rgba(74,143,226,0.4)" : "rgba(255,255,255,0.06)",
                        gap: 10,
                      })}
                    >
                      <Ionicons
                        name={isActive ? "book-outline" : "document-text-outline"}
                        size={16}
                        color={isActive ? "#4A8FE2" : "#B3B3C2"}
                      />
                      <Text style={{ flex: 1, color: isActive ? "#4A8FE2" : "#F2F2F7", fontWeight: isActive ? "900" : "600", fontSize: 14 }}>
                        Ch {ch.chapter_number}
                        {ch.chapter_title ? `  —  ${ch.chapter_title}` : ""}
                      </Text>
                      {isActive && (
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#4A8FE2" }} />
                      )}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Animated.View>
        </View>
      )}

      {/* ── Settings Panel (bottom sheet) ───────────────────── */}
      {settingsVisible && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 }}>
          <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }} onPress={toggleSettings} />
          <Animated.View
            style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              backgroundColor: "#121218",
              borderTopLeftRadius: 20, borderTopRightRadius: 20,
              padding: 20, paddingBottom: insets.bottom + 20,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
              transform: [{ translateY: settingsAnim.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }) }],
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <Text style={{ color: "#F2F2F7", fontSize: 18, fontWeight: "900" }}>Pengaturan Baca</Text>
              <Pressable onPress={toggleSettings} hitSlop={10}>
                <Ionicons name="close" size={22} color="#B3B3C2" />
              </Pressable>
            </View>
            <View style={{ gap: 20 }}>
              {/* Fit To Width (Otomatis) */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text style={{ color: "#F2F2F7", fontWeight: "700" }}>Fit To Width (Otomatis)</Text>
                  <Text style={{ color: "#B3B3C2", fontSize: 12 }}>Menyesuaikan gambar ke lebar layar default</Text>
                </View>
                <Pressable
                  onPress={() => {
                    const nextFit = !settings.fitToWidth;
                    updateSetting({
                      fitToWidth: nextFit,
                      imageWidth: nextFit ? 100 : settings.imageWidth,
                    });
                  }}
                  style={{
                    width: 50,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: settings.fitToWidth ? "#4A8FE2" : "#1A1A24",
                    padding: 2,
                    justifyContent: "center",
                  }}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: "#FFF",
                      alignSelf: settings.fitToWidth ? "flex-end" : "flex-start",
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.2,
                      shadowRadius: 2,
                      elevation: 2,
                    }}
                  />
                </Pressable>
              </View>

              {/* Image Width (Slider) */}
              <View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <Text style={{ color: "#F2F2F7", fontWeight: "700" }}>Lebar Gambar (Image Width)</Text>
                  <Text style={{ color: "#4A8FE2", fontWeight: "800", fontSize: 13 }}>
                    {settings.fitToWidth ? "Default (Otomatis)" : `${settings.imageWidth}%`}
                  </Text>
                </View>
                <SliderCustom
                  value={settings.imageWidth}
                  onChange={(val) => {
                    updateSetting({
                      imageWidth: val,
                      fitToWidth: false,
                    });
                  }}
                  disabled={settings.fitToWidth}
                />
              </View>
              {/* Background */}
              <View>
                <Text style={{ color: "#F2F2F7", fontWeight: "700", marginBottom: 10 }}>Warna Latar</Text>
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
                        flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10,
                        backgroundColor: bg.color,
                        borderWidth: 2,
                        borderColor: settings.readerBg === bg.val ? "#4A8FE2" : "transparent",
                      }}
                    >
                      <Text style={{ color: bg.txtColor || "#FFF", fontWeight: settings.readerBg === bg.val ? "900" : "600" }}>
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

    </GestureHandlerRootView>
  );
}
