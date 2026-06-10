import React, { useState } from 'react';
import { View, Pressable, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/ui/app-text';
import { useAppTheme } from '@/src/theme/ThemeContext';
import { BookmarksTab } from '@/src/components/library/BookmarksTab';
import { HistoryTab } from '@/src/components/library/HistoryTab';
import { DownloadsTab } from '@/src/components/library/DownloadsTab';

export default function LibraryScreen() {
  const { resolved } = useAppTheme();
  const isDark = resolved === 'dark';
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<'bookmarks' | 'history' | 'downloads'>('bookmarks');

  React.useEffect(() => {
    if (params.tab === 'history') {
      setActiveTab('history');
    } else if (params.tab === 'bookmarks') {
      setActiveTab('bookmarks');
    } else if (params.tab === 'downloads') {
      setActiveTab('downloads');
    }
  }, [params.tab]);
  
  // Animation states
  const [containerWidth, setContainerWidth] = useState(0);
  const tabAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(tabAnim, {
      toValue: activeTab === 'bookmarks' ? 0 : activeTab === 'history' ? 1 : 2,
      useNativeDriver: true,
      tension: 60,
      friction: 9,
    }).start();
  }, [activeTab, tabAnim]);

  const translateX = tabAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [
      0,
      containerWidth > 0 ? (containerWidth - 8) / 3 : 0,
      containerWidth > 0 ? (2 * (containerWidth - 8)) / 3 : 0
    ],
  });

  const colors = React.useMemo(
    () => ({
      bg: isDark ? '#0B0B0E' : '#F6F1E9',
      card: isDark ? '#121218' : '#FBF6EE',
      text: isDark ? '#F2F2F7' : '#1E2329',
      subtext: isDark ? '#B3B3C2' : '#6A625A',
      border: isDark ? '#242434' : '#E6DED2',
      primary: isDark ? '#F2F2F7' : '#1E2329',
      primaryText: isDark ? '#0B0B0E' : '#F6F1E9',
    }),
    [isDark]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ color: colors.text, fontWeight: '900', fontSize: 24, marginBottom: 16 }}>
          Perpustakaan
        </Text>
        
        {/* Segmented Control */}
        <View 
          onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
          style={{ 
            flexDirection: 'row', 
            backgroundColor: colors.card, 
            borderRadius: 12,
            padding: 4,
            borderWidth: 1,
            borderColor: colors.border,
            position: 'relative',
          }}
        >
          {/* Animated Background Pill */}
          {containerWidth > 0 && (
            <Animated.View style={{
              position: 'absolute',
              top: 4,
              bottom: 4,
              left: 4,
              width: (containerWidth - 8) / 3,
              backgroundColor: colors.primary,
              borderRadius: 8,
              transform: [{ translateX }],
            }} />
          )}

          <Pressable
            onPress={() => setActiveTab('bookmarks')}
            style={{
              flex: 1,
              paddingVertical: 10,
              alignItems: 'center',
              borderRadius: 8,
              zIndex: 1,
            }}
          >
            <Text style={{ 
              fontWeight: '800', 
              color: activeTab === 'bookmarks' ? colors.primaryText : colors.subtext 
            }}>
              Markah
            </Text>
          </Pressable>
          
          <Pressable
            onPress={() => setActiveTab('history')}
            style={{
              flex: 1,
              paddingVertical: 10,
              alignItems: 'center',
              borderRadius: 8,
              zIndex: 1,
            }}
          >
            <Text style={{ 
              fontWeight: '800', 
              color: activeTab === 'history' ? colors.primaryText : colors.subtext 
            }}>
              Riwayat
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('downloads')}
            style={{
              flex: 1,
              paddingVertical: 10,
              alignItems: 'center',
              borderRadius: 8,
              zIndex: 1,
            }}
          >
            <Text style={{ 
              fontWeight: '800', 
              color: activeTab === 'downloads' ? colors.primaryText : colors.subtext 
            }}>
              Unduhan
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {activeTab === 'bookmarks' ? (
          <BookmarksTab />
        ) : activeTab === 'history' ? (
          <HistoryTab />
        ) : (
          <DownloadsTab />
        )}
      </View>
    </View>
  );
}
