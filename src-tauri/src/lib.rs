#[cfg_attr(mobile, tauri::mobile_entry_point)]
use std::collections::HashMap;
use std::io::{BufReader, Read, Write};
use std::sync::Mutex;
use portable_pty::{native_pty_system, PtySize, CommandBuilder, MasterPty, Child};
use tauri::{command, AppHandle, Emitter, State};

struct PtyHandle {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    child: Box<dyn Child + Send + Sync>,
}

struct PtyState {
    handles: Mutex<HashMap<String, PtyHandle>>,
}

#[command]
fn spawn_terminal(
    app: AppHandle,
    state: State<'_, PtyState>,
    tab_id: String,
    cwd: String,
    rows: u16,
    cols: u16,
    shell: Option<String>,
) -> Result<(), String> {
    // Kill this tab's old process before spawning a new one
    kill_inner(&state, &tab_id);

    let pty_system = native_pty_system();
    let pty_pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let shell_path = shell.unwrap_or_else(|| {
        #[cfg(target_os = "windows")]
        { "cmd.exe".into() }
        #[cfg(not(target_os = "windows"))]
        { "/bin/bash".into() }
    });

    let mut cmd = CommandBuilder::new(&shell_path);
    cmd.cwd(cwd);
    #[cfg(target_os = "windows")]
    {
        let lower = shell_path.to_lowercase();
        if lower.ends_with("cmd.exe") {
            cmd.arg("/K");
        } else if lower.ends_with("powershell.exe") || lower.ends_with("pwsh.exe") {
            cmd.arg("-NoExit");
        }
    }

    let mut child = pty_pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| e.to_string())?;
    let reader = BufReader::new(
        pty_pair
            .master
            .try_clone_reader()
            .map_err(|e| e.to_string())?,
    );
    let writer = pty_pair
        .master
        .take_writer()
        .map_err(|e| e.to_string())?;
    let master = pty_pair.master;

    state.handles.lock().unwrap().insert(
        tab_id.clone(),
        PtyHandle { writer: Box::new(writer), master, child: Box::new(child) },
    );

    // Spawn reader thread using byte buffer
    let app_handle = app.clone();
    let tid = tab_id.clone();
    std::thread::spawn(move || {
        let mut r = reader;
        let mut buf = [0u8; 4096];
        loop {
            match r.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                    let payload = serde_json::json!({"tab_id": tid, "data": chunk});
                    let _ = app_handle.emit("pty-output", &payload.to_string());
                }
                Err(_) => break,
            }
        }
        // Wait for child
        {
            let mut guard = state.handles.lock().unwrap();
            if let Some(h) = guard.get_mut(&tid) {
                let _ = h.child.wait();
            }
            guard.remove(&tid);
        }
        let exit_payload = serde_json::json!({"tab_id": tid});
        let _ = app_handle.emit("pty-exit", &exit_payload.to_string());
    });

    Ok(())
}

fn kill_inner(state: &PtyState, tab_id: &str) {
    let mut guard = state.handles.lock().unwrap();
    if let Some(mut h) = guard.remove(tab_id) {
        let _ = h.child.kill();
        drop(h);
    }
}

#[command]
fn kill_terminal(state: State<'_, PtyState>, tab_id: String) -> Result<(), String> {
    kill_inner(&state, &tab_id);
    Ok(())
}

#[command]
fn send_to_terminal(state: State<'_, PtyState>, tab_id: String, data: String) -> Result<(), String> {
    let mut guard = state.handles.lock().unwrap();
    if let Some(h) = guard.get_mut(&tab_id) {
        h.writer
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
        h.writer.flush().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[command]
fn resize_pty(state: State<'_, PtyState>, tab_id: String, rows: u16, cols: u16) -> Result<(), String> {
    let mut guard = state.handles.lock().unwrap();
    if let Some(h) = guard.get_mut(&tab_id) {
        h.master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .manage(PtyState {
            handles: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            spawn_terminal,
            kill_terminal,
            send_to_terminal,
            resize_pty
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
