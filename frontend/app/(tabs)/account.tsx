import React from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  TextInput,
  View,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/app-text";
import { useAppTheme } from "@/src/theme/ThemeContext";
import {
  getProfile,
  signIn,
  register,
  signOut,
  refreshProfile,
  type AccountProfile,
} from "@/src/store/account";
import {
  getReaderSettings,
  setReaderSettings,
  type ReaderSettings,
} from "@/src/store/readerSettings";
import { KomikamApiError } from "@/src/api/komikamApi";
import { router } from "expo-router";
import { getAllHistory } from "@/src/store/history";
import { getBookmarks } from "@/src/store/bookmarks";

type AuthMode = "login" | "register";

function formatTime(ts?: string | number): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("id-ID");
}

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { resolved, setMode, mode } = useAppTheme();
  const isDark = resolved === "dark";

  const colors = React.useMemo(
    () => ({
      bg:          isDark ? "#0B0B0E" : "#F6F1E9",
      card:        isDark ? "#121218" : "#FBF6EE",
      text:        isDark ? "#F2F2F7" : "#1E2329",
      subtext:     isDark ? "#B3B3C2" : "#6A625A",
      border:      isDark ? "#242434" : "#E6DED2",
      chip:        isDark ? "#1A1A24" : "#EFE6DA",
      ghost:       isDark ? "#1A1A24" : "#F2E9DD",
      ghostText:   isDark ? "#F2F2F7" : "#1E2329",
      primary:     isDark ? "#F2F2F7" : "#1E2A3A",
      primaryText: isDark ? "#111111" : "#F7F2EA",
      danger:      isDark ? "#FF5C5C" : "#D32F2F",
      inputBg:     isDark ? "#121218" : "#FBF6EE",
      placeholder: isDark ? "#7E7E91" : "#9A8F83",
      accent:      isDark ? "#6C63FF" : "#3B30CC",
    }),
    [isDark]
  );

  // ── State ────────────────────────────────────────────────────────────────
  const [profile, setProfile]   = React.useState<AccountProfile | null>(null);
  const [authMode, setAuthMode] = React.useState<AuthMode>("login");
  const [name, setName]         = React.useState("");
  const [email, setEmail]       = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading]   = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [message, setMessage]   = React.useState<{ text: string; isError: boolean } | null>(null);
  const [settings, setSettings] = React.useState<ReaderSettings>({
    imageQuality: "high",
    readerBg: "black",
    readingMode: "scroll",
    imageWidth: 100,
    fitToWidth: true,
  });
  const [focusedField, setFocusedField] = React.useState<"name" | "email" | "password" | null>(null);
  const [secureTextEntry, setSecureTextEntry] = React.useState(true);
  const [historyCount, setHistoryCount] = React.useState(0);
  const [bookmarkCount, setBookmarkCount] = React.useState(0);
  const [latestProgress, setLatestProgress] = React.useState<any | null>(null);

  // ── Load ─────────────────────────────────────────────────────────────────
  const load = React.useCallback(async () => {
    setLoading(true);
    const [p, s] = await Promise.all([getProfile(), getReaderSettings()]);
    setProfile(p);
    setSettings(s);
    if (p) {
      try {
        const [hist, bkmk] = await Promise.all([getAllHistory(5), getBookmarks()]);
        setHistoryCount(hist.length);
        setBookmarkCount(bkmk.length);
        setLatestProgress(hist[0] || null);
      } catch (e) {
        console.error("Failed to load activity summary", e);
      }
    }
    setLoading(false);
  }, [setHistoryCount, setBookmarkCount, setLatestProgress]);

  React.useEffect(() => { void load(); }, [load]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const showMessage = (text: string, isError = false) =>
    setMessage({ text, isError });

  const clearForm = () => {
    setName(""); setEmail(""); setPassword("");
  };

  const updateSetting = React.useCallback(
    async (partial: Partial<ReaderSettings>) => {
      const next = await setReaderSettings(partial);
      setSettings(next);
    },
    []
  );

  // ── Auth Handlers ─────────────────────────────────────────────────────────
  const handleAuth = React.useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      showMessage("Email dan password wajib diisi.", true);
      return;
    }
    if (authMode === "register" && !name.trim()) {
      showMessage("Nama wajib diisi untuk daftar.", true);
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const p =
        authMode === "register"
          ? await register({ name: name.trim(), email: email.trim(), password })
          : await signIn({ email: email.trim(), password });

      setProfile(p);
      clearForm();
      showMessage(
        authMode === "register" ? "Akun berhasil dibuat!" : "Berhasil masuk!",
        false
      );
      // Load settings dari server setelah login
      const s = await getReaderSettings();
      setSettings(s);
      // Load history & bookmarks
      try {
        const [hist, bkmk] = await Promise.all([getAllHistory(5), getBookmarks()]);
        setHistoryCount(hist.length);
        setBookmarkCount(bkmk.length);
        setLatestProgress(hist[0] || null);
      } catch (e) {
        console.error("Failed to load activity summary after login", e);
      }
    } catch (e) {
      const msg =
        e instanceof KomikamApiError
          ? e.message
          : e instanceof Error
          ? e.message
          : "Terjadi kesalahan.";
      showMessage(msg, true);
    } finally {
      setSubmitting(false);
    }
  }, [authMode, name, email, password, setHistoryCount, setBookmarkCount, setLatestProgress]);

  const handleSignOut = React.useCallback(() => {
    const performSignOut = async () => {
      setSubmitting(true);
      try {
        await signOut();
        setProfile(null);
        showMessage("Berhasil keluar.", false);
      } finally {
        setSubmitting(false);
      }
    };

    if (Platform.OS === "web") {
      const confirmOut = window.confirm("Kamu akan logout dari akun ini. Lanjutkan?");
      if (confirmOut) {
        void performSignOut();
      }
    } else {
      Alert.alert("Keluar akun?", "Kamu akan logout dari akun ini.", [
        { text: "Batal", style: "cancel" },
        {
          text: "Keluar",
          style: "destructive",
          onPress: performSignOut,
        },
      ]);
    }
  }, []);

  const handleRefresh = React.useCallback(async () => {
    setSubmitting(true);
    const p = await refreshProfile();
    if (p) {
      setProfile(p);
      try {
        const [hist, bkmk] = await Promise.all([getAllHistory(5), getBookmarks()]);
        setHistoryCount(hist.length);
        setBookmarkCount(bkmk.length);
        setLatestProgress(hist[0] || null);
      } catch (e) {
        console.error("Failed to load activity summary on refresh", e);
      }
      showMessage("Profil diperbarui.", false);
    } else {
      showMessage("Gagal memuat profil dari server.", true);
    }
    setSubmitting(false);
  }, [setHistoryCount, setBookmarkCount, setLatestProgress]);



  // ── Loading State ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.subtext} />
        <Text style={{ marginTop: 8, color: colors.subtext }}>Memuat...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        padding: 16,
        paddingTop: insets.top + 12,
        gap: 10,
        paddingBottom: insets.bottom + 40,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 20 }}>Akun</Text>

      {/* Message Banner */}
      {message ? (
        <View
          style={{
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: message.isError ? colors.danger : colors.border,
            backgroundColor: message.isError
              ? isDark ? "#2A0F0F" : "#FDECEA"
              : colors.card,
          }}
        >
          <Text style={{ color: message.isError ? colors.danger : colors.subtext }}>
            {message.text}
          </Text>
        </View>
      ) : null}

      {/* ── Belum Login ─────────────────────────────────────────────────── */}
      {!profile ? (
        <View
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 16,
            gap: 10,
          }}
        >
          {/* Mode Toggle */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["login", "register"] as AuthMode[]).map((mode) => (
              <Pressable
                key={mode}
                onPress={() => { setAuthMode(mode); setMessage(null); }}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 8,
                  alignItems: "center",
                  borderRadius: 10,
                  backgroundColor: authMode === mode ? colors.accent : "transparent",
                  borderWidth: 1,
                  borderColor: authMode === mode ? colors.accent : colors.border,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ color: authMode === mode ? "#FFF" : colors.subtext, fontWeight: "700" }}>
                  {mode === "login" ? "Masuk" : "Daftar"}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Name (Register only) */}
          {authMode === "register" && (
            <View style={{ gap: 4 }}>
              <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "600" }}>Nama</Text>
              <View style={inputContainerStyle(colors, focusedField === "name")}>
                <Ionicons name="person-outline" size={16} color={colors.subtext} />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Nama kamu"
                  placeholderTextColor={colors.placeholder}
                  onFocus={() => setFocusedField("name")}
                  onBlur={() => setFocusedField(null)}
                  style={{
                    flex: 1,
                    color: colors.text,
                    fontSize: 14,
                    paddingLeft: 8,
                    paddingVertical: 0,
                    ...Platform.select({
                      web: { outlineStyle: "none" as any },
                      default: {},
                    }),
                  }}
                />
              </View>
            </View>
          )}

          {/* Email */}
          <View style={{ gap: 4 }}>
            <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "600" }}>Email</Text>
            <View style={inputContainerStyle(colors, focusedField === "email")}>
              <Ionicons name="mail-outline" size={16} color={colors.subtext} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="email@contoh.com"
                placeholderTextColor={colors.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
                style={{
                  flex: 1,
                  color: colors.text,
                  fontSize: 14,
                  paddingLeft: 8,
                  paddingVertical: 0,
                  ...Platform.select({
                    web: { outlineStyle: "none" as any },
                    default: {},
                  }),
                }}
              />
            </View>
          </View>

          {/* Password */}
          <View style={{ gap: 4 }}>
            <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "600" }}>Password</Text>
            <View style={inputContainerStyle(colors, focusedField === "password")}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.subtext} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••"
                placeholderTextColor={colors.placeholder}
                secureTextEntry={secureTextEntry}
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
                style={{
                  flex: 1,
                  color: colors.text,
                  fontSize: 14,
                  paddingHorizontal: 8,
                  paddingVertical: 0,
                  ...Platform.select({
                    web: { outlineStyle: "none" as any },
                    default: {},
                  }),
                }}
              />
              <Pressable onPress={() => setSecureTextEntry(!secureTextEntry)} style={{ padding: 4 }}>
                <Ionicons
                  name={secureTextEntry ? "eye-off-outline" : "eye-outline"}
                  size={16}
                  color={colors.subtext}
                />
              </Pressable>
            </View>
          </View>

          {/* Submit */}
          <Pressable
            onPress={handleAuth}
            disabled={submitting}
            style={({ pressed }) => ({
              backgroundColor: colors.primary,
              paddingVertical: 11,
              borderRadius: 12,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
              opacity: submitting || pressed ? 0.8 : 1,
            })}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.primaryText} />
            ) : (
              <Text style={{ color: colors.primaryText, fontWeight: "900", fontSize: 14 }}>
                {authMode === "login" ? "Masuk" : "Buat Akun"}
              </Text>
            )}
          </Pressable>
        </View>
      ) : (
        /* ── Sudah Login ──────────────────────────────────────────────────── */
        <View style={{ gap: 8 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 12,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              gap: 12,
            }}
          >
            {/* Initial Avatar */}
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#FFF", fontWeight: "900", fontSize: 18 }}>
                {profile.name ? profile.name.charAt(0).toUpperCase() : "?"}
              </Text>
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>
                {profile.name}
              </Text>
              <Text style={{ color: colors.subtext, fontSize: 13 }}>{profile.email}</Text>
              <Text style={{ color: colors.subtext, fontSize: 11 }}>
                Bergabung: {formatTime(profile.created_at)}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={handleRefresh}
              disabled={submitting}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: colors.ghost,
                paddingVertical: 10,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 6,
                opacity: submitting || pressed ? 0.7 : 1,
              })}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.ghostText} />
              ) : (
                <>
                  <Ionicons name="refresh-outline" size={16} color={colors.ghostText} />
                  <Text style={{ color: colors.ghostText, fontWeight: "700", fontSize: 13 }}>
                    Perbarui
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={handleSignOut}
              disabled={submitting}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: colors.ghost,
                paddingVertical: 10,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 6,
                opacity: submitting || pressed ? 0.7 : 1,
              })}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <>
                  <Ionicons name="log-out-outline" size={16} color={colors.danger} />
                  <Text style={{ color: colors.danger, fontWeight: "900", fontSize: 13 }}>
                    Keluar
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {profile && (
        <>
          {/* Divider */}
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 2 }} />

          {/* ── Dashboard Ringkasan Aktivitas ────────────────────────────────────── */}
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="grid-outline" size={16} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
                Ringkasan Aktivitas
              </Text>
            </View>

            {/* Stats Row */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 14,
                  padding: 10,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                }}
              >
                <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: "600" }}>
                  Markah
                </Text>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>
                  {bookmarkCount}
                </Text>
              </View>

              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 14,
                  padding: 10,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                }}
              >
                <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: "600" }}>
                  Riwayat Baca
                </Text>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>
                  {historyCount}
                </Text>
              </View>
            </View>

            {/* Latest Progress Manga */}
            {latestProgress && (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/manga/[mangaId]",
                    params: {
                      mangaId: latestProgress.mangaId,
                      title: latestProgress.mangaTitle || "",
                      coverUrl: latestProgress.coverUrl || "",
                    },
                  })
                }
                style={({ pressed }) => ({
                  flexDirection: "row",
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 14,
                  padding: 10,
                  alignItems: "center",
                  gap: 10,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.subtext, fontSize: 10, fontWeight: "600" }}>
                    Lanjutkan Membaca
                  </Text>
                  <Text
                    style={{ color: colors.text, fontSize: 14, fontWeight: "900" }}
                    numberOfLines={1}
                  >
                    {latestProgress.mangaTitle || "Manga"}
                  </Text>
                  <Text style={{ color: colors.subtext, fontSize: 11 }}>
                    Chapter {latestProgress.chapterNumber}
                  </Text>
                </View>

                {/* Continue button icon */}
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: colors.chip,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="play" size={14} color={colors.accent} style={{ marginLeft: 2 }} />
                </View>
              </Pressable>
            )}
          </View>



          {/* Divider */}
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 2 }} />

          {/* ── Pengaturan Tema Aplikasi ────────────────────────────────────────── */}
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="color-palette-outline" size={16} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
                Tema Aplikasi
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[
                { val: "system", label: "Otomatis", icon: "contrast-outline" },
                { val: "light", label: "Terang", icon: "sunny-outline" },
                { val: "dark", label: "Gelap", icon: "moon-outline" },
              ].map((t) => (
                <Pressable
                  key={t.val}
                  onPress={() => setMode(t.val as any)}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: 10,
                    alignItems: "center",
                    borderRadius: 12,
                    backgroundColor: mode === t.val ? colors.text : colors.card,
                    borderWidth: 1,
                    borderColor: mode === t.val ? colors.text : colors.border,
                    gap: 4,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Ionicons
                    name={t.icon as any}
                    size={18}
                    color={mode === t.val ? colors.bg : colors.subtext}
                  />
                  <Text
                    style={{
                      color: mode === t.val ? colors.bg : colors.subtext,
                      fontWeight: mode === t.val ? "900" : "600",
                      fontSize: 11,
                    }}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 2 }} />

          {/* ── Pengaturan Baca ───────────────────────────────────────────────── */}
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="book-outline" size={16} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
                Pengaturan Baca
              </Text>
            </View>

            {/* Image Quality */}
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 12 }}>
                Kualitas Gambar
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["high", "low"] as const).map((q) => (
                  <Pressable
                    key={q}
                    onPress={() => updateSetting({ imageQuality: q })}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: 8,
                      alignItems: "center",
                      borderRadius: 10,
                      backgroundColor: settings.imageQuality === q ? colors.text : colors.card,
                      borderWidth: 1,
                      borderColor: settings.imageQuality === q ? colors.text : colors.border,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Text
                      style={{
                        color: settings.imageQuality === q ? colors.bg : colors.subtext,
                        fontWeight: settings.imageQuality === q ? "900" : "600",
                        fontSize: 12,
                      }}
                    >
                      {q === "high" ? "Tinggi (HQ)" : "Hemat Data"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Reader Background */}
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 12 }}>
                Warna Latar Baca
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[
                  { val: "black", label: "Hitam", color: "#000" },
                  { val: "dark",  label: "Gelap", color: "#121218" },
                  { val: "white", label: "Putih", color: "#FFF", txtColor: "#000" },
                ].map((bg) => (
                  <Pressable
                    key={bg.val}
                    onPress={() => updateSetting({ readerBg: bg.val as ReaderSettings["readerBg"] })}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: 8,
                      alignItems: "center",
                      borderRadius: 10,
                      backgroundColor: bg.color,
                      borderWidth: 2,
                      borderColor:
                        settings.readerBg === bg.val
                          ? isDark ? "#4A90E2" : "#005bb5"
                          : "transparent",
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Text
                      style={{
                        color: bg.txtColor || "#FFF",
                        fontWeight: settings.readerBg === bg.val ? "900" : "600",
                        fontSize: 12,
                      }}
                    >
                      {bg.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </>
      )}

      {/* ── Tentang Aplikasi ───────────────────────────────────────────────── */}
      <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
      <View style={{ gap: 4, alignItems: "center", paddingVertical: 8 }}>
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14 }}>
          KomiKam
        </Text>
        <Text style={{ color: colors.subtext, fontSize: 11 }}>
          Versi 1.0.0 (Build 2026.04)
        </Text>
      </View>
    </ScrollView>
  );
}

function inputContainerStyle(colors: Record<string, string>, isFocused: boolean) {
  return {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: isFocused ? colors.accent : colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
  };
}