import { invoke } from "@tauri-apps/api/core";

export interface TrayTaskItem {
  id: number;
  title: string;
}

export interface TrayRunning {
  title: string;
  elapsed_label: string;
}

// Push the current state into the menu bar. Cheap to call; Rust rebuilds
// the menu only when this is invoked, so we throttle from the React side.
export async function setTrayMenu(
  today: TrayTaskItem[],
  running: TrayRunning | null,
): Promise<void> {
  try {
    await invoke("set_tray_menu", { today, running });
  } catch (e) {
    console.warn("set_tray_menu failed", e);
  }
}
