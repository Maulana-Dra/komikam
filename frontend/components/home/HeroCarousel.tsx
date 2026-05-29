import React, { useRef, useState } from "react";
import {
  View,
  FlatList,
  Image,
  Pressable,
  useWindowDimensions,
  StyleSheet,
  ViewToken,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "@/components/ui/app-text";
import type { ShngmManga } from "@/src/api/shngmTypes";

type HeroCarouselProps = {
  items: ShngmManga[];
  colors: {
    bg: string;
    card: string;
    text: string;
    subtext: string;
    border: string;
    chip: string;
    activePillBg: string;
    activePillText: string;
    placeholder: string;
  };
  onPressItem: (item: ShngmManga) => void;
};

export default function HeroCarousel({ items, colors, onPressItem }: HeroCarouselProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const contentPadding = isDesktop ? 24 : 12;
  const containerWidth = Math.min(1600, width) - 2 * contentPadding;
  const [activeIndex, setActiveIndex] = useState(0);

  const ITEM_WIDTH = isDesktop ? Math.min(800, containerWidth) : containerWidth - 40;
  const ITEM_HEIGHT = isDesktop ? 390 : 440;
  const SPACING = 20;
 
  const flatListRef = useRef<FlatList>(null); 

  // Auto-slide logic 
  React.useEffect(() => {
    if (!items || items.length === 0) return;
    const interval = setInterval(() => {
      let nextIndex = activeIndex + 1;
      if (nextIndex >= items.length) {
        nextIndex = 0;
      }
      flatListRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true,
      });
    }, 4000); // Ganti slide setiap 4 detik

    return () => clearInterval(interval);
  }, [activeIndex, items]);

  const handleViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        setActiveIndex(viewableItems[0].index || 0);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  if (!items || items.length === 0) return null;

  return (
    <View style={{ marginBottom: 24 }}>
      <FlatList
        ref={flatListRef}
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(it) => it.manga_id}
        snapToInterval={ITEM_WIDTH + SPACING}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum={true}
        contentContainerStyle={{ paddingHorizontal: 0 }}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: ITEM_WIDTH + SPACING,
          offset: (ITEM_WIDTH + SPACING) * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          const wait = new Promise(resolve => setTimeout(resolve, 100));
          wait.then(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
          });
        }}
        renderItem={({ item }) => {
          const format = item.taxonomy?.Format?.[0]?.name || item.taxonomy?.Type?.[0]?.name;
          const coverUrl = item.cover_image_url || item.cover_portrait_url;

          return (
            <Pressable
              onPress={() => onPressItem(item)}
              style={({ pressed }) => ({
                width: ITEM_WIDTH,
                height: ITEM_HEIGHT,
                marginRight: SPACING, // Ganti gap dengan marginRight
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <View
                style={{
                  flex: 1,
                  borderRadius: 24,
                  overflow: "hidden",
                  backgroundColor: colors.chip,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                {/* Background Image */}
                <Image
                  source={{ uri: coverUrl }}
                  style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
                  resizeMode="cover"
                />

                {/* Gradient Overlay — lebih gelap di kiri untuk keterbacaan teks */}
                <LinearGradient
                  colors={["rgba(0,0,0,0.90)", "rgba(0,0,0,0.5)", "rgba(0,0,0,0.05)"]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />

                {/* Content Overlay */}
                <View style={{ flex: 1, padding: 22, justifyContent: "flex-end" }}>
                  {/* Badges */}
                  <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
                    {item.user_rate ? (
                      <View
                        style={{
                          backgroundColor: "#EAB308",
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 999,
                        }}
                      >
                        <Text style={{ color: "#111", fontSize: 12, fontWeight: "900" }}>
                          ★ {item.user_rate}
                        </Text>
                      </View>
                    ) : null}
                    {format ? (
                      <View
                        style={{
                          backgroundColor: "#EF4444",
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 999,
                        }}
                      >
                        <Text
                          style={{
                            color: "#FFF",
                            fontSize: 12,
                            fontWeight: "900",
                            textTransform: "capitalize",
                          }}
                        >
                          {format}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Title — lebih besar */}
                  <Text
                    numberOfLines={2}
                    style={{
                      color: "#FFFFFF",
                      fontSize: 26,
                      fontWeight: "900",
                      marginBottom: 6,
                      lineHeight: 32,
                    }}
                  >
                    {item.title}
                  </Text>

                  {/* Description */}
                  <Text
                    numberOfLines={2}
                    style={{
                      color: "rgba(255,255,255,0.72)",
                      fontSize: 13,
                      lineHeight: 18,
                      marginBottom: 16,
                    }}
                  >
                    {item.description || "No description available."}
                  </Text>

                  {/* CTA Button — lebih besar & solid */}
                  <View
                    style={{
                      alignSelf: "flex-start",
                      backgroundColor: "rgba(255,255,255,0.18)",
                      borderColor: "rgba(255,255,255,0.55)",
                      borderWidth: 1.5,
                      paddingHorizontal: 20,
                      paddingVertical: 9,
                      borderRadius: 999,
                    }}
                  >
                    <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>
                      Start Reading →
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      {/* Pagination Dots */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: 6,
          marginTop: 14,
        }}
      >
        {items.map((_, index) => {
          const isActive = index === activeIndex;
          return (
            <Animated.View
              key={index}
              style={{
                height: 6,
                width: isActive ? 20 : 6,
                borderRadius: 3,
                backgroundColor: isActive ? colors.text : colors.placeholder,
                opacity: isActive ? 1 : 0.4,
              }}
            />
          );
        })}
      </View>
    </View>
  );
}