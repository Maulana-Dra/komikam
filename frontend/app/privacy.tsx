import React from "react";
import {
  ScrollView,
  Pressable,
  View,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Text } from "@/components/ui/app-text";
import { useAppTheme } from "@/src/theme/ThemeContext";

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolved } = useAppTheme();
  const isDark = resolved === "dark";
  const { width } = useWindowDimensions();

  const isWide = width >= 768;

  const colors = React.useMemo(
    () => ({
      bg: isDark ? "#0B0B0E" : "#F6F1E9",
      card: isDark ? "#121218" : "#FBF6EE",
      text: isDark ? "#F2F2F7" : "#1E2329",
      subtext: isDark ? "#B3B3C2" : "#6A625A",
      border: isDark ? "#242434" : "#E6DED2",
      accent: isDark ? "#4A8FE2" : "#005bb5",
    }),
    [isDark]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* ── Custom Header ── */}
      <View
        style={{
          paddingTop: Platform.OS === "android" ? Math.max(insets.top, 24) + 8 : insets.top + 6,
          paddingBottom: 12,
          paddingHorizontal: isWide ? 24 : 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.card,
        }}
      >
        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/");
            }
          }}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            opacity: pressed ? 0.6 : 1,
            paddingVertical: 6,
            paddingHorizontal: 8,
            borderRadius: 8,
          })}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>
            Kembali
          </Text>
        </Pressable>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            fontWeight: "900",
            fontSize: 16,
            color: colors.text,
            marginRight: 60, // Balance the back button spacing
          }}
        >
          Kebijakan Privasi
        </Text>
      </View>

      {/* ── Content ── */}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: isWide ? 32 : 16,
          paddingVertical: 24,
          maxWidth: 800,
          alignSelf: "center",
          width: "100%",
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            fontSize: 24,
            fontWeight: "900",
            color: colors.text,
            marginBottom: 8,
          }}
        >
          Kebijakan Privasi KomiKam
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: colors.subtext,
            marginBottom: 24,
          }}
        >
          Terakhir Diperbarui: 30 Juni 2026
        </Text>

        <Text style={{ color: colors.text, fontSize: 14, lineHeight: 22, marginBottom: 16 }}>
          Selamat datang di KomiKam. Kami sangat menghargai privasi Anda dan berkomitmen untuk melindungi informasi pribadi Anda. Kebijakan Privasi ini menjelaskan bagaimana kami mengumpulkan, menggunakan, dan melindungi informasi Anda saat Anda menggunakan aplikasi dan situs web kami.
        </Text>

        {/* Seksi 1 */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 8 }}>
            1. Informasi yang Kami Kumpulkan
          </Text>
          <Text style={{ color: colors.subtext, fontSize: 13, lineHeight: 20, marginBottom: 8 }}>
            Kami mengumpulkan informasi minimal untuk menyediakan fungsionalitas aplikasi yang optimal:
          </Text>
          <Text style={{ color: colors.subtext, fontSize: 13, lineHeight: 20, marginLeft: 12, marginBottom: 4 }}>
            • <Text style={{ fontWeight: "700", color: colors.text }}>Informasi Akun:</Text> Nama pengguna, alamat email, dan kata sandi yang dienkripsi saat Anda mendaftar akun KomiKam.
          </Text>
          <Text style={{ color: colors.subtext, fontSize: 13, lineHeight: 20, marginLeft: 12, marginBottom: 4 }}>
            • <Text style={{ fontWeight: "700", color: colors.text }}>Aktivitas Membaca:</Text> Riwayat membaca (History), daftar Bookmark, dan daftar komentar Anda. Data ini disinkronisasikan ke server jika Anda masuk (login) agar dapat diakses di berbagai perangkat Anda.
          </Text>
          <Text style={{ color: colors.subtext, fontSize: 13, lineHeight: 20, marginLeft: 12 }}>
            • <Text style={{ fontWeight: "700", color: colors.text }}>Data Unduhan:</Text> Komik yang Anda download disimpan secara lokal pada penyimpanan perangkat Anda dan tidak dikirimkan ke server kami.
          </Text>
        </View>

        {/* Seksi 2 */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 8 }}>
            2. Penggunaan Informasi
          </Text>
          <Text style={{ color: colors.subtext, fontSize: 13, lineHeight: 20, marginBottom: 8 }}>
            Informasi yang kami kumpulkan digunakan hanya untuk keperluan berikut:
          </Text>
          <Text style={{ color: colors.subtext, fontSize: 13, lineHeight: 20, marginLeft: 12, marginBottom: 4 }}>
            • Menyediakan, mengoperasikan, dan memelihara fitur-fitur aplikasi (Bookmark, History, Download).
          </Text>
          <Text style={{ color: colors.subtext, fontSize: 13, lineHeight: 20, marginLeft: 12, marginBottom: 4 }}>
            • Menampilkan nama pengguna Anda secara aman saat Anda mengirimkan komentar di ulasan komik.
          </Text>
          <Text style={{ color: colors.subtext, fontSize: 13, lineHeight: 20, marginLeft: 12 }}>
            • Meningkatkan kinerja dan pengalaman pengguna aplikasi KomiKam.
          </Text>
        </View>

        {/* Seksi 3 */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 8 }}>
            3. Keamanan Data
          </Text>
          <Text style={{ color: colors.subtext, fontSize: 13, lineHeight: 20 }}>
            Kami menggunakan protokol transfer data yang aman (HTTPS dengan enkripsi SSL) untuk semua komunikasi data antara aplikasi Anda dan server backend kami. Penyimpanan token autentikasi di perangkat mobile Anda dilindungi menggunakan penyimpanan aman tingkat sistem perangkat keras (SecureStore). Kami tidak akan membagikan, menjual, atau menyewakan informasi pribadi Anda kepada pihak ketiga mana pun.
          </Text>
        </View>

        {/* Seksi 4 */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 8 }}>
            4. Hak Pengguna atas Data
          </Text>
          <Text style={{ color: colors.subtext, fontSize: 13, lineHeight: 20, marginBottom: 8 }}>
            Anda memiliki kontrol penuh atas data Anda sendiri di platform kami:
          </Text>
          <Text style={{ color: colors.subtext, fontSize: 13, lineHeight: 20, marginLeft: 12, marginBottom: 4 }}>
            • Anda dapat menghapus data riwayat membaca (History) Anda kapan saja.
          </Text>
          <Text style={{ color: colors.subtext, fontSize: 13, lineHeight: 20, marginLeft: 12, marginBottom: 4 }}>
            • Anda dapat menghapus komentar atau balasan ulasan yang Anda buat secara mandiri melalui tombol hapus kustom di samping komentar Anda.
          </Text>
          <Text style={{ color: colors.subtext, fontSize: 13, lineHeight: 20, marginLeft: 12 }}>
            • Anda dapat membaca dan menjelajahi katalog komik tanpa melakukan pendaftaran akun (login). Pendaftaran hanya diperlukan jika Anda berniat memanfaatkan fitur Bookmark, History, dan Download secara cloud.
          </Text>
        </View>

        {/* Seksi 5 */}
        <View style={{ marginBottom: 30 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 8 }}>
            5. Kontak Kami
          </Text>
          <Text style={{ color: colors.subtext, fontSize: 13, lineHeight: 20 }}>
            Jika Anda memiliki pertanyaan tentang Kebijakan Privasi ini atau pengelolaan data di platform kami, silakan hubungi tim pengembang KomiKam melalui email resmi kami.
          </Text>
        </View>

        <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 20 }} />

        <Text style={{ textAlign: "center", color: colors.subtext, fontSize: 11 }}>
          © 2026 KomiKam. All Rights Reserved.
        </Text>
      </ScrollView>
    </View>
  );
}
