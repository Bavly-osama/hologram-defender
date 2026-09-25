export type ControlMode = "mouse" | "hand";
export interface Settings {
  sound: boolean;
  mode: ControlMode;
  quality: "auto" | "low" | "high";
  tutorial: boolean;
}
export function readLocal<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? "null") as T) ?? fallback;
  } catch {
    return fallback;
  }
}
export function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage can be unavailable in private browsing. */
  }
}
export const settings: Settings = {
  sound: true,
  mode: "mouse",
  quality: "auto",
  tutorial: false,
  ...readLocal<Partial<Settings>>("hd.settings", {}),
};
export const saveSettings = () => writeLocal("hd.settings", settings);
