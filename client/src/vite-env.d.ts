/// <reference types="vite/client" />

interface ElectronAPI {
  platform: string;
  appVersion: string;
  updateDiscordPresence: (page: string) => void;
}

interface Window {
  electronAPI?: ElectronAPI;
}

declare module '*.wasm?url' {
  const url: string;
  export default url;
}
