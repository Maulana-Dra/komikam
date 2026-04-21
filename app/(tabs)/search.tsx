import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, TextInput, Pressable, FlatList, useWindowDimensions,
  ScrollView, Platform, ActivityIndicator, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '@/components/ui/app-text';
import { useAppTheme } from '@/src/theme/ThemeContext';
import { useRouter } from 'expo-router';
import { getMangaListByType } from '@/src/api/shngmClient';
import type { ShngmManga } from '@/src/api/shngmTypes';

// ─────────────────────────── constants ───────────────────────────
const MOCK_GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy',
  'Horror', 'Mecha', 'Mystery', 'Psychological', 'Romance',
  'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller',
];

const FORMAT_OPTIONS = ['Manga', 'Manhwa', 'Manhua'];
const TYPE_OPTIONS   = ['Mirror', 'Project'];
const STATUS_OPTIONS = ['Ongoing', 'Completed', 'Hiatus'];

type SortKey = 'latest' | 'popular' | 'rating' | 'bookmark';
type SortOption = { label: string; value: SortKey };
const SORT_OPTIONS: SortOption[] = [
  { label: 'Terbaru',     value: 'latest'   },
  { label: 'Popularitas', value: 'popular'  },
  { label: 'Rating',      value: 'rating'   },
  { label: 'Bookmark',    value: 'bookmark' },
];

// ─────────────────────────── helpers ─────────────────────────────
function getFlagEmoji(countryId: string) {
  const map: Record<string, string> = {
    kr: '🇰🇷', jp: '🇯🇵', cn: '🇨🇳', id: '🇮🇩', gb: '🇬🇧', us: '🇺🇸',
  };
  return map[(countryId || '').toLowerCase()] || countryId?.toUpperCase() || '';
}

function formatViews(views: number) {
  if (views >= 1_000_000) return (views / 1_000_000).toFixed(1) + 'M';
  if (views >= 1_000)     return (views / 1_000).toFixed(1) + 'K';
  return String(views);
}

function parseRelativeTime(s: string) {
  if (!s) return '';
  if (s.includes('hour')) return s.split(' ')[0] + 'h';
  if (s.includes('day'))  return s.split(' ')[0] + 'd';
  if (s.includes('min'))  return s.split(' ')[0] + 'm';
  return s;
}

/** Client-side sort so all four options work without needing new API params */
function sortItems(items: ShngmManga[], key: SortKey): ShngmManga[] {
  const arr = [...items];
  switch (key) {
    case 'popular':  return arr.sort((a, b) => b.view_count - a.view_count);
    case 'rating':   return arr.sort((a, b) => (b.user_rate ?? 0) - (a.user_rate ?? 0));
    case 'bookmark': return arr.sort((a, b) => b.bookmark_count - a.bookmark_count);
    case 'latest':
    default:         return arr.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }
}

// ─────────────────────────── types ───────────────────────────────
type Colors = {
  bg: string; card: string; sidebar: string; text: string;
  subtext: string; border: string; chip: string;
  chipActive: string; chipTextActive: string; danger: string; primary: string;
};

// ─────────────────────── CollapsibleSection ──────────────────────
const CollapsibleSection = ({
  title, children, colors,
}: { title: string; children: React.ReactNode; colors: Colors }) => {
  const [open, setOpen] = useState(true); // open by default for better UX
  return (
    <View style={{ marginBottom: 16 }}>
      <Pressable
        onPress={() => setOpen(v => !v)}
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}
      >
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.subtext} />
      </Pressable>
      {open && <View style={{ paddingTop: 10 }}>{children}</View>}
    </View>
  );
};

// ─────────────────────── FilterChips ─────────────────────────────
/** A row of selectable pill chips */
const FilterChips = ({
  options, selected, onToggle, colors,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  colors: Colors;
}) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    {options.map(opt => {
      const active = selected.includes(opt);
      return (
        <Pressable
          key={opt}
          onPress={() => onToggle(opt)}
          style={{
            paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
            borderWidth: 1,
            backgroundColor: active ? colors.chipActive : colors.chip,
            borderColor: active ? colors.chipActive : colors.border,
          }}
        >
          <Text style={{ color: active ? colors.chipTextActive : colors.subtext, fontSize: 12, fontWeight: active ? '800' : '600' }}>
            {opt}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

// ─────────────────────── SidebarContent ──────────────────────────
type SidebarProps = {
  colors: Colors;
  selectedGenres: string[];
  selectedFormats: string[];
  selectedTypes: string[];
  selectedStatuses: string[];
  onToggleGenre: (g: string) => void;
  onToggleFormat: (f: string) => void;
  onToggleType: (t: string) => void;
  onToggleStatus: (s: string) => void;
  onClearAll: () => void;
};

const SidebarContent = ({
  colors, selectedGenres, selectedFormats, selectedTypes, selectedStatuses,
  onToggleGenre, onToggleFormat, onToggleType, onToggleStatus, onClearAll,
}: SidebarProps) => {
  const [genreQuery, setGenreQuery] = useState('');
  const filteredGenres = genreQuery
    ? MOCK_GENRES.filter(g => g.toLowerCase().includes(genreQuery.toLowerCase()))
    : MOCK_GENRES;

  const totalActive = selectedGenres.length + selectedFormats.length + selectedTypes.length + selectedStatuses.length;

  return (
    <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
      {/* Header with clear button */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16 }}>Filter</Text>
        {totalActive > 0 && (
          <Pressable onPress={onClearAll} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.danger }}>
            <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800' }}>Clear ({totalActive})</Text>
          </Pressable>
        )}
      </View>

      {/* Genre */}
      <CollapsibleSection title="Genre" colors={colors}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}>
          <Ionicons name="search" size={14} color={colors.subtext} />
          <TextInput
            placeholder="Cari genre..."
            placeholderTextColor={colors.subtext}
            value={genreQuery}
            onChangeText={setGenreQuery}
            style={{ flex: 1, marginLeft: 8, color: colors.text, fontSize: 13 }}
          />
        </View>
        <FilterChips options={filteredGenres} selected={selectedGenres} onToggle={onToggleGenre} colors={colors} />
      </CollapsibleSection>

      {/* Format */}
      <CollapsibleSection title="Format" colors={colors}>
        <FilterChips options={FORMAT_OPTIONS} selected={selectedFormats} onToggle={onToggleFormat} colors={colors} />
      </CollapsibleSection>

      {/* Type */}
      <CollapsibleSection title="Type" colors={colors}>
        <FilterChips options={TYPE_OPTIONS} selected={selectedTypes} onToggle={onToggleType} colors={colors} />
      </CollapsibleSection>

      {/* Status */}
      <CollapsibleSection title="Status" colors={colors}>
        <FilterChips options={STATUS_OPTIONS} selected={selectedStatuses} onToggle={onToggleStatus} colors={colors} />
      </CollapsibleSection>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

// ─────────────────────── MangaCard ───────────────────────────────
type CardProps = { item: ShngmManga; colors: Colors; isGrid: boolean };

const MangaCard = ({ item, colors, isGrid }: CardProps) => {
  const router = useRouter();
  const handlePress = () =>
    router.push({
      pathname: '/manga/[mangaId]',
      params: { mangaId: item.manga_id, title: item.title, coverUrl: item.cover_portrait_url || item.cover_image_url },
    });

  const coverUri = item.cover_portrait_url || item.cover_image_url;

  if (!isGrid) {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => ({
          flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12,
          overflow: 'hidden', borderWidth: 1, borderColor: colors.border,
          marginBottom: 10, opacity: pressed ? 0.85 : 1, gap: 12, padding: 10,
        })}
      >
        <ExpoImage source={{ uri: coverUri }} style={{ width: 64, height: 90, borderRadius: 8, backgroundColor: colors.border }} contentFit="cover" />
        <View style={{ flex: 1, justifyContent: 'center', gap: 4 }}>
          <Text style={{ color: colors.text, fontWeight: '900', fontSize: 14 }} numberOfLines={2}>{item.title}</Text>
          {item.alternative_title ? <Text style={{ color: colors.subtext, fontSize: 12 }} numberOfLines={1}>{item.alternative_title}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
            <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: '700' }}>Ch {item.latest_chapter_number}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="eye" size={12} color={colors.subtext} />
              <Text style={{ color: colors.subtext, fontSize: 11 }}>{formatViews(item.view_count)}</Text>
            </View>
            {item.user_rate ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="star" size={11} color="#EAB308" />
                <Text style={{ color: colors.subtext, fontSize: 11 }}>{item.user_rate}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.subtext} style={{ alignSelf: 'center' }} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        { flex: 1, backgroundColor: colors.card, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.88 : 1 },
      ]}
    >
      <View style={{ aspectRatio: 2 / 3, width: '100%', position: 'relative' }}>
        <ExpoImage source={{ uri: coverUri }} style={{ width: '100%', height: '100%', backgroundColor: colors.border }} contentFit="cover" />
        {item.latest_chapter_time ? (
          <View style={{ position: 'absolute', top: 6, left: 6, backgroundColor: colors.danger, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
            <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '900' }}>
              {item.is_recommended ? 'UP ' : ''}{parseRelativeTime(item.latest_chapter_time)}
            </Text>
          </View>
        ) : null}
        {item.country_id ? (
          <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 }}>
            <Text style={{ fontSize: 10 }}>{getFlagEmoji(item.country_id)}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ padding: 8, gap: 4 }}>
        <Text style={{ color: colors.text, fontWeight: '900', fontSize: 13 }} numberOfLines={2}>{item.title}</Text>
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

// ─────────────────────── SortDropdown Modal ───────────────────────
const SortDropdown = ({
  visible, onClose, sortBy, onSelect, colors,
}: {
  visible: boolean;
  onClose: () => void;
  sortBy: SortKey;
  onSelect: (v: SortKey) => void;
  colors: Colors;
}) => (
  <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
    <Pressable style={{ flex: 1 }} onPress={onClose}>
      <View style={{ position: 'absolute', top: 100, right: 16, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, minWidth: 180, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, elevation: 20 }}>
        {SORT_OPTIONS.map(opt => {
          const active = sortBy === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => { onSelect(opt.value); onClose(); }}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingHorizontal: 16, paddingVertical: 14,
                backgroundColor: active ? colors.chip : pressed ? colors.border : 'transparent',
              })}
            >
              <Text style={{ color: active ? colors.text : colors.subtext, fontWeight: active ? '800' : '600', fontSize: 14 }}>
                {opt.label}
              </Text>
              {active && <Ionicons name="checkmark" size={16} color={colors.chipActive} />}
            </Pressable>
          );
        })}
      </View>
    </Pressable>
  </Modal>
);

// ─────────────────────── SearchScreen ────────────────────────────
export default function SearchScreen() {
  const { resolved } = useAppTheme();
  const isDark = resolved === 'dark';
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isDesktop = width >= 768;

  const [isGridView, setIsGridView] = useState(true);
  const columns = isGridView ? (isDesktop ? (width >= 1024 ? 6 : 4) : 2) : 1;

  const colors = useMemo<Colors>(() => ({
    bg:             isDark ? '#0B0B0E' : '#F6F1E9',
    card:           isDark ? '#121218' : '#FBF6EE',
    sidebar:        isDark ? '#101015' : '#F2EADF',
    text:           isDark ? '#F2F2F7' : '#1E2329',
    subtext:        isDark ? '#B3B3C2' : '#6A625A',
    border:         isDark ? '#242434' : '#E6DED2',
    chip:           isDark ? '#1A1A24' : '#EFE6DA',
    chipActive:     isDark ? '#F2F2F7' : '#1E2329',
    chipTextActive: isDark ? '#0B0B0E' : '#F6F1E9',
    danger:         isDark ? '#FF5C5C' : '#D32F2F',
    primary:        isDark ? '#4A90E2' : '#005bb5',
  }), [isDark]);

  // filter state
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  const [selectedGenres,   setSelectedGenres]   = useState<string[]>([]);
  const [selectedFormats,  setSelectedFormats]  = useState<string[]>([]);
  const [selectedTypes,    setSelectedTypes]    = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  // sort state
  const [sortBy, setSortBy] = useState<SortKey>('latest');
  const [isSortOpen, setIsSortOpen] = useState(false);

  // data
  const [searchQuery, setSearchQuery] = useState('');
  const [rawItems, setRawItems] = useState<ShngmManga[]>([]);
  const [loading, setLoading] = useState(false);

  // stable toggle helpers
  const makeToggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) =>
    useCallback((v: string) => setter(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]), []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const toggleGenre   = useCallback((v: string) => setSelectedGenres(p   => p.includes(v) ? p.filter(x => x !== v) : [...p, v]), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const toggleFormat  = useCallback((v: string) => setSelectedFormats(p  => p.includes(v) ? p.filter(x => x !== v) : [...p, v]), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const toggleType    = useCallback((v: string) => setSelectedTypes(p    => p.includes(v) ? p.filter(x => x !== v) : [...p, v]), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const toggleStatus  = useCallback((v: string) => setSelectedStatuses(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]), []);

  const clearAll = useCallback(() => {
    setSelectedGenres([]); setSelectedFormats([]); setSelectedTypes([]); setSelectedStatuses([]);
  }, []);

  // fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      getMangaListByType({ page: 1, pageSize: 48, query: searchQuery || undefined })
        .then(res => setRawItems(res.data))
        .catch(err => console.log('fetch error:', err))
        .finally(() => setLoading(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // derived: sort client-side
  const items = useMemo(() => sortItems(rawItems, sortBy), [rawItems, sortBy]);

  const groupedData = useMemo(() => {
    if (columns === 1) {
      return items.map((item) => ({ id: item.manga_id, items: [item] }));
    }
    const result = [];
    for (let i = 0; i < items.length; i += columns) {
      result.push({
        id: `row-${i}`,
        items: items.slice(i, i + columns),
      });
    }
    return result;
  }, [items, columns]);

  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label ?? 'Terbaru';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>

      {/* ── Top Bar ──────────────────────────────────────── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10 }}>
        {!isDesktop && (
          <Pressable onPress={() => setIsSidebarOpenMobile(true)} style={{ padding: 8, backgroundColor: colors.card, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
            <Ionicons name="options-outline" size={20} color={colors.text} />
          </Pressable>
        )}

        {/* Search */}
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.border }}>
          <Ionicons name="search" size={18} color={colors.subtext} />
          <TextInput
            placeholder="Cari komik..."
            placeholderTextColor={colors.subtext}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{ flex: 1, marginLeft: 10, color: colors.text, fontSize: 15 }}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.subtext} />
            </Pressable>
          )}
        </View>

        {/* Grid/List toggle */}
        <Pressable
          onPress={() => setIsGridView(v => !v)}
          style={{ padding: 8, backgroundColor: colors.card, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}
        >
          <Ionicons name={isGridView ? 'grid-outline' : 'list-outline'} size={20} color={colors.text} />
        </Pressable>

        {/* Sort button — uses Modal so it's never clipped */}
        <Pressable
          onPress={() => setIsSortOpen(true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}
        >
          <Ionicons name="swap-vertical-outline" size={16} color={colors.subtext} />
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{currentSortLabel}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.subtext} />
        </Pressable>
      </View>

      {/* Sort Modal Dropdown */}
      <SortDropdown
        visible={isSortOpen}
        onClose={() => setIsSortOpen(false)}
        sortBy={sortBy}
        onSelect={setSortBy}
        colors={colors}
      />

      <View style={{ flex: 1, flexDirection: 'row' }}>
        {/* ── Sidebar Desktop ──────────────────────────── */}
        {isDesktop && (
          <View style={{ width: 260, backgroundColor: colors.sidebar, borderRightWidth: 1, borderRightColor: colors.border }}>
            <SidebarContent
              colors={colors}
              selectedGenres={selectedGenres}
              selectedFormats={selectedFormats}
              selectedTypes={selectedTypes}
              selectedStatuses={selectedStatuses}
              onToggleGenre={toggleGenre}
              onToggleFormat={toggleFormat}
              onToggleType={toggleType}
              onToggleStatus={toggleStatus}
              onClearAll={clearAll}
            />
          </View>
        )}

        {/* ── Sidebar Mobile Overlay ───────────────────── */}
        {!isDesktop && isSidebarOpenMobile && (
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 100, flexDirection: 'row' }}>
            <View style={{ width: 300, backgroundColor: colors.sidebar, height: '100%', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>Filter</Text>
                <Pressable onPress={() => setIsSidebarOpenMobile(false)} style={{ padding: 4 }}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>
              <SidebarContent
                colors={colors}
                selectedGenres={selectedGenres}
                selectedFormats={selectedFormats}
                selectedTypes={selectedTypes}
                selectedStatuses={selectedStatuses}
                onToggleGenre={toggleGenre}
                onToggleFormat={toggleFormat}
                onToggleType={toggleType}
                onToggleStatus={toggleStatus}
                onClearAll={clearAll}
              />
            </View>
            <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setIsSidebarOpenMobile(false)} />
          </View>
        )}

        {/* ── Main Content ──────────────────────────────── */}
        <View style={{ flex: 1 }}>
          <FlatList
            data={groupedData}
            keyExtractor={row => row.id}
            contentContainerStyle={{ padding: isGridView ? 14 : 12, gap: isGridView ? 14 : 0 }}
            ListEmptyComponent={
              loading ? (
                <View style={{ padding: 48, alignItems: 'center' }}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : (
                <View style={{ padding: 48, alignItems: 'center', gap: 8 }}>
                  <Ionicons name="search-outline" size={40} color={colors.subtext} />
                  <Text style={{ color: colors.subtext }}>Tidak ada komik ditemukan.</Text>
                </View>
              )
            }
            renderItem={({ item: row }) => (
              <View style={{ flexDirection: 'row', gap: isGridView ? 14 : 0 }}>
                {row.items.map(item => (
                  <MangaCard key={item.manga_id} item={item} colors={colors} isGrid={isGridView} />
                ))}
                {isGridView && Array.from({ length: columns - row.items.length }).map((_, i) => (
                  <View key={`empty-${i}`} style={{ flex: 1 }} />
                ))}
              </View>
            )}
          />
        </View>
      </View>
    </View>
  );
}
