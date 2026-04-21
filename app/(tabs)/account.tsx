import React from "react";
import { ActivityIndicator, Alert, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/app-text";
import { useAppTheme } from "@/src/theme/ThemeContext";
import {
  getProfile,
  signIn,
  signOut,
  syncDownload,
  syncUpload,
  type AccountProfile,
} from "@/src/store/account";

function formatTime(ts?: number): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("id-ID");
}

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
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
      ghost: isDark ? "#1A1A24" : "#F2E9DD",
      ghostText: isDark ? "#F2F2F7" : "#1E2329",
      primary: isDark ? "#F2F2F7" : "#1E2A3A",
      primaryText: isDark ? "#111111" : "#F7F2EA",
      danger: isDark ? "#FF5C5C" : "#D32F2F",
      inputBg: isDark ? "#121218" : "#FBF6EE",
      placeholder: isDark ? "#7E7E91" : "#9A8F83",
    }),
    [isDark]
  );

  const [profile, setProfile] = React.useState<AccountProfile | null>(null);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState<boolean>(true);
  const [syncing, setSyncing] = React.useState<boolean>(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const p = await getProfile();
    setProfile(p);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleSignIn = React.useCallback(async () => {
    if (!name.trim()) {
      setMessage("Nama wajib diisi.");
      return;
    }
    const p = await signIn({ name, email });
    setProfile(p);
    setName("");
    setEmail("");
    setMessage("Akun lokal dibuat.");
  }, [name, email]);

  const handleSignOut = React.useCallback(() => {
    Alert.alert("Keluar akun?", "Profil lokal akan dihapus.", [
      { text: "Batal", style: "cancel" },
      {
        text: "Keluar",
        style: "destructive",
        onPress: async () => {
          await signOut();
          setProfile(null);
          setMessage("Akun keluar.");
        },
      },
    ]);
  }, []);

  const handleSyncUpload = React.useCallback(async () => {
    try {
      setSyncing(true);
      setMessage(null);
      await syncUpload();
      const p = await getProfile();
      setProfile(p);
      setMessage("Sinkronisasi ke cloud berhasil.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal sinkronisasi";
      setMessage(msg);
    } finally {
      setSyncing(false);
    }
  }, []);

  const handleSyncDownload = React.useCallback(async () => {
    try {
      setSyncing(true);
      setMessage(null);
      await syncDownload();
      const p = await getProfile();
      setProfile(p);
      setMessage("Data berhasil dipulihkan dari cloud.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal pulihkan data";
      setMessage(msg);
    } finally {
      setSyncing(false);
    }
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.subtext} />
        <Text style={{ marginTop: 8, color: colors.subtext }}>Memuat...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16, paddingTop: insets.top + 12, gap: 12 }}>
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 20 }}>Akun</Text>

      {message ? (
        <View
          style={{
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
          }}
        >
          <Text style={{ color: colors.subtext }}>{message}</Text>
        </View>
      ) : null}

      {!profile ? (
        <View style={{ gap: 10 }}>
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.subtext }}>Nama</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Nama kamu"
              placeholderTextColor={colors.placeholder}
              style={{
                backgroundColor: colors.inputBg,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: colors.text,
              }}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.subtext }}>Email (opsional)</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="email@contoh.com"
              placeholderTextColor={colors.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
              style={{
                backgroundColor: colors.inputBg,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: colors.text,
              }}
            />
          </View>

          <Pressable
            onPress={handleSignIn}
            style={{
              backgroundColor: colors.primary,
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "900" }}>Buat akun lokal</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <View
            style={{
              padding: 12,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              gap: 6,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "900" }}>{profile.name}</Text>
            <Text style={{ color: colors.subtext }}>{profile.email || "Tanpa email"}</Text>
            <Text style={{ color: colors.subtext }}>Dibuat: {formatTime(profile.createdAt)}</Text>
            <Text style={{ color: colors.subtext }}>Sync terakhir: {formatTime(profile.lastSyncAt)}</Text>
          </View>

          <Pressable
            onPress={handleSyncUpload}
            disabled={syncing}
            style={{
              backgroundColor: colors.primary,
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: "center",
              opacity: syncing ? 0.7 : 1,
            }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "900" }}>
              {syncing ? "Sinkronisasi..." : "Sync ke cloud"}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSyncDownload}
            disabled={syncing}
            style={{
              backgroundColor: colors.ghost,
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: "center",
              opacity: syncing ? 0.7 : 1,
            }}
          >
            <Text style={{ color: colors.ghostText, fontWeight: "900" }}>Pulihkan dari cloud</Text>
          </Pressable>

          <Pressable
            onPress={handleSignOut}
            style={{
              backgroundColor: colors.ghost,
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.danger, fontWeight: "900" }}>Keluar akun</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
