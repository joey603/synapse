export function assertStorageKey(key: string) {
  if (!/^(audio|photos)\/[0-9a-f-]{36}$/i.test(key)) {
    throw new Error("storage.key_invalid");
  }
}
