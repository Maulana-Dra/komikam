import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const TOKEN_KEY = "komikam:api_token:v1";
const USER_KEY  = "komikam:api_user:v1";

export type ApiUser = {
  id: number;
  name: string;
  email: string;
  created_at: string;
};

// SecureStore hanya tersedia di native (iOS/Android).
// Di web, fallback ke AsyncStorage.
async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

export async function saveToken(token: string): Promise<void> {
  await secureSet(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return secureGet(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  await secureDelete(TOKEN_KEY);
  await secureDelete(USER_KEY);
}

export async function saveUser(user: ApiUser): Promise<void> {
  await secureSet(USER_KEY, JSON.stringify(user));
}

export async function getSavedUser(): Promise<ApiUser | null> {
  const raw = await secureGet(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ApiUser;
  } catch {
    return null;
  }
}
