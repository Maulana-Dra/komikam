import AsyncStorage from "@react-native-async-storage/async-storage";

export type ImageQuality = "high" | "low";
export type ReaderBg = "black" | "dark" | "white";

export type ReaderSettings = {
  imageQuality: ImageQuality;
  readerBg: ReaderBg;
};

const DEFAULT_SETTINGS: ReaderSettings = {
  imageQuality: "high",
  readerBg: "black",
};

const SETTINGS_KEY = "reader_settings:v1";

export async function getReaderSettings(): Promise<ReaderSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function setReaderSettings(
  s: Partial<ReaderSettings>,
): Promise<ReaderSettings> {
  const current = await getReaderSettings();
  const next = { ...current, ...s };
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch (err) {
    console.error("Failed to save reader settings", err);
  }
  return next;
}
