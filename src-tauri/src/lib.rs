use serde::{Deserialize, Serialize};
use tauri::{
    include_image,
    menu::{Menu, MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, Wry,
};
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_sql::{Migration, MigrationKind};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TrayTaskItem {
    id: i64,
    title: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TrayRunning {
    title: String,
    elapsed_label: String,
}

#[tauri::command]
fn set_tray_menu(
    app: AppHandle,
    today: Vec<TrayTaskItem>,
    running: Option<TrayRunning>,
) -> Result<(), String> {
    let tray = app.tray_by_id("main").ok_or("tray not found")?;
    let menu = build_menu(&app, &today, running.as_ref()).map_err(|e| e.to_string())?;
    tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;

    let icon = if running.is_some() {
        include_image!("./icons/tray-active.png")
    } else {
        include_image!("./icons/tray.png")
    };
    let _ = tray.set_icon(Some(icon));
    Ok(())
}

fn build_menu(
    app: &AppHandle,
    today: &[TrayTaskItem],
    running: Option<&TrayRunning>,
) -> tauri::Result<Menu<Wry>> {
    let mut b = MenuBuilder::new(app);

    if let Some(r) = running {
        let label = format!("{}  —  {}", truncate(&r.title, 30), r.elapsed_label);
        b = b
            .item(
                &MenuItemBuilder::with_id("running:label", label)
                    .enabled(false)
                    .build(app)?,
            )
            .item(&MenuItemBuilder::with_id("tray:stop", "Stop").build(app)?)
            .item(&MenuItemBuilder::with_id("tray:complete", "Complete").build(app)?)
            .separator();
    }

    if !today.is_empty() {
        b = b.item(
            &MenuItemBuilder::with_id("today:label", "TODAY")
                .enabled(false)
                .build(app)?,
        );
        for task in today {
            let id = format!("tray:start:{}", task.id);
            let label = format!("  {}", truncate(&task.title, 40));
            b = b.item(&MenuItemBuilder::with_id(&id, label).build(app)?);
        }
        b = b.separator();
    }

    b = b
        .item(&MenuItemBuilder::with_id("tray:open", "Open MinimalTask").build(app)?)
        .separator()
        .item(
            &MenuItemBuilder::with_id("tray:quit", "Quit MinimalTask")
                .accelerator("CmdOrCtrl+Q")
                .build(app)?,
        );

    b.build()
}

fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        let mut out: String = s.chars().take(max).collect();
        out.push('…');
        out
    }
}

fn focus_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
    let _ = app.emit("tray:focus-add", ());
}

fn handle_menu_event(app: &AppHandle, id: &str) {
    match id {
        "tray:open" => focus_main(app),
        "tray:quit" => app.exit(0),
        "tray:stop" => {
            let _ = app.emit("tray:stop", ());
        }
        "tray:complete" => {
            let _ = app.emit("tray:complete", ());
        }
        s if s.starts_with("tray:start:") => {
            if let Some(task_id) = s.strip_prefix("tray:start:").and_then(|n| n.parse::<i64>().ok())
            {
                let _ = app.emit("tray:start", task_id);
            }
        }
        _ => {}
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "init tasks and sessions",
        sql: include_str!("../migrations/001_init.sql"),
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:minimaltask.db", migrations)
                .build(),
        )
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        focus_main(app);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![set_tray_menu])
        .setup(|app| {
            // Tray icon (template image, system inverts for dark mode)
            let tray_icon = include_image!("./icons/tray.png");
            let initial_menu = build_menu(app.handle(), &[], None)?;
            let _tray = TrayIconBuilder::with_id("main")
                .icon(tray_icon)
                .icon_as_template(true)
                .menu(&initial_menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| {
                    handle_menu_event(app, event.id().as_ref());
                })
                .build(app)?;

            // Register Cmd+Shift+Space — focuses (or restores) the main window
            use tauri_plugin_global_shortcut::GlobalShortcutExt;
            let shortcut =
                Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::Space);
            app.handle().global_shortcut().register(shortcut)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
