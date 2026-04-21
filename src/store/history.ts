import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "komik:reading_history:v1";

export type ReadingProgress = {
  mangaId: string;
  chapterId: string;
  chapterNumber: number;
  pageIndex: number; // 0-based
  totalPages: number;
  updatedAt: number; // epoch ms
  mangaTitle?: string;
  coverUrl?: string;
};

type HistoryState = {
  items: ReadingProgress[]; // disimpan terbaru dulu (desc updatedAt)
};

function sortDesc(items: ReadingProgress[]): ReadingProgress[] {
  return [...items].sort((a, b) => b.updatedAt - a.updatedAt);
}

function isReadingProgress(x: unknown): x is ReadingProgress {
  if (!x || typeof x !== "object") return false;
  const it = x as Record<string, unknown>;
  return (
    typeof it.mangaId === "string" &&
    typeof it.chapterId === "string" &&
    typeof it.chapterNumber === "number" &&
    typeof it.pageIndex === "number" &&
    typeof it.totalPages === "number" &&
    typeof it.updatedAt === "number"
  );
}

async function readState(): Promise<HistoryState> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { items: [] };

  try {
    const parsed = JSON.parse(raw) as unknown;

    // format baru: { items: [...] }
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { items?: unknown }).items)) {
      const itemsRaw = (parsed as { items: unknown[] }).items;
      const items = itemsRaw.filter(isReadingProgress);
      return { items: sortDesc(items) };
    }

    // fallback kalau dulu pernah nyimpan array langsung: [...]
    if (Array.isArray(parsed)) {
      const items = parsed.filter(isReadingProgress);
      return { items: sortDesc(items) };
    }

    return { items: [] };
  } catch {
    return { items: [] };
  }
}

async function writeState(state: HistoryState): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify({ items: sortDesc(state.items) }));
}

export async function upsertProgress(p: ReadingProgress): Promise<void> {
  const state = await readState();

  // 1 manga = simpan progress terbaru (lebih masuk akal untuk history)
  const filtered = state.items.filter((x) => x.mangaId !== p.mangaId);

  await writeState({ items: [{ ...p }, ...filtered] });
}

export async function getLatestProgressByManga(mangaId: string): Promise<ReadingProgress | null> {
  const state = await readState();
  const found = state.items.find((x) => x.mangaId === mangaId);
  return found ?? null;
}

export async function getAllHistory(limit?: number): Promise<ReadingProgress[]> {
  const state = await readState();
  return typeof limit === "number" ? state.items.slice(0, limit) : state.items;
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

// ini yang dipakai historyView yang aku kasih: ambil semua progress
export async function getAllProgress(): Promise<ReadingProgress[]> {
  const state = await readState();
  return state.items;
}

export async function replaceHistory(items: ReadingProgress[]): Promise<void> {
  await writeState({ items });
}
