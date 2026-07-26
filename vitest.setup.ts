// The store uses zustand/persist with localStorage; under the node environment
// we provide an in-memory implementation to avoid warnings and to allow testing
// persistence. Under happy-dom the native localStorage already exists.
if (typeof globalThis.localStorage === "undefined") {
  const memory = new Map<string, string>()

  globalThis.localStorage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, String(value))
    },
    removeItem: (key: string) => {
      memory.delete(key)
    },
    clear: () => memory.clear(),
    key: (index: number) => [...memory.keys()][index] ?? null,
    get length() {
      return memory.size
    },
  } as Storage
}
