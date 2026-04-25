#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod database; // Import the module we just created
mod research_elastic;
mod server;

use tauri::{Manager, State};
use rusqlite::Connection;
use std::sync::Mutex;
use sysinfo::{System, SystemExt, CpuExt};
use std::thread;
use std::time::Duration;
use tauri::Emitter;
use std::fs;
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};

// --- STATE MANAGEMENT ---
// This holds the DB connection so commands can use it
pub struct AppState {
    pub db: Mutex<Connection>,
}

// --- DATA STRUCTURES (Mirroring React expectations) ---
#[derive(serde::Serialize)]
struct Project {
    id: i32,
    title: String,
    status: String,
    category: String,
    budget: f64,
    created_at: String
}

#[derive(serde::Serialize)]
struct Study {
    id: i32,
    title: String,
    stage: String,
    hypothesis: Option<String>,
    created_at: String
}

#[derive(serde::Serialize)]
struct InventoryItem {
    id: i32,
    name: String,
    quantity: i32,
    category: String,
    location: Option<String>
}

// Add Structs for Details (if not exists)
#[derive(serde::Serialize)]
struct StudyDetails {
    study: Study,
    artifacts: Vec<Artifact>
}

#[derive(serde::Serialize)]
struct Artifact {
    id: i32,
    description: String,
    file_path: String
}

// --- COMMANDS (The Local API) ---

// 1. PROJECTS
#[tauri::command]
fn get_local_projects(state: State<AppState>) -> Vec<Project> {
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, title, status, category, budget, created_at FROM projects ORDER BY id DESC").unwrap();
    let iter = stmt.query_map([], |row| {
        Ok(Project {
            id: row.get(0)?,
            title: row.get(1)?,
            status: row.get(2)?,
            category: row.get(3)?,
            budget: row.get(4)?,
            created_at: row.get(5)?,
        })
    }).unwrap();
    iter.map(|p| p.unwrap()).collect()
}

#[tauri::command]
fn create_local_project(state: State<AppState>, title: String, description: String, category: String, budget: f64) -> i64 {
    let conn = state.db.lock().unwrap();
    conn.execute(
        "INSERT INTO projects (title, description, category, budget) VALUES (?1, ?2, ?3, ?4)",
        [&title, &description, &category, &budget.to_string()],
    ).unwrap();
    conn.last_insert_rowid()
}

// 2. RESEARCH LAB
#[tauri::command]
fn get_local_studies(state: State<AppState>) -> Vec<Study> {
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, title, stage, hypothesis, created_at FROM studies ORDER BY id DESC").unwrap();
    let iter = stmt.query_map([], |row| {
        Ok(Study {
            id: row.get(0)?,
            title: row.get(1)?,
            stage: row.get(2)?,
            hypothesis: row.get(3).ok(),
            created_at: row.get(4)?
        })
    }).unwrap();
    iter.map(|s| s.unwrap()).collect()
}

#[tauri::command]
fn create_local_study(state: State<AppState>, title: String, hypothesis: String) -> i64 {
    let conn = state.db.lock().unwrap();
    conn.execute(
        "INSERT INTO studies (title, hypothesis, stage) VALUES (?1, ?2, 'MAP')",
        [&title, &hypothesis],
    ).unwrap();
    conn.last_insert_rowid()
}

#[tauri::command]
fn update_study_stage(state: State<AppState>, id: i32, stage: String) {
    let conn = state.db.lock().unwrap();
    conn.execute("UPDATE studies SET stage = ?1 WHERE id = ?2", [&stage, &id.to_string()]).unwrap();
}

// 3. LOGOS (Inventory)
#[tauri::command]
fn get_local_inventory(state: State<AppState>) -> Vec<InventoryItem> {
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, name, quantity, category, location FROM inventory_items ORDER BY name").unwrap();
    let iter = stmt.query_map([], |row| {
        Ok(InventoryItem {
            id: row.get(0)?,
            name: row.get(1)?,
            quantity: row.get(2)?,
            category: row.get(3)?,
            location: row.get(4).ok()
        })
    }).unwrap();
    iter.map(|i| i.unwrap()).collect()
}

// 4. Elastic Hashtable Research
#[tauri::command]
async fn run_elastic_simulation() -> String {
    // Run in a blocking thread so we don't freeze the UI while calculating
    let res = std::thread::spawn(move || {
        research_elastic::run_benchmark()
    }).join().unwrap();
    res
}

#[tauri::command]
fn get_local_study_details(db: State<AppState>, id: i32) -> StudyDetails {
    let conn = db.db.lock().unwrap();
    
    // 1. Get Study
    let mut stmt = conn.prepare("SELECT id, title, stage, hypothesis, created_at FROM studies WHERE id = ?1").unwrap();
    let study = stmt.query_row([id], |row| {
        Ok(Study {
            id: row.get(0)?,
            title: row.get(1)?,
            stage: row.get(2)?,
            hypothesis: row.get(3).ok(),
            created_at: row.get(4)?
        })
    }).unwrap();

    // 2. Get Artifacts
    let mut stmt_art = conn.prepare("SELECT id, description, file_path FROM study_artifacts WHERE study_id = ?1").unwrap();
    let artifacts = stmt_art.query_map([id], |row| {
        Ok(Artifact {
            id: row.get(0)?,
            description: row.get(1)?,
            file_path: row.get(2)?
        })
    }).unwrap().map(|r| r.unwrap()).collect();

    StudyDetails { study, artifacts }
}

// --- SYSTEM MONITOR (Existing) ---
#[derive(Clone, serde::Serialize)]
struct SystemStats {
    cpu: f32,
    memory_used: u64,
    memory_total: u64,
    hive_status: String
}

#[tauri::command]
fn read_local_file(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_local_file(path: String, content: String) -> Result<(), String> {
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
async fn execute_bash_command(cmd: String) -> Result<String, String> {
    println!("[KERNEL] Received Bash Command: '{}'", cmd);

    // 2. Execute
    let output_result = Command::new("bash")
        .arg("-c")
        .arg(&cmd)
        .output();

    // 3. Process Result
    match output_result {
        Ok(output) => {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                println!("[KERNEL] Success Output:\n{}", stdout);
                Ok(stdout)
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                println!("[KERNEL] Error Output:\n{}", stderr);
                Err(stderr)
            }
        }
        Err(e) => {
            let fatal_err = format!("Failed to spawn bash process: {}", e);
            println!("[KERNEL] FATAL: {}", fatal_err);
            Err(fatal_err)
        }
    }
}
// Define the incoming config from React
#[derive(serde::Deserialize)]
struct ForgeConfig {
    arch_type: String,
    curriculum_dir: String,
    output_name: String,
    epochs: i32,
    batch_size: i32,
    learning_rate: f64,
    max_seq_length: i32,
    d_model: i32,
    nhead: i32,
}

#[tauri::command]
async fn spawn_easy_bake(app_handle: tauri::AppHandle, config: ForgeConfig, forge_path: String) -> Result<(), String> {
    
// 1. Construct the paths
    let script_path = format!("{}/pipelines/trainer_hcts_v4.py", forge_path);
    
    // THE FIX: Point directly to the venv python binary
    // Assuming your venv is named 'venv' inside the forge directory
    let python_bin = format!("{}/venv/bin/python3", forge_path); 

    println!("[FORGE] Initiating Build: {}", script_path);
    println!("[FORGE] Using Python: {}", python_bin);


    let mut child = match Command::new(&python_bin)
        .arg(&script_path)
        .arg("--dataset").arg(&config.curriculum_dir) // Adjust arg mapping as needed
        .arg("--output-name").arg(format!("{}/data/models/{}.pth", forge_path, config.output_name))
        .arg("--epochs").arg(config.epochs.to_string())
        .arg("--lr").arg(config.learning_rate.to_string())
        .arg("--batch-size").arg(config.batch_size.to_string())
        .arg("--model-config").arg(&config.arch_type)
        // Add other args like d_model here if your script accepts overrides
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .current_dir(&forge_path) // Execute INSIDE the forge directory
        .spawn()
    {
        Ok(c) => c,
        Err(e) => return Err(format!("Failed to start python: {}", e)),
    };

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    // 2. Stream STDOUT in a separate thread so we don't block
    let app_handle_out = app_handle.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(l) = line {
                println!("[FORGE OUT] {}", l);
                // Emit raw log line to React
                let _ = app_handle_out.emit("forge-log", l.clone());
                
                // --- PARSE TELEMETRY ---
                // Example: "Epoch [1/10]:   0%| | 0/1 [00:01<?, ?it/s, Loss=0.0209]"
                if l.contains("Loss=") {
                    // Quick and dirty extraction
                    if let Some(loss_str) = l.split("Loss=").nth(1) {
                        let clean_loss = loss_str.replace("]", "").trim().to_string();
                        let _ = app_handle_out.emit("forge-telemetry-loss", clean_loss);
                    }
                }
            }
        }
    });

    // 3. Stream STDERR
    let app_handle_err = app_handle.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(l) = line {
                let _ = app_handle_err.emit("forge-log", format!("ERROR: {}", l));
            }
        }
    });

    // Wait for process to finish
    // We do this in a thread so the command returns immediately and React doesn't hang
    thread::spawn(move || {
        let status = child.wait().unwrap();
        let _ = app_handle.emit("forge-status", if status.success() { "COMPLETE" } else { "FAILED" });
    });

    Ok(())
}

// --- MAIN ---
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // 1. Init Database
            let conn = database::initialize_database(app.handle());
            
            // 2. Inject DB Connection into Global State
            app.manage(AppState { db: Mutex::new(conn) });

            // 3. Start System Monitor Thread
            let handle = app.handle().clone(); // Make sure .clone() works for your tauri version
            thread::spawn(move || {
                let mut sys = System::new_all();
                loop {
                    sys.refresh_cpu();
                    sys.refresh_memory();
                    
                    // Simple Hive check (You can add the reqwest logic back here)
                    let hive_stat = "CHECKING".to_string(); 
                    
                    let stats = SystemStats {
                        cpu: sys.global_cpu_info().cpu_usage(),
                        memory_used: sys.used_memory(),
                        memory_total: sys.total_memory(),
                        hive_status: hive_stat,
                    };
                    
                    let _ = handle.emit("system-tick", stats); // Change to .emit() for v2
                    thread::sleep(Duration::from_millis(1000));
                }
            });
            server::start_listener(app.handle().clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_local_projects,
            create_local_project,
            get_local_studies,
            create_local_study,
            update_study_stage,
            get_local_inventory,
            run_elastic_simulation,
            get_local_study_details,
            read_local_file,
            write_local_file,
            execute_bash_command,
            spawn_easy_bake
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}