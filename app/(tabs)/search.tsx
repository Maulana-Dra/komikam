import React, { useState, useMemo, useEffect } from 'react';
import { View, TextInput, Pressable, FlatList, useWindowDimensions, ScrollView, Platform, Linking, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '@/components/ui/app-text';
import { useAppTheme } from '@/src/theme/ThemeContext';
import { useRouter } from 'expo-router';
import { getMangaListByType } from '@/src/api/shngmClient';
import type { ShngmManga } from '@/src/api/shngmTypes';

// --- Mock Data ---
const MOCK_GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mecha", "Mystery", "Psychological", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"];

function getFlagEmoji(countryId: string) {
  if (!countryId) return '';
  const map: Record<string, string> = { 'kr': '🇰🇷', 'jp': '🇯🇵', 'cn': '🇨🇳', 'id': '🇮🇩', 'gb': '🇬🇧', 'us': '🇺🇸' };
  return map[countryId.toLowerCase()] || countryId.toUpperCase();
}

function formatViews(views: number) {
  if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
  if (views >= 1000) return (views / 1000).toFixed(1) + 'K';
  return String(views);
}

function parseRelativeTime(timeStr: string) {
  if (!timeStr) return '';
  // simple extraction e.g. "10 hours ago" -> "10h", "1 day ago" -> "1d"
  if (timeStr.includes('hour')) return timeStr.split(' ')[0] + 'h';
  if (timeStr.includes('day')) return timeStr.split(' ')[0] + 'd';
  if (timeStr.includes('min')) return timeStr.split(' ')[0] + 'm';
  return timeStr;
}

const CollapsibleSection = ({ title, children, colors }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <View style={{ marginBottom: 12 }}>
      <Pressable 
        onPress={() => setIsOpen(!isOpen)} 
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}
      >
        <Text style={{ color: colors.text, fontWeight: '700' }}>{title}</Text>
        <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.subtext} />
      </Pressable>
      {isOpen && <View style={{ paddingTop: 8 }}>{children}</View>}
    </View>
  );
};

const MangaCard = ({ item, colors }: { item: ShngmManga; colors: any }) => {
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();

  return (
    <Pressable
      // @ts-ignore
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      onPress={() => router.push({
        pathname: "/manga/[mangaId]",
        params: { mangaId: item.manga_id, title: item.title, coverUrl: item.cover_portrait_url || item.cover_image_url }
      })}
      style={[
        { flex: 1, backgroundColor: colors.card, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
        Platform.OS === 'web' && isHovered && {
          transform: [{ scale: 1.03 }],
          boxShadow: `0px 8px 24px ${colors.border}`,
          zIndex: 10
        }
      ]}
    >
      <View style={{ aspectRatio: 2 / 3, width: '100%', position: 'relative' }}>
        <ExpoImage source={{ uri: item.cover_portrait_url || item.cover_image_url }} style={{ width: '100%', height: '100%', backgroundColor: colors.border }} contentFit="cover" />
        
        {/* Top Left Badge */}
        {item.latest_chapter_time ? (
          <View style={{ position: 'absolute', top: 6, left: 6, backgroundColor: colors.danger, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
            <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '900' }}>
              {item.is_recommended ? 'UP ' : ''}{parseRelativeTime(item.latest_chapter_time)}
            </Text>
          </View>
        ) : null}

        {/* Top Right Flag */}
        {item.country_id ? (
          <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 }}>
            <Text style={{ fontSize: 10 }}>{getFlagEmoji(item.country_id)}</Text>
          </View>
        ) : null}
      </View>
      
      <View style={{ padding: 8, gap: 4 }}>
        <Text style={{ color: colors.text, fontWeight: '900', fontSize: 13 }} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={{ color: colors.subtext, fontSize: 11 }} numberOfLines={1}>
          {item.alternative_title || item.title}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: '700' }}>Ch {item.latest_chapter_number}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Ionicons name="eye" size={12} color={colors.subtext} />
            <Text style={{ color: colors.subtext, fontSize: 11 }}>{formatViews(item.view_count)}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
};

export default function SearchScreen() {
  const { resolved } = useAppTheme();
  const isDark = resolved === 'dark';
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  
  const isDesktop = width >= 768;
  const columns = isDesktop ? (width >= 1024 ? 6 : 4) : 2;

  const colors = useMemo(() => ({
    bg: isDark ? '#0B0B0E' : '#F6F1E9',
    card: isDark ? '#121218' : '#FBF6EE',
    sidebar: isDark ? '#101015' : '#F2EADF',
    text: isDark ? '#F2F2F7' : '#1E2329',
    subtext: isDark ? '#B3B3C2' : '#6A625A',
    border: isDark ? '#242434' : '#E6DED2',
    chip: isDark ? '#1A1A24' : '#EFE6DA',
    chipActive: isDark ? '#F2F2F7' : '#1E2329',
    chipTextActive: isDark ? '#0B0B0E' : '#F6F1E9',
    danger: isDark ? '#FF5C5C' : '#D32F2F',
    primary: isDark ? '#4A90E2' : '#005bb5',
  }), [isDark]);

  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [isGridView, setIsGridView] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<ShngmManga[]>([]);
  const [loading, setLoading] = useState(false);
  const [ads, setAds] = useState<any[]>([]);

  // // Fetch Ads
  // useEffect(() => {
  //   fetch('https://ads.shinigami.io/v1/pages/search')
  //     .then(res => res.json())
  //     .then(data => {
  //       if (data?.data?.[0]?.sections) {
  //         const allAds: any[] = [];
  //         for (const section of data.data[0].sections) {
  //           if (section.ads) {
  //             for (const ad of section.ads) {
  //               if (ad.type === 'banner' && ad.image) {
  //                 allAds.push(ad);
  //               }
  //             }
  //           }
  //         }
  //         setAds(allAds);
  //       }
  //     })
  //     .catch(err => console.log('Failed to fetch ads:', err));
  // }, []);

  // Fetch Manga
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      getMangaListByType({ page: 1, pageSize: 24, query: searchQuery || undefined })
        .then(res => setItems(res.data))
        .catch(err => console.log('Failed to fetch manga:', err))
        .finally(() => setLoading(false));
    }, 500); // debounce 500ms
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const toggleGenre = (g: string) => {
    if (selectedGenres.includes(g)) setSelectedGenres(selectedGenres.filter(x => x !== g));
    else setSelectedGenres([...selectedGenres, g]);
  };

  const SidebarContent = () => (
    <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
      {/* Genre Section */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, marginBottom: 12 }}>Genre</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
          <Ionicons name="search" size={16} color={colors.subtext} />
          <TextInput 
            placeholder="Cari genre..." 
            placeholderTextColor={colors.subtext}
            style={{ flex: 1, marginLeft: 8, color: colors.text, fontSize: 14 }}
          />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {MOCK_GENRES.map(g => {
            const isActive = selectedGenres.includes(g);
            return (
              <Pressable 
                key={g} 
                onPress={() => toggleGenre(g)}
                style={{
                  backgroundColor: isActive ? colors.chipActive : colors.chip,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: isActive ? colors.chipActive : colors.border
                }}
              >
                <Text style={{ color: isActive ? colors.chipTextActive : colors.subtext, fontSize: 12, fontWeight: isActive ? '800' : '600' }}>
                  {g}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* <CollapsibleSection title="Inclusion Mode" colors={colors}>
        <Text style={{ color: colors.subtext, fontSize: 12 }}>Dropdown placeholder</Text>
      </CollapsibleSection>
      <CollapsibleSection title="Exclusion Mode" colors={colors}>
        <Text style={{ color: colors.subtext, fontSize: 12 }}>Dropdown placeholder</Text>
      </CollapsibleSection> */}
      <CollapsibleSection title="Format" colors={colors}>
        <Text style={{ color: colors.subtext, fontSize: 12 }}>Manga, Manhwa, Manhua</Text>
      </CollapsibleSection>
      <CollapsibleSection title="Type" colors={colors}>
        <Text style={{ color: colors.subtext, fontSize: 12 }}>List of types</Text>
      </CollapsibleSection>
      <CollapsibleSection title="Status" colors={colors}>
        <Text style={{ color: colors.subtext, fontSize: 12 }}>Ongoing, Completed</Text>
      </CollapsibleSection>
      <CollapsibleSection title="Author" colors={colors}>
        <Text style={{ color: colors.subtext, fontSize: 12 }}>Search author</Text>
      </CollapsibleSection>
      <CollapsibleSection title="Artist" colors={colors}>
        <Text style={{ color: colors.subtext, fontSize: 12 }}>Search artist</Text>
      </CollapsibleSection>
      
      {/* Extra padding at bottom for mobile scrolling */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      
      {/* Top Bar */}
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: 12, 
        borderBottomWidth: 1, 
        borderBottomColor: colors.border,
        gap: 12
      }}>
        {!isDesktop && (
          <Pressable onPress={() => setIsSidebarOpenMobile(true)} style={{ padding: 8, backgroundColor: colors.card, borderRadius: 8 }}>
            <Ionicons name="options" size={20} color={colors.text} />
          </Pressable>
        )}
        
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.border }}>
          <Ionicons name="search" size={20} color={colors.subtext} />
          <TextInput 
            placeholder="Cari komik..." 
            placeholderTextColor={colors.subtext}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{ flex: 1, marginLeft: 10, color: colors.text, fontSize: 16 }}
          />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable onPress={() => setIsGridView(!isGridView)} style={{ padding: 8 }}>
            <Ionicons name={isGridView ? "grid" : "list"} size={22} color={colors.text} />
          </Pressable>
          <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>Terbaru</Text>
            <Ionicons name="chevron-down" size={16} color={colors.subtext} />
          </Pressable>
        </View>
      </View>

      <View style={{ flex: 1, flexDirection: 'row' }}>
        {/* Sidebar Desktop */}
        {isDesktop && (
          <View style={{ width: 280, backgroundColor: colors.sidebar, borderRightWidth: 1, borderRightColor: colors.border }}>
            <SidebarContent />
          </View>
        )}

        {/* Sidebar Mobile Overlay */}
        {!isDesktop && isSidebarOpenMobile && (
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 100, flexDirection: 'row' }}>
            <View style={{ width: 300, backgroundColor: colors.sidebar, height: '100%', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>Filter</Text>
                <Pressable onPress={() => setIsSidebarOpenMobile(false)} style={{ padding: 4 }}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>
              <SidebarContent />
            </View>
            <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setIsSidebarOpenMobile(false)} />
          </View>
        )}

        {/* Main Content */}
        <View style={{ flex: 1 }}>
          <FlatList
            key={columns} // Force re-render on column change
            data={items}
            numColumns={columns}
            keyExtractor={item => item.manga_id}
            contentContainerStyle={{ padding: 16, gap: 16 }}
            columnWrapperStyle={columns > 1 ? { gap: 16 } : undefined}
            ListHeaderComponent={
              ads.length > 0 ? (
                <View style={{ gap: 8, marginBottom: 16 }}>
                  {ads.map((ad, i) => (
                    <Pressable key={i} onPress={() => Linking.openURL(ad.url)}>
                      <ExpoImage source={{uri: ad.image}} style={{ width: '100%', height: 75, borderRadius: 8, backgroundColor: colors.card }} contentFit="contain" />
                    </Pressable>
                  ))}
                </View>
              ) : null
            }
            ListEmptyComponent={
              loading ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                   <ActivityIndicator color={colors.primary} />
                </View>
              ) : (
                <View style={{ padding: 40, alignItems: 'center' }}>
                   <Text style={{ color: colors.subtext }}>Tidak ada komik ditemukan.</Text>
                </View>
              )
            }
            renderItem={({ item }) => <MangaCard item={item} colors={colors} />}
          />
        </View>
      </View>
    </View>
  );
}
