/// <reference types="vite/client" />

interface ElectronAPI {
  platform: string;
  appVersion: string;
  updateDiscordPresence: (page: string) => void;
}

interface Window {
  electronAPI?: ElectronAPI;
}
