import { useFocusEffect } from "@react-navigation/native";
import { Image as ExpoImage } from "expo-image";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { ActivityIndicator, Modal, FlatList, Pressable, View, useWindowDimensions, Platform, ScrollView } from "react-native";
import { Text } from "@/components/ui/app-text";
import { useAppTheme } from "@/src/theme/ThemeContext";
import { getDownloadedMangaList, deleteDownloadedChapter, deleteAllDownloads, type DownloadedMangaInfo, type DownloadedChapterInfo } from "@/src/utils/downloader";

export function DownloadsTab() {
  const router = useRouter();
  const { resolved } = useAppTheme();
  const { width } = useWindowDimensions();
  const isDark = resolved === "dark";
  const colors = React.useMemo(
    () => ({
      bg: isDark ? "#0B0B0E" : "#F6F1E9",
      card: isDark ? "#121218" : "#FBF6EE",
      text: isDark ? "#F2F2F7" : "#1E2329",
      subtext: isDark ? "#B3B3C2" : "#6A625A",
      border: isDark ? "#242434" : "#E6DED2",
      chip: isDark ? "#1A1A24" : "#EFE6DA",
      ghost: isDark ? "#1A1A24" : "#F2E9DD",
      ghostText: isDark ? "#F2F2F7" : "#1E2329",
      danger: isDark ? "#FF5C5C" : "#D32F2F",
      button: isDark ? "#F2F2F7" : "#1E2329",
      buttonText: isDark ? "#0B0B0E" : "#F6F1E9",
      accent: isDark ? "#00FFF5" : "#1D1135",
    }),
    [isDark]
  );

  const [items, setItems] = React.useState<DownloadedMangaInfo[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [refreshing, setRefreshing] = React.useState<boolean>(false);
  const [expandedManga, setExpandedManga] = React.useState<Record<string, boolean>>({});

  const [customConfirm, setCustomConfirm] = React.useState<{
    visible: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const formatSize = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const totalSizeBytes = React.useMemo(() => {
    return items.reduce((sum, manga) => sum + manga.totalSizeBytes, 0);
  }, [items]);

  const load = React.useCallback(async (opts?: { silent?: boolean }) => {
    if (opts?.silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    const res = await getDownloadedMangaList();
    setItems(res);
    if (opts?.silent) {
      setRefreshing(false);
    } else {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      void load();
    }, [load])
  );

  const toggleExpand = (mangaId: string) => {
    setExpandedManga(prev => ({
      ...prev,
      [mangaId]: !prev[mangaId]
    }));
  };

  const handleDeleteChapter = React.useCallback((mangaId: string, chapterId: string, chapterTitle: string) => {
    setCustomConfirm({
      visible: true,
      title: "Hapus Unduhan Chapter?",
      description: `Apakah Anda yakin ingin menghapus "${chapterTitle}" dari unduhan lokal?`,
      onConfirm: async () => {
        await deleteDownloadedChapter(mangaId, chapterId);
        void load({ silent: true });
      },
    });
  }, [load]);

  const handleDeleteAll = React.useCallback(() => {
    setCustomConfirm({
      visible: true,
      title: "Hapus Semua Unduhan?",
      description: "Tindakan ini akan menghapus semua berkas komik offline dan membebaskan ruang penyimpanan.",
      onConfirm: async () => {
        await deleteAllDownloads();
        setItems([]);
      },
    });
  }, []);

  // Downloads are not available on web
  if (Platform.OS === 'web') {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 32,
          gap: 16,
        }}
      >
        <Ionicons
          name="phone-portrait-outline"
          size={64}
          color={colors.subtext}
          style={{ opacity: 0.4 }}
        />
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18, textAlign: "center" }}>
          Fitur Unduhan Tidak Tersedia
        </Text>
        <Text style={{ color: colors.subtext, fontSize: 14, textAlign: "center", lineHeight: 22 }}>
          Fitur unduhan hanya tersedia di aplikasi Android & iOS.{"\n"}
          Gunakan aplikasi mobile untuk mengunduh chapter dan membacanya secara offline.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 60,
          paddingHorizontal: 32,
          gap: 16,
        }}
      >
        <Ionicons
          name="cloud-download-outline"
          size={64}
          color={colors.subtext}
          style={{ opacity: 0.4 }}
        />
        <Text
          style={{
            color: colors.text,
            fontWeight: "900",
            fontSize: 18,
            textAlign: "center",
          }}
        >
          Belum ada unduhan
        </Text>
        <Text
          style={{
            color: colors.subtext,
            fontSize: 14,
            textAlign: "center",
            lineHeight: 20,
          }}
        >
          Unduh chapter manga untuk dibaca kapan saja tanpa koneksi internet.
        </Text>
        <Pressable
          onPress={() => router.push("/")}
          style={{
            backgroundColor: colors.button,
            borderRadius: 12,
            paddingVertical: 10,
            paddingHorizontal: 20,
            marginTop: 8,
          }}
        >
          <Text style={{ color: colors.buttonText, fontWeight: "900" }}>
            Cari Komik
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={items}
        keyExtractor={(it) => it.mangaId}
        contentContainerStyle={{ padding: 12, paddingBottom: 24, gap: 12 }}
        refreshing={refreshing}
        onRefresh={() => load({ silent: true })}
        ListHeaderComponent={
          <View style={{ gap: 12, paddingBottom: 8 }}>
            {/* Storage Summary Dashboard */}
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <View style={{ gap: 4 }}>
                <Text style={{ color: colors.subtext, fontSize: 13, fontWeight: "600" }}>
                  PENYIMPANAN OFFLINE
                </Text>
                <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>
                  {formatSize(totalSizeBytes)}
                </Text>
                <Text style={{ color: colors.subtext, fontSize: 12 }}>
                  Total {items.reduce((sum, m) => sum + m.chapters.length, 0)} chapter tersimpan
                </Text>
              </View>

              <Pressable
                onPress={handleDeleteAll}
                style={{
                  backgroundColor: colors.ghost,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
                <Text style={{ color: colors.danger, fontWeight: "900", fontSize: 13 }}>
                  Bersihkan
                </Text>
              </Pressable>
            </View>

            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16, marginTop: 8 }}>
              Daftar Unduhan
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isExpanded = !!expandedManga[item.mangaId];
          return (
            <View
              style={{
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                overflow: "hidden",
              }}
            >
              {/* Manga Header Row */}
              <Pressable
                onPress={() => toggleExpand(item.mangaId)}
                style={{
                  padding: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <ExpoImage
                  source={{ uri: item.mangaCoverUrl }}
                  style={{ width: 50, height: 68, borderRadius: 10, backgroundColor: colors.chip }}
                  contentFit="cover"
                  cachePolicy="disk"
                  transition={0}
                />

                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }} numberOfLines={1}>
                    {item.mangaTitle}
                  </Text>
                  <Text style={{ color: colors.subtext, fontSize: 13 }}>
                    {item.chapters.length} Chapter • {formatSize(item.totalSizeBytes)}
                  </Text>
                </View>

                <Ionicons
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={colors.subtext}
                />
              </Pressable>

              {/* Collapsible Chapters List */}
              {isExpanded && (
                <View
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    backgroundColor: isDark ? "#0e0e12" : "#fbf9f5",
                    paddingVertical: 4,
                  }}
                >
                  {item.chapters.map((ch) => (
                    <View
                      key={ch.chapterId}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingVertical: 10,
                        paddingHorizontal: 16,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <Pressable
                        onPress={() => {
                          router.push({
                            pathname: "/reader/[chapterId]",
                            params: {
                              chapterId: ch.chapterId,
                              mangaTitle: item.mangaTitle,
                              coverUrl: item.mangaCoverUrl,
                              mangaId: item.mangaId,
                            },
                          });
                        }}
                        style={{
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <Ionicons name="play-circle-outline" size={18} color={colors.accent} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14 }} numberOfLines={1}>
                            Chapter {ch.chapterNumber}
                          </Text>
                          <Text style={{ color: colors.subtext, fontSize: 12 }}>
                            {ch.chapterTitle !== `Chapter ${ch.chapterNumber}` ? ch.chapterTitle + " • " : ""}{formatSize(ch.sizeBytes)}
                          </Text>
                        </View>
                      </Pressable>

                      <Pressable
                        hitSlop={8}
                        onPress={() => handleDeleteChapter(item.mangaId, ch.chapterId, `Chapter ${ch.chapterNumber}`)}
                        style={{ padding: 4 }}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.danger} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        }}
      />
    </View>

    {/* ── Custom Confirm Modal ── */}
    {customConfirm?.visible && (
      <Modal
        visible={customConfirm.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomConfirm(null)}
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
                backgroundColor: isDark ? "rgba(255, 92, 92, 0.15)" : "rgba(211, 47, 47, 0.15)",
              }}
            >
              <Ionicons name="trash-outline" size={32} color={colors.danger} />
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
              {customConfirm.title}
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
              {customConfirm.description}
            </Text>

            <View style={{ flexDirection: "row", width: "100%", gap: 12 }}>
              <Pressable
                onPress={() => setCustomConfirm(null)}
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
                  const onConfirm = customConfirm.onConfirm;
                  setCustomConfirm(null);
                  if (onConfirm) onConfirm();
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 48,
                  borderRadius: 12,
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: colors.danger,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ color: "#FFF", fontSize: 15, fontWeight: "800" }}>Hapus</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    )}
  </>
  );
}
