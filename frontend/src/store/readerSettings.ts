import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  apiGetSettings,
  apiUpdateSettings,
  type ApiSettings,
} from "@/src/api/komikamApi";

export type ImageQuality = "high" | "low";
export type ReaderBg = "black" | "dark" | "white";
export type ReadingMode = "scroll";

export type ReaderSettings = {
  imageQuality: ImageQuality;
  readerBg: ReaderBg;
  readingMode: ReadingMode;
  imageWidth: number; // 30 - 100 (persentase)
  fitToWidth: boolean; // otomatis menyesuaikan layar
};

const DEFAULT_SETTINGS: ReaderSettings = {
  imageQuality: "high",
  readerBg: "black",
  readingMode: "scroll",
  imageWidth: 100,
  fitToWidth: true,
};

const WIDTH_KEY = "komikam_reader_image_width";
const FIT_KEY = "komikam_reader_fit_to_width";

export async function getReaderSettings(): Promise<ReaderSettings> {
  let localWidth = DEFAULT_SETTINGS.imageWidth;
  let localFit = DEFAULT_SETTINGS.fitToWidth;
  try {
    const [w, f] = await Promise.all([
      AsyncStorage.getItem(WIDTH_KEY),
      AsyncStorage.getItem(FIT_KEY),
    ]);
    if (w !== null) localWidth = Number(w);
    if (f !== null) localFit = f === "true";
  } catch (err) {
    console.warn("Failed to get local reader settings:", err);
  }

  try {
    const s = await apiGetSettings();
    return {
      imageQuality: (s.reader_image_quality as ImageQuality) ?? DEFAULT_SETTINGS.imageQuality,
      readerBg:     (s.reader_bg as ReaderBg) ?? DEFAULT_SETTINGS.readerBg,
      readingMode:  "scroll",
      imageWidth:   localWidth,
      fitToWidth:   localFit,
    };
  } catch {
    return {
      ...DEFAULT_SETTINGS,
      imageWidth: localWidth,
      fitToWidth: localFit,
    };
  }
}

export async function setReaderSettings(
  s: Partial<ReaderSettings>,
): Promise<ReaderSettings> {
  const payload: ApiSettings = {};
  if (s.imageQuality !== undefined) payload.reader_image_quality = s.imageQuality;
  if (s.readerBg !== undefined) payload.reader_bg = s.readerBg;
  payload.reading_mode = "scroll";

  try {
    const promises: Promise<void>[] = [];
    if (s.imageWidth !== undefined) {
      promises.push(AsyncStorage.setItem(WIDTH_KEY, String(s.imageWidth)));
    }
    if (s.fitToWidth !== undefined) {
      promises.push(AsyncStorage.setItem(FIT_KEY, String(s.fitToWidth)));
    }
    if (promises.length > 0) {
      await Promise.all(promises);
    }
  } catch (err) {
    console.warn("Failed to save local reader settings:", err);
  }

  try {
    const updated = await apiUpdateSettings(payload);
    const current = await getReaderSettings();
    return {
      ...current,
      imageQuality: (updated.reader_image_quality as ImageQuality) ?? current.imageQuality,
      readerBg:     (updated.reader_bg as ReaderBg) ?? current.readerBg,
    };
  } catch {
    return getReaderSettings();
  }
}
