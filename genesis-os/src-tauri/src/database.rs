use rusqlite::{Connection, Result};
use tauri::Manager;
use crate::mict_memory::ElasticMemory;
use crate::mdo_runtime::RuntimeVal;


// This helper function just returns the string path to the database file.
pub fn get_db_path(app_handle: &tauri::AppHandle) -> std::path::PathBuf {
    let app_dir = app_handle.path().app_data_dir().unwrap();
    if !app_dir.exists() {
        std::fs::create_dir_all(&app_dir).unwrap();
    }
    app_dir.join("genesis.db")
}

// Establish Connection & Create Tables
pub fn initialize_database(app_handle: &tauri::AppHandle) -> Connection {
    let db_path = get_db_path(app_handle); // Use the helper
    let conn = Connection::open(&db_path).unwrap();

    // Enable Foreign Keys
    conn.execute("PRAGMA foreign_keys = ON;", []).unwrap();

    // --- 1. CORE (Users) ---
    conn.execute(
        "CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            remote_id INTEGER,
            name TEXT,
            email TEXT,
            role TEXT,
            discipline TEXT,
            synced INTEGER DEFAULT 0
        )",
        [],
    ).unwrap();

    // --- 2. ERP (Projects & Tasks) ---
    conn.execute(
        "CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            remote_id INTEGER,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'active',
            category TEXT DEFAULT 'standard',
            budget REAL DEFAULT 0.0,
            owner_id INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            synced INTEGER DEFAULT 0
        )",
        [],
    ).unwrap();

    conn.execute(
        "CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            remote_id INTEGER,
            project_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'todo',
            priority TEXT DEFAULT 'medium',
            estimated_hours REAL DEFAULT 0.0,
            task_type TEXT DEFAULT 'generic',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            synced INTEGER DEFAULT 0,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )",
        [],
    ).unwrap();

    // --- 3. THE LAB (Research) ---
    conn.execute(
        "CREATE TABLE IF NOT EXISTS studies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            remote_id INTEGER,
            title TEXT NOT NULL,
            hypothesis TEXT,
            stage TEXT DEFAULT 'MAP',
            status TEXT DEFAULT 'active',
            conclusion TEXT,
            origin_source TEXT DEFAULT 'manual',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            synced INTEGER DEFAULT 0
        )",
        [],
    ).unwrap();

    conn.execute(
        "CREATE TABLE IF NOT EXISTS study_artifacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            remote_id INTEGER,
            study_id INTEGER NOT NULL,
            file_path TEXT,
            description TEXT,
            type TEXT,
            uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
            synced INTEGER DEFAULT 0,
            FOREIGN KEY(study_id) REFERENCES studies(id) ON DELETE CASCADE
        )",
        [],
    ).unwrap();

    // --- 4. LOGOS (Supply Chain) ---
    conn.execute(
        "CREATE TABLE IF NOT EXISTS vendors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            remote_id INTEGER,
            name TEXT NOT NULL,
            website TEXT,
            status TEXT DEFAULT 'active',
            synced INTEGER DEFAULT 0
        )",
        [],
    ).unwrap();

    conn.execute(
        "CREATE TABLE IF NOT EXISTS inventory_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            remote_id INTEGER,
            name TEXT NOT NULL,
            sku TEXT,
            category TEXT DEFAULT 'component',
            quantity INTEGER DEFAULT 0,
            location TEXT,
            cost_per_unit REAL DEFAULT 0.00,
            default_vendor_id INTEGER,
            synced INTEGER DEFAULT 0,
            FOREIGN KEY(default_vendor_id) REFERENCES vendors(id) ON DELETE SET NULL
        )",
        [],
    ).unwrap();

    // --- 5. THE DOJO (AI Memory) ---
    conn.execute(
        "CREATE TABLE IF NOT EXISTS training_memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            remote_id INTEGER,
            model_name TEXT DEFAULT 'Apprentice',
            input_prompt TEXT,
            ai_response TEXT,
            user_correction TEXT,
            quality_score INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            synced INTEGER DEFAULT 0
        )",
        [],
    ).unwrap();

    conn.execute(
        "CREATE TABLE IF NOT EXISTS world_state (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    ).unwrap();
    // --------------

    conn
}
// --- kMICT PERSISTENCE FUNCTIONS ---

// 1. Snapshot the ElasticMemory to Disk
pub fn save_memory(conn: &mut Connection, memory: &ElasticMemory) -> Result<()> {
    // Use a transaction for atomic writes
    let tx = conn.transaction()?;
    {
        // We use INSERT OR REPLACE to update existing keys or create new ones
        let mut stmt = tx.prepare("INSERT OR REPLACE INTO world_state (key, value) VALUES (?1, ?2)")?;
        
        for (k, v) in memory.iter() {
            // Convert our Rust enum into a JSON string for storage
            let val_json = serde_json::to_string(&v).unwrap();
            stmt.execute([&k, &val_json])?;
        }
    }
    tx.commit()
}

// 2. Hydrate ElasticMemory from Disk on Boot
pub fn load_memory(conn: &Connection, memory: &mut ElasticMemory) -> Result<()> {
    let mut stmt = conn.prepare("SELECT key, value FROM world_state")?;
    
    let rows = stmt.query_map([], |row| {
        let k: String = row.get(0)?;
        let v_str: String = row.get(1)?;
        Ok((k, v_str))
    })?;

    for row in rows {
        if let Ok((k, v_str)) = row {
            // Parse the JSON string back into our RuntimeVal enum
            if let Ok(val) = serde_json::from_str::<RuntimeVal>(&v_str) {
                let _ = memory.insert(k, val);
            }
        }
    }
    Ok(())
}

// 3. Wipe the kMICT world_state table
pub fn wipe_kmict_db(conn: &Connection) -> Result<()> {
    conn.execute("DELETE FROM world_state", [])?;
    Ok(())
}
