import AsyncStorage from "@react-native-async-storage/async-storage";

const CLIENT_ID_KEY = "fresh-keeper-classification-client-id-v1";
let clientIdPromise = null;

export async function getClientId() {
  if (!clientIdPromise) {
    clientIdPromise = AsyncStorage.getItem(CLIENT_ID_KEY).then(async (stored) => {
      if (/^[A-Za-z0-9:_-]{12,100}$/.test(stored || "")) return stored;
      const next = `device_${Date.now().toString(36)}_${randomIdPart()}${randomIdPart()}`;
      await AsyncStorage.setItem(CLIENT_ID_KEY, next);
      return next;
    });
  }
  return clientIdPromise;
}

function randomIdPart() {
  return Math.random().toString(36).slice(2, 10);
}
