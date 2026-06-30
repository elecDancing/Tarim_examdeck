/// <reference types="vite/client" />

interface Window {
  examdeckFlushData?: () => Promise<unknown> | unknown;
}
