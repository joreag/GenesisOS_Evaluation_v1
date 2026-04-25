use tiny_http::{Server, Response};
use std::thread;
// use tauri::Manager; // For Tauri v1
use tauri::Emitter; // For Tauri v2

pub fn start_listener(app_handle: tauri::AppHandle) {
    thread::spawn(move || {
        // Listen on port 8080 for incoming Scout pings
        match Server::http("0.0.0.0:8080") {
            Ok(server) => {
                println!("[KERNEL] Scout Listener Active on :8080");

                for mut request in server.incoming_requests() {
                    let mut content = String::new();
                    request.as_reader().read_to_string(&mut content).unwrap_or_default();

                    // Emit event to React UI
                    // Note: use app_handle.emit_all() if you are on Tauri v1
                    let _ = app_handle.emit("scout-data", content);

                    let response = Response::from_string("ACK");
                    let _ = request.respond(response);
                }
            },
            Err(e) => println!("[KERNEL] Failed to start Scout Listener: {}", e),
        }
    });
}