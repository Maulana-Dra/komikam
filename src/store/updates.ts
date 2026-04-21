import AsyncStorage from "@react-native-async-storage/async-storage";

import { getChapterList } from "@/src/api/shngmClient";
import type { BookmarkItem } from "@/src/store/bookmarks";

const LAST_SEEN_KEY = "updates:last_seen:v1";
const PENDING_KEY = "updates:pending:v1";

type LastSeenMap = Record<
  string,
  {
    chapterId: string;
    chapterNumber: number;
    updatedAt: number;
  }
>;

export type UpdateEntry = {
  mangaId: string;
  title: string;
  coverUrl: string;
  chapterId: string;
  chapterNumber: number;
  detectedAt: number;
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

async function getLastSeenMap(): Promise<LastSeenMap> {
  return readJson<LastSeenMap>(LAST_SEEN_KEY, {});
}

async function setLastSeenMap(map: LastSeenMap): Promise<void> {
  await writeJson(LAST_SEEN_KEY, map);
}

export async function getPendingUpdates(): Promise<UpdateEntry[]> {
  const items = await readJson<UpdateEntry[]>(PENDING_KEY, []);
  return items.sort((a, b) => b.detectedAt - a.detectedAt);
}

export async function clearPendingUpdates(): Promise<void> {
  await writeJson(PENDING_KEY, []);
}

export async function removePendingUpdate(mangaId: string): Promise<void> {
  const items = await getPendingUpdates();
  const next = items.filter((x) => x.mangaId !== mangaId);
  await writeJson(PENDING_KEY, next);
}

function pickLatestChapter(items: {
  chapter_id: string;
  chapter_number?: number | null;
}[]): { chapterId: string; chapterNumber: number } | null {
  if (items.length === 0) return null;
  let best = items[0];
  for (const it of items) {
    const num = typeof it.chapter_number === "number" ? it.chapter_number : 0;
    const bestNum =
      typeof best.chapter_number === "number" ? best.chapter_number : 0;
    if (num > bestNum) best = it;
  }
  return {
    chapterId: best.chapter_id,
    chapterNumber:
      typeof best.chapter_number === "number" ? best.chapter_number : 0,
  };
}

export async function checkUpdatesForBookmarks(
  bookmarks: BookmarkItem[],
): Promise<{ updates: UpdateEntry[]; checked: number }> {
  const lastSeen = await getLastSeenMap();
  const pending = await getPendingUpdates();
  const pendingMap = new Map(pending.map((p) => [p.mangaId, p]));
  const detected: UpdateEntry[] = [];

  for (const bm of bookmarks) {
    const res = await getChapterList({
      mangaId: bm.mangaId,
      page: 1,
      pageSize: 10,
      cacheMode: "no-cache",
    });
    const latest = pickLatestChapter(res.data);
    if (!latest) continue;

    const prev = lastSeen[bm.mangaId];
    if (!prev) {
      lastSeen[bm.mangaId] = {
        chapterId: latest.chapterId,
        chapterNumber: latest.chapterNumber,
        updatedAt: Date.now(),
      };
      continue;
    }

    if (latest.chapterNumber > prev.chapterNumber) {
      const entry: UpdateEntry = {
        mangaId: bm.mangaId,
        title: bm.title,
        coverUrl: bm.coverUrl,
        chapterId: latest.chapterId,
        chapterNumber: latest.chapterNumber,
        detectedAt: Date.now(),
      };
      pendingMap.set(bm.mangaId, entry);
      detected.push(entry);
      lastSeen[bm.mangaId] = {
        chapterId: latest.chapterId,
        chapterNumber: latest.chapterNumber,
        updatedAt: Date.now(),
      };
    }
  }

  await setLastSeenMap(lastSeen);
  await writeJson(PENDING_KEY, Array.from(pendingMap.values()));

  return { updates: detected, checked: bookmarks.length };
}
