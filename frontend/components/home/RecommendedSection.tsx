import type { ShngmManga } from "@/src/api/shngmTypes";
import { useRouter } from "expo-router";
import React from "react";
import { FlatList, Image, Pressable, View } from "react-native";
import { Text } from "@/components/ui/app-text";

type Props = {
  items: ShngmManga[];
  isDark: boolean;
  title: string;
};

export default function RecommendedSection({ items, isDark, title }: Props) {
  const router = useRouter();
  const toMangaParams = React.useCallback((item: ShngmManga) => ({
    mangaId: item.manga_id,
    title: item.title,
    description: item.description,
    coverUrl: item.cover_portrait_url || item.cover_image_url || "",
    countryId: item.country_id,
    userRate: String(item.user_rate ?? ""),
  }), []);

  if (items.length === 0) return null;

  return (
    <View style={{ paddingVertical: 12 }}>
      <Text
        style={{
          fontSize: 18,
          fontWeight: "900",
          marginLeft: 12,
          marginBottom: 8,
          color: isDark ? "#F2F2F7" : "#1E2329",
        }}
      >
        {title}
      </Text>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={items}
        keyExtractor={(i) => i.manga_id}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 12 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/manga/[mangaId]",
                params: toMangaParams(item),
              })
            }
          >
            <Image
              source={{ uri: item.cover_portrait_url || item.cover_image_url }}
              style={{
                width: 96,
                height: 128,
                borderRadius: 14,
                backgroundColor: "#000",
              }}
            />
            <Text
              numberOfLines={2}
              style={{
                width: 96,
                marginTop: 4,
                fontSize: 12,
                fontWeight: "700",
                color: isDark ? "#F2F2F7" : "#1E2329",
              }}
            >
              {item.title}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
