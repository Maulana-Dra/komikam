import AsyncStorage from "@react-native-async-storage/async-storage";

export type BookmarkItem = {
  mangaId: string;
  title: string;
  coverUrl: string;
  updatedAt: number;
};

const KEY = "bookmarks:v1";

async function readAll(): Promise<BookmarkItem[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // basic validation
    return parsed.filter((x): x is BookmarkItem => {
      if (!x || typeof x !== "object") return false;
      const it = x as Record<string, unknown>;
      return (
        typeof it.mangaId === "string" &&
        typeof it.title === "string" &&
        typeof it.coverUrl === "string" &&
        typeof it.updatedAt === "number"
      );
    });
  } catch {
    return [];
  }
}

async function writeAll(items: BookmarkItem[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export async function getBookmarks(): Promise<BookmarkItem[]> {
  const items = await readAll();
  // terbaru dulu
  return items.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function isBookmarked(mangaId: string): Promise<boolean> {
  const items = await readAll();
  return items.some((x) => x.mangaId === mangaId);
}

export async function addBookmark(item: Omit<BookmarkItem, "updatedAt">): Promise<void> {
  const items = await readAll();
  const now = Date.now();

  const map = new Map<string, BookmarkItem>();
  for (const it of items) map.set(it.mangaId, it);

  map.set(item.mangaId, { ...item, updatedAt: now });

  await writeAll(Array.from(map.values()));
}

export async function removeBookmark(mangaId: string): Promise<void> {
  const items = await readAll();
  const next = items.filter((x) => x.mangaId !== mangaId);
  await writeAll(next);
}

export async function clearBookmarks(): Promise<void> {
  await writeAll([]);
}

export async function toggleBookmark(item: Omit<BookmarkItem, "updatedAt">): Promise<boolean> {
  const items = await readAll();
  const exists = items.some((x) => x.mangaId === item.mangaId);

  if (exists) {
    await removeBookmark(item.mangaId);
    return false;
  }

  await addBookmark(item);
  return true;
}

export async function replaceBookmarks(items: BookmarkItem[]): Promise<void> {
  await writeAll(items);
}
