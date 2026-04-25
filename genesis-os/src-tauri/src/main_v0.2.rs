#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// --- EXISTING MODULES ---
mod database; 
mod research_elastic;
mod server;

// --- NEW kMICT KERNEL MODULES ---
mod mdo_types;
mod mdo_runtime;
mod mict_memory;

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
use std::collections::HashMap;
use crate::mdo_types::TransformStatement;

// --- kMICT IMPORTS ---
use std::sync::mpsc::{channel, Sender, Receiver};
use mdo_types::{MdoObject as Mdo}; // Renamed to avoid confusion with your structs
use mdo_runtime::{MdoRuntime, RuntimeVal};
use mict_memory::ElasticMemory;

// --- kMICT KERNEL STRUCTS ---
#[derive(Debug, Clone)]
pub struct MdoMessage {
    pub source_id: String,
    pub target_id: String,
    pub action: String,
    pub payload: HashMap<String, RuntimeVal>,
}

pub struct KmictKernel {
    message_tx: Sender<MdoMessage>,
    message_rx: Receiver<MdoMessage>,
    mdo_inventory: HashMap<String, Mdo>,
    world_state: ElasticMemory, 
    db_conn: rusqlite::Connection,
}

impl KmictKernel {
    pub fn new(db_conn: rusqlite::Connection) -> Self { // ACCEPTS A CONNECTION
        let (tx, rx) = channel();
        let mut world_state = ElasticMemory::new();
        // Load memory using the provided connection
        if let Err(e) = database::load_memory(&db_conn, &mut world_state) {
             println!("[kMICT] No previous state to load from DB: {}", e);
        }

        KmictKernel {
            message_tx: tx,
            message_rx: rx,
            mdo_inventory: HashMap::new(), 
            world_state,
            db_conn, 
        }
    }
    pub fn load_mdo(&mut self, filepath: &str) -> Result<String, String> {
        let json_str = std::fs::read_to_string(filepath).map_err(|e| e.to_string())?;
        let mdo_map: HashMap<String, Mdo> = serde_json::from_str(&json_str).map_err(|e| e.to_string())?;
        
        let mut loaded_names = Vec::new();
        for (name, mdo) in mdo_map {
            loaded_names.push(format!("{} ({})", name, mdo.id));
            self.mdo_inventory.insert(mdo.id.clone(), mdo);
        }
        Ok(format!("Loaded: {}", loaded_names.join(", ")))
    }

    pub fn pump_message_bus(&mut self) -> Vec<String> {
        let mut log = Vec::new();
        let mut cycle_count = 0;
        
        while let Ok(msg) = self.message_rx.try_recv() {
            cycle_count += 1;
            log.push(format!("\n[BUS] Routing: '{}' -> '{}' [{}]", msg.source_id, msg.target_id, msg.action));
            
            if msg.target_id.starts_with("HW_INT_") {
                log.push(format!("[HW INTERRUPT] {:?}", msg.target_id));
                continue;
            }

            if let Some(target_mdo) = self.mdo_inventory.get(&msg.target_id).cloned() {
                let mut runtime = MdoRuntime::new();
                let mut inputs = msg.payload.clone();
                inputs.insert("requestor_id".to_string(), RuntimeVal::String(msg.source_id.clone()));
                inputs.insert("action".to_string(), RuntimeVal::String(msg.action.clone()));
                
                for var_name in target_mdo.map_block.variables.keys() {
                    if !inputs.contains_key(var_name) {
                        if let Some(val) = self.world_state.get(var_name) {
                            inputs.insert(var_name.clone(), val.clone());
                        }
                    }
                }
                
                match runtime.run_mict_cycle(&target_mdo, inputs) {
                    Ok(emissions) => {
                        log.push("  [KERNEL] SECURED. Applying Transforms:".to_string());
                        
                        for transform in emissions {
                            match transform {
                                TransformStatement::Emit { payload, .. } => {
                                    let mut state_updates = HashMap::new();
                                    let mut ipc_directives = HashMap::new();

                                    // Sort emissions into State vs IPC Directives AND CATCH ERRORS
                                    for (key, val_node) in payload {
                                        match runtime.evaluate(&val_node) {
                                            Ok(val) => {
                                                if key.starts_with('_') {
                                                    ipc_directives.insert(key, val);
                                                } else {
                                                    state_updates.insert(key, val);
                                                }
                                            }
                                            Err(e) => {
                                                log.push(format!("    [EMIT ERROR] Failed to evaluate '{}': {}", key, e));
                                            }
                                        }
                                    }

                                    // 1. Commit State Mutations
                                    for (k, v) in state_updates {
                                        log.push(format!("    [STATE MUTATION] {} = {:?}", k, v));
                                        // CHANGED: Handle the Elastic Memory insertion Result
                                        if let Err(e) = self.world_state.insert(k, v) {
                                            log.push(format!("    [KERNEL PANIC] Memory Write Failed: {}", e));
                                        }
                                    }

                                    // 2. Dispatch IPC Messages
                                    if !ipc_directives.is_empty() {
                                        let target = if let Some(RuntimeVal::String(t)) = ipc_directives.get("_target_mdo") {
                                            t.clone()
                                        } else if let Some(RuntimeVal::String(hw)) = ipc_directives.get("_target_hardware_interrupt") {
                                            format!("HW_INT_{}", hw)
                                        } else {
                                            "SYS_DEV_NULL".to_string()
                                        };

                                        let action = if let Some(RuntimeVal::String(c)) = ipc_directives.get("_command") {
                                            c.clone()
                                        } else {
                                            "SYS_EVENT".to_string()
                                        };

                                        let mut ipc_payload = HashMap::new();
                                        for (k, v) in ipc_directives {
                                            if k != "_target_mdo" && k != "_target_hardware_interrupt" && k != "_command" {
                                                ipc_payload.insert(k.trim_start_matches('_').to_string(), v);
                                            }
                                        }

                                        let ipc_msg = MdoMessage {
                                            source_id: msg.target_id.clone(),
                                            target_id: target.clone(),
                                            action: action.clone(),
                                            payload: ipc_payload,
                                        };
                                        
                                        log.push(format!("    [IPC DISPATCH] Queuing message for '{}'", target));
                                        self.message_tx.send(ipc_msg).unwrap();
                                    }
                                }
                                TransformStatement::EmitToRequestor { payload, .. } => {
                                    log.push(format!("    [IPC RESPONSE] -> {}", msg.source_id));
                                    for (key, val_node) in payload {
                                        match runtime.evaluate(&val_node) {
                                            Ok(val) => { log.push(format!("       {}: {:?}", key, val)); }
                                            Err(e) => { log.push(format!("       [ERROR] {}: {}", key, e)); }
                                        }
                                    }
                                }
                                _ => {}
                            }
                        }
                    },
                    Err(dissonance) => {
                        log.push(format!("  [KERNEL] 🛑 HALTED. {}", dissonance));
                    }
                }
            } else {
                log.push(format!("  [KERNEL] ERROR: MDO '{}' not found.", msg.target_id));
            }
        }
        
        if cycle_count > 0 {
            log.push("\n[KERNEL] Message Bus drained. System Idle.".to_string());
            if let Err(e) = database::save_memory(&mut self.db_conn, &self.world_state) {
                log.push(format!("[DB ERROR] Failed to persist state: {}", e));
            } else {
                log.push("[DB] Elastic Memory safely persisted.".to_string());
            }
        }
        log
    }
}

// --- STATE MANAGEMENT (UNIFIED) ---
pub struct AppState {
    pub db: Mutex<Connection>,      // Legacy DB connection
    pub kmict: Mutex<KmictKernel>, // The new kMICT Engine
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

// --- NEW: kMICT COMMANDS (THE SUCCESSOR API) ---
#[tauri::command]
fn boot_kmict(_state: State<AppState>) -> String {
    "kMICT Engine Online. Memory Hydrated.".to_string()
}

#[tauri::command]
fn wipe_kmict_memory(_state: State<AppState>) -> String {
    let mut k = _state.kmict.lock().unwrap();
    k.world_state.clear(); 
    // CHANGE THIS to call the unified function
    let _ = database::wipe_kmict_db(&k.db_conn);
    "kMICT Memory wiped. Database cleared.".to_string()
}

#[tauri::command]
fn cmd_load_mdo(state: State<AppState>, filepath: String) -> Result<String, String> {
    state.kmict.lock().unwrap().load_mdo(&filepath)
}

#[tauri::command]
fn cmd_set_state(state: State<AppState>, key: String, val_type: String, val_str: String) -> String {
    let mut k = state.kmict.lock().unwrap();
    let r_val = match val_type.as_str() {
        "Int" => RuntimeVal::Int(val_str.parse().unwrap_or(0)),
        "Float" => RuntimeVal::Float(val_str.parse().unwrap_or(0.0)),
        "String" => RuntimeVal::String(val_str.clone()),
        _ => RuntimeVal::Null,
    };
    // CHANGED
    if let Err(e) = k.world_state.insert(key.clone(), r_val) {
        return format!("Memory Error: {}", e);
    }
    format!("Set {} = {}", key, val_str)
}

#[tauri::command]
fn cmd_exec_mdo(state: State<AppState>, mdo_id: String, action: String) -> Vec<String> {
    let mut k = state.kmict.lock().unwrap();
    let msg = MdoMessage {
        source_id: "React_UI".to_string(),
        target_id: mdo_id,
        action,
        payload: HashMap::new(),
    };
    k.message_tx.send(msg).unwrap();
    k.pump_message_bus()
}

#[tauri::command]
fn get_kmict_world_state(state: State<AppState>) -> HashMap<String, String> {
    let k = state.kmict.lock().unwrap();
    let mut clean_state = HashMap::new();
    for (key, val) in k.world_state.iter() {
        clean_state.insert(key, format!("{:?}", val));
    }
    clean_state
}
#[tauri::command]
fn cmd_write_to_file(state: State<AppState>, file_id: String, data: String) -> Vec<String> {
    let mut k = state.kmict.lock().unwrap();
    let mut payload = HashMap::new();
    payload.insert("input_data".to_string(), RuntimeVal::String(data));
    payload.insert("input_offset".to_string(), RuntimeVal::Int(0));
    payload.insert("input_read_length".to_string(), RuntimeVal::Int(0));
    let msg = MdoMessage {
        source_id: "React_UI".to_string(),
        target_id: file_id,
        action: "APPEND".to_string(),
        payload,
    };
    k.message_tx.send(msg).unwrap();
    k.pump_message_bus()
}

#[tauri::command]
fn cmd_read_from_file(state: State<AppState>, file_id: String, length: i64) -> Vec<String> {
    let mut k = state.kmict.lock().unwrap();
    let mut payload = HashMap::new();
    payload.insert("input_read_length".to_string(), RuntimeVal::Int(length));
    payload.insert("input_data".to_string(), RuntimeVal::String("".to_string()));
    payload.insert("input_offset".to_string(), RuntimeVal::Int(0));
    let msg = MdoMessage {
        source_id: "React_UI".to_string(),
        target_id: file_id,
        action: "READ".to_string(),
        payload,
    };
    k.message_tx.send(msg).unwrap();
    k.pump_message_bus()
}


// --- MAIN (THE HEART TRANSPLANT) ---
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // 1. Create the single master connection and initialize ALL tables
            let _main_db_conn = database::initialize_database(app.handle());

            // 2. We can't move main_db_conn, so we re-open handles to the same file path
            //    This is safe because SQLite handles file-level locking.
            let legacy_conn = Connection::open(database::get_db_path(app.handle())).expect("Failed to open legacy DB handle.");
            let kmict_conn = Connection::open(database::get_db_path(app.handle())).expect("Failed to open kMICT DB handle.");
            
            // 3. Init and Inject the UNIFIED AppState
            app.manage(AppState { 
                db: Mutex::new(legacy_conn),
                kmict: Mutex::new(KmictKernel::new(kmict_conn)),
            });
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
            // Your Existing Commands
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
            spawn_easy_bake,

            // The New kMICT Kernel API
            boot_kmict,
            wipe_kmict_memory,
            cmd_load_mdo,
            cmd_exec_mdo,
            get_kmict_world_state,
            cmd_set_state,
            cmd_write_to_file,
            cmd_read_from_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
