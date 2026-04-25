import sqlite3
import json
import os

# Ensure this is your correct path
DB_PATH = os.path.expanduser("~/.local/share/com.johnboy.genesis-os/genesis.db")
OUTPUT_DIR = "knowledge_base_raw/"

def export_knowledge_base():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    print(f"Connecting to GenesisOS database: {DB_PATH}")
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # --- THE FIX: Look for the '_content' suffix ---
        # We want keys like 'kb_app_logic.cpp.json_content'
        cursor.execute("SELECT key, value FROM world_state WHERE key LIKE 'kb_%.json_content'")
        rows = cursor.fetchall()
        
        count = 0
        for db_key, value_json_string in rows:
            try:
                # 1. Parse the outer Rust RuntimeVal wrapper
                rust_val = json.loads(value_json_string)
                
                if "String" in rust_val:
                    # 2. Extract the actual inner JSON string we saved from React
                    inner_json_string = rust_val["String"]
                    
                    # 3. Parse the inner JSON to ensure it's valid
                    kb_data = json.loads(inner_json_string)
                    
                    # --- THE FIX: Clean the filename ---
                    # Remove the '_content' suffix to get the original filename
                    # e.g., 'kb_app_logic.cpp.json_content' -> 'kb_app_logic.cpp.json'
                    clean_filename = db_key.replace("_content", "")
                    
                    # 4. Save to physical file
                    output_file = os.path.join(OUTPUT_DIR, clean_filename)
                    with open(output_file, 'w') as f:
                        json.dump(kb_data, f, indent=2)
                        
                    print(f"Exported: {clean_filename}")
                    count += 1
            except json.JSONDecodeError as e:
                print(f"JSON Parse Error on row {db_key}: {e}\nRaw Data: {value_json_string[:50]}...")
            except Exception as e:
                print(f"Error processing row {db_key}: {e}")
                
        print(f"\nSuccessfully exported {count} Knowledge Base files to '{OUTPUT_DIR}'")
        
    except sqlite3.Error as e:
        print(f"Database error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    export_knowledge_base()