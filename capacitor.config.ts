import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tarim.examdeck",
  appName: "塔里木刷题王",
  webDir: "dist",
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false,
    captureInput: true
  }
};

export default config;
