import AsyncStorage from "@react-native-async-storage/async-storage";

import { replaceBookmarks, getBookmarks, type BookmarkItem } from "./bookmarks";
import {
  replaceHistory,
  getAllHistory,
  type ReadingProgress,
} from "./history";
import { getThemeMode, setThemeMode, type ThemeMode } from "./theme";

const PROFILE_KEY = "account:profile:v1";
const CLOUD_KEY = "account:cloud:v1";

export type AccountProfile = {
  id: string;
  name: string;
  email?: string;
  createdAt: number;
  lastSyncAt?: number;
};

type CloudPayload = {
  savedAt: number;
  bookmarks: BookmarkItem[];
  history: ReadingProgress[];
  theme: ThemeMode;
};

async function readJson<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function getProfile(): Promise<AccountProfile | null> {
  return readJson<AccountProfile>(PROFILE_KEY);
}

export async function signIn(input: {
  name: string;
  email?: string;
}): Promise<AccountProfile> {
  const profile: AccountProfile = {
    id: `acct_${Date.now()}`,
    name: input.name.trim(),
    email: input.email?.trim() || undefined,
    createdAt: Date.now(),
  };
  await writeJson(PROFILE_KEY, profile);
  return profile;
}

export async function signOut(): Promise<void> {
  await AsyncStorage.removeItem(PROFILE_KEY);
}

export async function syncUpload(): Promise<CloudPayload> {
  const profile = await getProfile();
  if (!profile) throw new Error("Belum login");

  const [bookmarks, history, theme] = await Promise.all([
    getBookmarks(),
    getAllHistory(),
    getThemeMode(),
  ]);

  const payload: CloudPayload = {
    savedAt: Date.now(),
    bookmarks,
    history,
    theme,
  };

  await writeJson(CLOUD_KEY, payload);
  const nextProfile: AccountProfile = {
    ...profile,
    lastSyncAt: payload.savedAt,
  };
  await writeJson(PROFILE_KEY, nextProfile);
  return payload;
}

export async function syncDownload(): Promise<CloudPayload> {
  const profile = await getProfile();
  if (!profile) throw new Error("Belum login");

  const payload = await readJson<CloudPayload>(CLOUD_KEY);
  if (!payload) throw new Error("Belum ada data cloud");

  await Promise.all([
    replaceBookmarks(payload.bookmarks),
    replaceHistory(payload.history),
    setThemeMode(payload.theme),
  ]);

  const nextProfile: AccountProfile = {
    ...profile,
    lastSyncAt: Date.now(),
  };
  await writeJson(PROFILE_KEY, nextProfile);
  return payload;
}
