import type { TokenCache } from "@clerk/expo";
import * as SecureStore from "expo-secure-store";

const namespace = "wardrobe.clerk.production.v1.";
const clientJwtKey = "__clerk_client_jwt";
const secureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

const namespacedKey = (key: string) => `${namespace}${key}`;

export const clerkTokenCache: TokenCache = {
  getToken: async (key) => {
    try {
      const token = await SecureStore.getItemAsync(namespacedKey(key), secureStoreOptions);

      if (!token && key === clientJwtKey) {
        // The development APK used Clerk's default, un-namespaced cache. Drop
        // that credential during the production migration instead of letting a
        // different Clerk instance attempt to hydrate it.
        await SecureStore.deleteItemAsync(clientJwtKey, secureStoreOptions);
      }

      return token;
    } catch {
      await SecureStore.deleteItemAsync(namespacedKey(key), secureStoreOptions);
      return null;
    }
  },
  saveToken: (key, token) => SecureStore.setItemAsync(namespacedKey(key), token, secureStoreOptions),
  clearToken: (key) => SecureStore.deleteItemAsync(namespacedKey(key), secureStoreOptions),
};

export const clearClerkBootstrapState = async () => {
  await Promise.allSettled([
    SecureStore.deleteItemAsync(namespacedKey(clientJwtKey), secureStoreOptions),
    // Older APKs used this un-namespaced key with the development Clerk
    // instance. Production must not try to hydrate that session.
    SecureStore.deleteItemAsync(clientJwtKey, secureStoreOptions),
  ]);
};
