import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/src/legacy';
import { getChapterDetail } from '../api/shngmClient';

// Base directory for downloaded manga chapters (native only)
const MANGA_DIR = `${FileSystem.documentDirectory}downloaded_manga/`;

// Get local path for a chapter (native only)
export function getChapterLocalDir(mangaId: string, chapterId: string): string {
  return `${MANGA_DIR}${mangaId}/${chapterId}/`;
}

// Check if a chapter is downloaded (native only — always false on web)
export async function isChapterDownloaded(mangaId: string, chapterId: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const dir = getChapterLocalDir(mangaId, chapterId);
  try {
    const dirNoSlash = dir.endsWith('/') ? dir.slice(0, -1) : dir;
    const info = await FileSystem.getInfoAsync(dirNoSlash);
    if (!info.exists) return false;

    const manifestFile = `${dirNoSlash}/manifest.json`;
    const manifestInfo = await FileSystem.getInfoAsync(manifestFile);
    return manifestInfo.exists;
  } catch {
    return false;
  }
}

export type DownloadProgressCallback = (progress: number) => void;

// Download entire chapter images — native only, throws on web
export async function downloadChapter(
  mangaId: string,
  chapterId: string,
  mangaTitle: string,
  mangaCoverUrl: string,
  onProgress?: DownloadProgressCallback
): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('Fitur unduhan tidak tersedia di browser web.');
  }

  const localDir = getChapterLocalDir(mangaId, chapterId);
  try {
    // Create directories recursively
    await FileSystem.makeDirectoryAsync(localDir, { intermediates: true });

    // Fetch chapter detail to get image URLs
    const detail = await getChapterDetail(chapterId);
    const data = detail.data;
    const baseUrl = data.base_url;
    const path = data.chapter.path;
    const filenames = data.chapter.data;

    const totalFiles = filenames.length;
    if (totalFiles === 0) throw new Error('No pages found in this chapter.');

    const join = (base: string, p: string, f: string) => {
      const b = base.endsWith('/') ? base.slice(0, -1) : base;
      const pathStr = p.startsWith('/') ? p : `/${p}`;
      const pathSlash = pathStr.endsWith('/') ? pathStr : `${pathStr}/`;
      return `${b}${pathSlash}${f}`;
    };

    // Download pages with real-time per-file progress via createDownloadResumable
    for (let i = 0; i < filenames.length; i++) {
      const filename = filenames[i];
      const imageUrl = join(baseUrl, path, filename);
      const localFilePath = `${localDir}${filename}`;

      const downloadResumable = FileSystem.createDownloadResumable(
        imageUrl,
        localFilePath,
        {},
        (downloadProgress) => {
          const totalBytes = downloadProgress.totalBytesExpectedToWrite;
          const loadedBytes = downloadProgress.totalBytesWritten;
          const fileProgress = totalBytes > 0 ? loadedBytes / totalBytes : 0;
          if (onProgress) {
            onProgress((i + fileProgress) / totalFiles);
          }
        }
      );

      const downloadRes = await downloadResumable.downloadAsync();
      if (!downloadRes || downloadRes.status !== 200) {
        throw new Error(`Failed to download page ${i + 1}`);
      }
    }

    // Write manifest at the very end (only after all pages succeed)
    const manifest = {
      mangaId,
      chapterId,
      mangaTitle,
      mangaCoverUrl,
      chapterNumber: data.chapter_number,
      chapterTitle: data.chapter_title,
      base_url: data.base_url,
      base_url_low: data.base_url_low,
      chapter: {
        path: data.chapter.path,
        data: filenames,
      },
      downloadedAt: Date.now(),
    };

    await FileSystem.writeAsStringAsync(`${localDir}manifest.json`, JSON.stringify(manifest));
  } catch (err) {
    // Clean up on failure to prevent corrupted/incomplete states
    try {
      await FileSystem.deleteAsync(localDir, { idempotent: true });
    } catch (cleanupErr) {
      console.error('Failed to clean up incomplete download folder:', cleanupErr);
    }
    throw err;
  }
}

// Read local chapter pages (native only)
export async function getLocalChapterPages(mangaId: string, chapterId: string): Promise<string[]> {
  if (Platform.OS === 'web') return [];

  const dir = getChapterLocalDir(mangaId, chapterId);
  const manifestFile = `${dir}manifest.json`;

  const raw = await FileSystem.readAsStringAsync(manifestFile);
  const manifest = JSON.parse(raw);

  return manifest.chapter.data.map((filename: string) => `${dir}${filename}`);
}

// Delete a downloaded chapter (native only)
export async function deleteDownloadedChapter(mangaId: string, chapterId: string): Promise<void> {
  if (Platform.OS === 'web') return;

  const dir = getChapterLocalDir(mangaId, chapterId);
  try {
    await FileSystem.deleteAsync(dir, { idempotent: true });
  } catch (e) {
    console.error('Failed to delete local chapter', e);
  }
}

export interface DownloadedChapterInfo {
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  downloadedAt: number;
  sizeBytes: number;
}

export interface DownloadedMangaInfo {
  mangaId: string;
  mangaTitle: string;
  mangaCoverUrl: string;
  chapters: DownloadedChapterInfo[];
  totalSizeBytes: number;
}

// Get list of all downloaded manga and chapters (native only)
export async function getDownloadedMangaList(): Promise<DownloadedMangaInfo[]> {
  if (Platform.OS === 'web') return [];

  try {
    const dirInfo = await FileSystem.getInfoAsync(MANGA_DIR);
    if (!dirInfo.exists) return [];

    const mangaIds = await FileSystem.readDirectoryAsync(MANGA_DIR);
    const result: DownloadedMangaInfo[] = [];

    for (const mangaId of mangaIds) {
      const mangaPath = `${MANGA_DIR}${mangaId}`;
      const mangaPathInfo = await FileSystem.getInfoAsync(mangaPath);
      if (!mangaPathInfo.isDirectory) continue;

      const chapterIds = await FileSystem.readDirectoryAsync(mangaPath + '/');
      const chapters: DownloadedChapterInfo[] = [];
      let mangaTitle = '';
      let mangaCoverUrl = '';

      for (const chapterId of chapterIds) {
        const chapterPath = `${mangaPath}/${chapterId}`;
        const chapterPathInfo = await FileSystem.getInfoAsync(chapterPath);
        if (!chapterPathInfo.isDirectory) continue;

        const manifestPath = `${chapterPath}/manifest.json`;
        const manifestInfo = await FileSystem.getInfoAsync(manifestPath);
        if (!manifestInfo.exists) continue;

        try {
          const raw = await FileSystem.readAsStringAsync(manifestPath);
          const manifest = JSON.parse(raw);

          if (!mangaTitle && manifest.mangaTitle) {
            mangaTitle = manifest.mangaTitle;
          }
          if (!mangaCoverUrl && manifest.mangaCoverUrl) {
            mangaCoverUrl = manifest.mangaCoverUrl;
          }

          const files = await FileSystem.readDirectoryAsync(chapterPath + '/');
          let chapterSize = 0;
          for (const file of files) {
            const fileInfo = await FileSystem.getInfoAsync(`${chapterPath}/${file}`);
            if (fileInfo.exists && !fileInfo.isDirectory && fileInfo.size !== undefined) {
              chapterSize += fileInfo.size;
            }
          }

          chapters.push({
            chapterId,
            chapterNumber: manifest.chapterNumber,
            chapterTitle: manifest.chapterTitle || `Chapter ${manifest.chapterNumber}`,
            downloadedAt: manifest.downloadedAt || Date.now(),
            sizeBytes: chapterSize,
          });
        } catch (err) {
          console.error(`Failed to parse manifest for chapter ${chapterId}:`, err);
        }
      }

      if (chapters.length > 0) {
        chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
        result.push({
          mangaId,
          mangaTitle: mangaTitle || `Manga ${mangaId}`,
          mangaCoverUrl: mangaCoverUrl || '',
          chapters,
          totalSizeBytes: chapters.reduce((sum, c) => sum + c.sizeBytes, 0),
        });
      }
    }

    return result;
  } catch (e) {
    console.error('Failed to get downloaded manga list:', e);
    return [];
  }
}

// Delete all downloaded manga chapters (native only)
export async function deleteAllDownloads(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    await FileSystem.deleteAsync(MANGA_DIR, { idempotent: true });
  } catch (e) {
    console.error('Failed to delete all downloads:', e);
  }
}
