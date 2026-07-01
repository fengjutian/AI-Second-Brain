#[cfg_attr(mobile, tauri::mobile_entry_point)]
use std::io::{BufRead, BufReader, Write};
use std::sync::Mutex;
use portable_pty::{native_pty_system, PtySize, CommandBuilder};
use tauri::{command, AppHandle, Emitter, Manager, State};

struct PtyState {
    writer: Mutex<Option<Box<dyn Write + Send>>>,
}

#[command]
fn spawn_terminal(app: AppHandle, state: State<'_, PtyState>, cwd: String, rows: u16, cols: u16) -> Result<(), String> {
    let pty_system = native_pty_system();
    let pty_pair = pty_system.openpty(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    let shell = "cmd.exe";
    #[cfg(not(target_os = "windows"))]
    let shell = "/bin/bash";

    let mut cmd = CommandBuilder::new(shell);
    cmd.cwd(cwd);
    #[cfg(target_os = "windows")]
    cmd.arg("/K"); // keep cmd open after commands

    let mut child = pty_pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    let mut reader = BufReader::new(pty_pair.master.try_clone_reader().map_err(|e| e.to_string())?);
    let writer = pty_pair.master.take_writer().map_err(|e| e.to_string())?;

    // Store writer for later input
    *state.writer.lock().unwrap() = Some(Box::new(writer));

    // Read PTY output in a separate thread
    let app_handle = app.clone();
    std::thread::spawn(move || {
        let mut line = String::new();
        loop {
            line.clear();
            match reader.read_line(&mut line) {
                Ok(0) => break, // EOF
                Ok(_) => {
                    let _ = app_handle.emit("pty-output", &line);
                }
                Err(_) => break,
            }
        }
        // Wait for child to exit
        let _ = child.wait();
        let _ = app_handle.emit("pty-exit", ());
    });

    Ok(())
}

#[command]
fn send_to_terminal(state: State<'_, PtyState>, data: String) -> Result<(), String> {
    if let Some(writer) = state.writer.lock().unwrap().as_mut() {
        writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[command]
fn resize_pty(state: State<'_, PtyState>, rows: u16, cols: u16) -> Result<(), String> {
    if let Some(writer) = state.writer.lock().unwrap().as_ref() {
        // portable-pty resize via writer
        writer.resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .manage(PtyState { writer: Mutex::new(None) })
        .invoke_handler(tauri::generate_handler![spawn_terminal, send_to_terminal, resize_pty])
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
