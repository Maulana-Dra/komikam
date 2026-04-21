import { getMangaList } from "../api/shngmClient";
import type { ShngmManga } from "../api/shngmTypes";
import { getAllProgress } from "./history"; // kamu perlu export ini dari store history kamu

export type HistoryItem = {
  mangaId: string;
  title: string;
  coverUrl: string;
  updatedAt: number;
  chapterId: string;
  chapterNumber: number;
  pageIndex: number;
  totalPages: number;
};


async function findMangaFromList(mangaId: string): Promise<ShngmManga | null> {
  const res = await getMangaList({ page: 1, pageSize: 100 }); // biar lebih banyak ketemu
  const found = res.data.find((m) => m.manga_id === mangaId);
  return found ?? null;
}

export async function getHistoryItems(): Promise<HistoryItem[]> {
  const progressList = await getAllProgress();

  // urut terbaru
  const sorted = [...progressList].sort((a, b) => b.updatedAt - a.updatedAt);

  const items: HistoryItem[] = [];
  for (const p of sorted) {
    const manga = await findMangaFromList(p.mangaId);
    items.push({
      mangaId: p.mangaId,
      title: manga?.title ?? "Unknown",
      coverUrl: manga?.cover_portrait_url ?? manga?.cover_image_url ?? "",
      updatedAt: p.updatedAt,
      chapterId: p.chapterId,
      chapterNumber: p.chapterNumber,
      pageIndex: p.pageIndex,
      totalPages: p.totalPages,
    });
  }

  return items;
}
