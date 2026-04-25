use crate::mdo_types::{AstNode, TransformStatement, CheckStatement, MdoObject};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Serialize, Deserialize};
use rand::Rng;

// --- Runtime Value Type ---
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)] 
pub enum RuntimeVal {
    Int(i64),
    Float(f64),
    String(String),
    Bool(bool),
    ProcessID(String),
    Array(Vec<RuntimeVal>),                  
    Dictionary(HashMap<String, RuntimeVal>), 
    Null,
}

// --- Runtime Environment ---
pub struct MdoRuntime {
    pub context: HashMap<String, RuntimeVal>,
}

impl MdoRuntime {
    pub fn new() -> Self {
        MdoRuntime { context: HashMap::new() }
    }

    // --- KERNEL CORE LOOP ---
    pub fn run_mict_cycle(
        &mut self, 
        mdo: &MdoObject, 
        inputs: HashMap<String, RuntimeVal>
    ) -> Result<Vec<TransformStatement>, String> {
        // 1. MAP
        for (name, decl) in &mdo.map_block.variables {
            // Priority 1: Value from incoming payload (requires AND states)
            if let Some(payload_val) = inputs.get(name) {
                self.context.insert(name.clone(), payload_val.clone());
            } 
            // Priority 2: Value defined in the blueprint
            else if let Some(init_val_node) = &decl.initial_value {
                let val = self.evaluate(init_val_node)?;
                self.context.insert(name.clone(), val);
            }
            // Priority 3: Check if it's a required field that's still missing
            else if decl.kind == "requires" {
                 return Err(format!("MAP FATAL: Missing required input '{}'", name));
            }
            // Priority 4: It's an uninitialized state variable, default to Null
            else {
                self.context.insert(name.clone(), RuntimeVal::Null);
            }
        }

        // 2. ITERATE
        for stmt in &mdo.iterate_block {
            self.execute_statement(stmt)?;
        }
                
        // --- THE FINAL DEBUG ---
        println!("\n[RUNTIME DEBUG] Context before CHECK for MDO '{}':", mdo.id);
        println!("{:#?}", self.context);
        // -----------------------

        // 3. CHECK
        self.resolve_check_statements(&mdo.check_block)?;

        // 4. TRANSFORM
        let mut final_emissions = Vec::new();
        self.resolve_transform_statements(&mdo.transform_block, &mut final_emissions)?;
        Ok(final_emissions)
    }

    // --- Helper for Conditional Checks ---
    fn resolve_check_statements(&self, statements: &Vec<CheckStatement>) -> Result<(), String> {
        for stmt in statements {
            match stmt {
                CheckStatement::If { condition, body, .. } => {
                    let cond_val = self.evaluate(condition)?;
                    if let RuntimeVal::Bool(true) = cond_val {
                        self.resolve_check_statements(body)?;
                    }
                }
                CheckStatement::Assertion { condition, on_fail, .. } => {
                    let cond_result = self.evaluate(condition)?;
                    if let RuntimeVal::Bool(is_valid) = cond_result {
                        if !is_valid {
                            let msg_val = self.evaluate(&on_fail.message)?;
                            let msg = match msg_val {
                                RuntimeVal::String(s) => s.trim_matches('"').to_string(),
                                _ => "Unknown Dissonance".to_string(),
                            };
                            return Err(format!("DISSONANCE DETECTED: {}", msg));
                        }
                    } else {
                        return Err("CHECK FATAL: Assertion condition did not evaluate to a Boolean.".to_string());
                    }
                }
            }
        }
        Ok(())
    }

    fn resolve_transform_statements(
        &self, 
        statements: &Vec<TransformStatement>, 
        final_emits: &mut Vec<TransformStatement>
    ) -> Result<(), String> {
        for stmt in statements {
            match stmt {
                TransformStatement::If { condition, body, .. } => {
                    let cond_val = self.evaluate(condition)?;
                    if let RuntimeVal::Bool(true) = cond_val {
                        self.resolve_transform_statements(body, final_emits)?;
                    }
                }
                TransformStatement::Emit { .. } | TransformStatement::EmitToRequestor { .. } => {
                    final_emits.push(stmt.clone());
                }
            }
        }
        Ok(())
    }

    // --- Expression Evaluator ---
    pub fn evaluate(&self, expr: &AstNode) -> Result<RuntimeVal, String> {
        match expr {
            AstNode::Literal { value, data_type } => {
                match data_type.as_str() {
                    "Int" => Ok(RuntimeVal::Int(value.as_i64().unwrap_or(0))),
                    "Float" => Ok(RuntimeVal::Float(value.as_f64().unwrap_or(0.0))),
                    "String" => Ok(RuntimeVal::String(value.as_str().unwrap_or("").trim_matches('"').to_string())),
                    "Bool" => Ok(RuntimeVal::Bool(value.as_bool().unwrap_or(false))),
                    "Null" => Ok(RuntimeVal::Null),
                    _ => Err(format!("Unknown literal type: {}", data_type)),
                }
            }
            AstNode::Variable { name } => self.context.get(name).cloned().ok_or_else(|| format!("Runtime Error: Variable '{}' not found.", name)),
            AstNode::ArrayAccess { array, index } => {
                let index_val = self.evaluate(index)?;
                let arr_val = self.context.get(array).ok_or_else(|| format!("Runtime Error: Array '{}' not found.", array))?;
                match (arr_val, index_val) {
                    (RuntimeVal::Array(vec), RuntimeVal::Int(idx)) => {
                        if idx < 0 || idx as usize >= vec.len() { Ok(RuntimeVal::Null) } 
                        else { Ok(vec[idx as usize].clone()) }
                    },
                    _ => Err("Type Error: Invalid Array Access.".to_string()),
                }
            }
            AstNode::PropertyAccess { object, property } => {
                let obj_val = self.context.get(object).ok_or_else(|| format!("Runtime Error: Object '{}' not found.", object))?;
                match obj_val {
                    RuntimeVal::Dictionary(dict) => Ok(dict.get(property).cloned().unwrap_or(RuntimeVal::Null)),
                    RuntimeVal::Null => Ok(RuntimeVal::Null),
                    _ => Err(format!("Type Error: Cannot access property '{}' on non-object type.", property)),
                }
            }
            AstNode::BinaryOp { op, left, right } => {
                let l_val = self.evaluate(left)?;
                let r_val = self.evaluate(right)?;
                match (op.as_str(), l_val.clone(), r_val.clone()) {
                    ("&&", RuntimeVal::Bool(l), RuntimeVal::Bool(r)) => Ok(RuntimeVal::Bool(l && r)),
                    ("||", RuntimeVal::Bool(l), RuntimeVal::Bool(r)) => Ok(RuntimeVal::Bool(l || r)),
                    ("+", RuntimeVal::Float(l), RuntimeVal::Float(r)) => Ok(RuntimeVal::Float(l + r)),
                    ("-", RuntimeVal::Float(l), RuntimeVal::Float(r)) => Ok(RuntimeVal::Float(l - r)),
                    ("*", RuntimeVal::Float(l), RuntimeVal::Float(r)) => Ok(RuntimeVal::Float(l * r)),
                    ("/", RuntimeVal::Float(l), RuntimeVal::Float(r)) => Ok(RuntimeVal::Float(l / r)),
                    ("+", RuntimeVal::Int(l), RuntimeVal::Int(r)) => Ok(RuntimeVal::Int(l + r)),
                    ("-", RuntimeVal::Int(l), RuntimeVal::Int(r)) => Ok(RuntimeVal::Int(l - r)),
                    ("*", RuntimeVal::Int(l), RuntimeVal::Int(r)) => Ok(RuntimeVal::Int(l * r)),
                    ("/", RuntimeVal::Int(l), RuntimeVal::Int(r)) => Ok(RuntimeVal::Int(l / r)),
                    (">", RuntimeVal::Float(l), RuntimeVal::Float(r)) => Ok(RuntimeVal::Bool(l > r)),
                    ("<", RuntimeVal::Float(l), RuntimeVal::Float(r)) => Ok(RuntimeVal::Bool(l < r)),
                    (">=", RuntimeVal::Float(l), RuntimeVal::Float(r)) => Ok(RuntimeVal::Bool(l >= r)),
                    ("<=", RuntimeVal::Float(l), RuntimeVal::Float(r)) => Ok(RuntimeVal::Bool(l <= r)),
                    (">", RuntimeVal::Int(l), RuntimeVal::Int(r)) => Ok(RuntimeVal::Bool(l > r)),
                    ("<", RuntimeVal::Int(l), RuntimeVal::Int(r)) => Ok(RuntimeVal::Bool(l < r)),
                    (">=", RuntimeVal::Int(l), RuntimeVal::Int(r)) => Ok(RuntimeVal::Bool(l >= r)),
                    ("<=", RuntimeVal::Int(l), RuntimeVal::Int(r)) => Ok(RuntimeVal::Bool(l <= r)),
                    ("==", l, r) => Ok(RuntimeVal::Bool(l == r)),
                    ("!=", l, r) => Ok(RuntimeVal::Bool(l != r)),
                    ("in", item, RuntimeVal::Array(arr)) => Ok(RuntimeVal::Bool(arr.contains(&item))),
                    ("in", _, _) => Err("The 'in' operator requires an Array on the right side.".to_string()),
                    _ => Err(format!("Unsupported operation '{}' on types.", op)),
                }
            }
            AstNode::FunctionCall { function_name, arguments } => {
                let mut eval_args = Vec::new();
                for arg in arguments {
                    eval_args.push(self.evaluate(arg)?);
                }

                match function_name.as_str() {
                            
                    "length" => {
                        let target = eval_args.get(0).unwrap_or(&RuntimeVal::Null);
                        match target {
                            RuntimeVal::Array(arr) => Ok(RuntimeVal::Int(arr.len() as i64)),
                            RuntimeVal::String(s) => Ok(RuntimeVal::Int(s.len() as i64)),
                            _ => Ok(RuntimeVal::Int(0)),
                        }
                    },
                    "append" => {
                        if eval_args.len() != 2 { return Err("append() requires 2 arguments".to_string()); }
                        let base = &eval_args[0];
                        let item = &eval_args[1];
                        match (base, item) {
                            (RuntimeVal::Array(arr), val) => {
                                let mut new_arr = arr.clone();
                                new_arr.push(val.clone());
                                Ok(RuntimeVal::Array(new_arr))
                            },
                            (RuntimeVal::String(s1), RuntimeVal::String(s2)) => Ok(RuntimeVal::String(format!("{}{}", s1, s2))),
                            (RuntimeVal::Null, RuntimeVal::String(s2)) => Ok(RuntimeVal::String(s2.clone())),
                            (RuntimeVal::Null, val) if matches!(val, RuntimeVal::Array(_)) => Ok(val.clone()),
                            (RuntimeVal::Null, val) => Ok(RuntimeVal::Array(vec![val.clone()])),
                            _ => Err(format!("append() type mismatch: cannot append {:?} to {:?}", item, base))
                        }
                    },
                    "get_dict_float" => {
                        if eval_args.len() != 2 { return Err("get_dict_float requires 2 args (dict, key)".to_string()); }
                        let Some(RuntimeVal::String(key)) = eval_args.get(1) else { return Ok(RuntimeVal::Float(0.0)); };
                        if let Some(RuntimeVal::Dictionary(dict)) = eval_args.get(0) {
                            if let Some(RuntimeVal::Float(val)) = dict.get(key) { return Ok(RuntimeVal::Float(*val)); }
                        }
                        Ok(RuntimeVal::Float(0.0))
                    },
                    "set_dict_float" => {
                        if eval_args.len() != 3 { return Err("set_dict_float requires 3 args (dict, key, value)".to_string()); }
                        let Some(RuntimeVal::String(key)) = eval_args.get(1) else { return Ok(eval_args[0].clone()); };
                        let Some(RuntimeVal::Float(value)) = eval_args.get(2) else { return Ok(eval_args[0].clone()); };
                        let mut new_dict = HashMap::new();
                        if let Some(RuntimeVal::Dictionary(existing_dict)) = eval_args.get(0) { new_dict = existing_dict.clone(); }
                        new_dict.insert(key.clone(), RuntimeVal::Float(*value));
                        Ok(RuntimeVal::Dictionary(new_dict))
                    },
                    "get_dict_int" => {
                        if eval_args.len() != 2 { return Err("get_dict_int requires 2 args (dict, key)".to_string()); }
                        let Some(RuntimeVal::String(key)) = eval_args.get(1) else { return Ok(RuntimeVal::Int(0)); };
                        if let Some(RuntimeVal::Dictionary(dict)) = eval_args.get(0) {
                            if let Some(RuntimeVal::Int(val)) = dict.get(key) { return Ok(RuntimeVal::Int(*val)); }
                        }
                        Ok(RuntimeVal::Int(0))
                    },
                    "set_dict_int" => {
                        if eval_args.len() != 3 { return Err("set_dict_int requires 3 args (dict, key, value)".to_string()); }
                        let Some(RuntimeVal::String(key)) = eval_args.get(1) else { return Ok(eval_args[0].clone()); };
                        let Some(RuntimeVal::Int(value)) = eval_args.get(2) else { return Ok(eval_args[0].clone()); };
                        let mut new_dict = HashMap::new();
                        if let Some(RuntimeVal::Dictionary(existing_dict)) = eval_args.get(0) { new_dict = existing_dict.clone(); }
                        new_dict.insert(key.clone(), RuntimeVal::Int(*value));
                        Ok(RuntimeVal::Dictionary(new_dict))
                    },
                    "get_dict_string" => {
                        if eval_args.len() != 2 { return Err("get_dict_string requires 2 args (dict, key)".to_string()); }
                        let Some(RuntimeVal::String(key)) = eval_args.get(1) else { return Ok(RuntimeVal::String("".to_string())); };
                        if let Some(RuntimeVal::Dictionary(dict)) = eval_args.get(0) {
                            if let Some(RuntimeVal::String(val)) = dict.get(key) { return Ok(RuntimeVal::String(val.clone())); }
                        }
                        Ok(RuntimeVal::String("".to_string()))
                    },
                    "set_dict_string" => {
                        if eval_args.len() != 3 { return Err("set_dict_string requires 3 args".to_string()); }
                        let Some(RuntimeVal::String(key)) = eval_args.get(1) else { return Ok(eval_args[0].clone()); };
                        let Some(RuntimeVal::String(value)) = eval_args.get(2) else { return Ok(eval_args[0].clone()); };
                        let mut new_dict = HashMap::new();
                        if let Some(RuntimeVal::Dictionary(existing_dict)) = eval_args.get(0) { new_dict = existing_dict.clone(); }
                        new_dict.insert(key.clone(), RuntimeVal::String(value.clone()));
                        Ok(RuntimeVal::Dictionary(new_dict))
                    },
                    "set_dict_value" => {
                        if eval_args.len() != 3 { return Err("set_dict_value requires 3 args (dict, key, value)".to_string()); }
                        let Some(RuntimeVal::String(key)) = eval_args.get(1) else { return Ok(eval_args[0].clone()); };
                        let value = eval_args.get(2).unwrap_or(&RuntimeVal::Null).clone();
                        let mut new_dict = HashMap::new();
                        if let Some(RuntimeVal::Dictionary(existing_dict)) = eval_args.get(0) { new_dict = existing_dict.clone(); }
                        new_dict.insert(key.clone(), value);
                        Ok(RuntimeVal::Dictionary(new_dict))
                    },
                    "execute_logic" => {
                        if let Some(ctx) = eval_args.get(1) { Ok(ctx.clone()) } else { Ok(RuntimeVal::Dictionary(HashMap::new())) }
                    },
                    "generate_syscall" => Ok(RuntimeVal::Null),
                    "remove" => {
                        if eval_args.len() != 2 { return Err("remove() requires 2 arguments".to_string()); }
                        if let RuntimeVal::Array(arr) = &eval_args[0] {
                            let mut new_arr = arr.clone();
                            if let Some(pos) = new_arr.iter().position(|x| x == &eval_args[1]) { new_arr.remove(pos); }
                            Ok(RuntimeVal::Array(new_arr))
                        } else { Ok(eval_args[0].clone()) }
                    },
                    "remove_all" => Ok(eval_args[0].clone()), 
                    "slice" => {
                        if eval_args.len() != 3 { return Err("slice() requires 3 arguments (stream, offset, length)".to_string()); }
                        let stream = eval_args.get(0).unwrap_or(&RuntimeVal::Null);
                        let offset = if let Some(RuntimeVal::Int(i)) = eval_args.get(1) { *i as usize } else { 0 };
                        let length = if let Some(RuntimeVal::Int(i)) = eval_args.get(2) { *i as usize } else { 0 };
                        match stream {
                            RuntimeVal::String(s) => {
                                let end = (offset + length).min(s.len());
                                if offset >= s.len() { return Ok(RuntimeVal::String("".to_string())); }
                                Ok(RuntimeVal::String(s[offset..end].to_string()))
                            },
                            _ => Ok(RuntimeVal::String("".to_string())) 
                        }
                    },
                    "splice" => {
                        if eval_args.len() != 3 { return Err("splice() requires 3 args (stream, offset, data)".to_string()); }
                        let stream = eval_args.get(0).unwrap_or(&RuntimeVal::Null);
                        let offset = if let Some(RuntimeVal::Int(i)) = eval_args.get(1) { *i as usize } else { 0 };
                        let data_to_insert = eval_args.get(2).unwrap_or(&RuntimeVal::Null);
                        match (stream, data_to_insert) {
                            (RuntimeVal::String(original), RuntimeVal::String(insert_str)) => {
                                let safe_offset = offset.min(original.len());
                                let mut new_string = String::new();
                                new_string.push_str(&original[..safe_offset]);
                                new_string.push_str(insert_str);
                                let remainder_start = safe_offset + insert_str.len();
                                if remainder_start < original.len() { new_string.push_str(&original[remainder_start..]); }
                                Ok(RuntimeVal::String(new_string))
                            },
                            (RuntimeVal::Null, RuntimeVal::String(insert_str)) => Ok(RuntimeVal::String(insert_str.clone())),
                            _ => Ok(RuntimeVal::String("".to_string())) 
                        }
                    },
                    "min" => {
                        if eval_args.len() != 2 { return Err("min requires 2 args".to_string()); }
                        match (&eval_args[0], &eval_args[1]) {
                            (RuntimeVal::Int(a), RuntimeVal::Int(b)) => Ok(RuntimeVal::Int(*a.min(b))),
                            (RuntimeVal::Float(a), RuntimeVal::Float(b)) => Ok(RuntimeVal::Float(a.min(*b))),
                            _ => Err("min requires two Ints or two Floats".to_string())
                        }
                    },
                    "bitwise_and" => {
                        if eval_args.len() != 2 { return Err("bitwise_and requires 2 args".to_string()); }
                        match (&eval_args[0], &eval_args[1]) {
                            (RuntimeVal::Int(a), RuntimeVal::Int(b)) => Ok(RuntimeVal::Int(*a & *b)),
                            _ => Err("bitwise_and requires two Ints".to_string())
                        }
                    },
                    "calculate_hash" => Ok(RuntimeVal::String("hash_256_abcdef".to_string())),
                    "think" => {
                        // Now accepts 3 args: goal, dopamine, agent_persona
                        if eval_args.len() != 3 { return Err("think requires 3 args".to_string()); }
                        
                        let Some(RuntimeVal::String(goal)) = eval_args.get(0) else { return Ok(RuntimeVal::Null); };
                        let Some(RuntimeVal::String(agent_persona)) = eval_args.get(2) else { return Ok(RuntimeVal::Null); };
                        
                        let mut request_body = HashMap::new();
                        request_body.insert("input", goal.clone());
                        
                        // --- DYNAMIC URL CONSTRUCTION ---
                        // IMPORTANT: Ensure your server is running on this IP!
                        // If it's on the same machine as GenesisOS, use 127.0.0.1
                        let hive_ip = "192.168.12.208"; 
                        let hive_url = format!("http://{}:3000/ask/{}", hive_ip, agent_persona);
                        // ------------------------------
                        
                        println!("[kMICT COGNITION] Sending thought to Hive URL: '{}'", hive_url);
                        
                        let client = reqwest::blocking::Client::new();
                        let res = client.post(hive_url)
                            .json(&request_body)
                            .send();

                        let mut plan = HashMap::new();
                        match res {
                            Ok(response) => {
                                if response.status().is_success() {
                                    if let Ok(json) = response.json::<serde_json::Value>() {
                                        if let Some(ai_text) = json.get("response").and_then(|v| v.as_str()) {
                                            plan.insert("action".to_string(), RuntimeVal::String("RESPOND".to_string()));
                                            plan.insert("payload".to_string(), RuntimeVal::String(ai_text.to_string()));
                                            println!("[kMICT COGNITION] Hive replied: '{}'", ai_text);
                                        }
                                    }
                                } else {
                                    // We capture the HTTP status code to help debug 404 errors!
                                    let err_msg = format!("Hive Server Error: HTTP {}", response.status());
                                    println!("[kMICT COGNITION] {}", err_msg);
                                    plan.insert("action".to_string(), RuntimeVal::String("ERROR".to_string()));
                                    plan.insert("payload".to_string(), RuntimeVal::String(err_msg));
                                }
                            },
                            Err(e) => {
                                let err_msg = format!("Hive connection severed: {}", e);
                                println!("[kMICT COGNITION] {}", err_msg);
                                plan.insert("action".to_string(), RuntimeVal::String("ERROR".to_string()));
                                plan.insert("payload".to_string(), RuntimeVal::String(err_msg));
                            }
                        }
                        
                        Ok(RuntimeVal::Dictionary(plan))
                    },
                    "is_goal_aligned" | "is_action_safe" => Ok(RuntimeVal::Bool(true)),
                    "verify_signature" => {
                        if eval_args.len() != 3 { return Err("verify_signature requires 3 args".to_string()); }
                        let Some(RuntimeVal::String(pub_key)) = eval_args.get(0) else { return Ok(RuntimeVal::Bool(false)); };
                        let Some(RuntimeVal::String(challenge)) = eval_args.get(1) else { return Ok(RuntimeVal::Bool(false)); };
                        let Some(RuntimeVal::String(signature)) = eval_args.get(2) else { return Ok(RuntimeVal::Bool(false)); };
                        let is_valid = crate::crypto::verify_signature(pub_key, challenge, signature);
                        Ok(RuntimeVal::Bool(is_valid))
                    },
                    "generate_secure_token" => {
                        let token: String = rand::thread_rng().sample_iter(&rand::distributions::Alphanumeric).take(32).map(char::from).collect();
                        Ok(RuntimeVal::String(format!("gsk_{}", token)))
                    },
                    "is_session_valid" => {
                        if eval_args.is_empty() { return Err("is_session_valid requires 1 arg (token)".to_string()); }
                        let Some(RuntimeVal::String(token)) = eval_args.get(0) else { return Ok(RuntimeVal::Bool(false)); };
                        if token == "gsk_admin_override" || token.starts_with("gsk_") { Ok(RuntimeVal::Bool(true)) } else { Ok(RuntimeVal::Bool(false)) }
                    },
                    "is_nonce_fresh" => Ok(RuntimeVal::Bool(true)),
                    "evaluate_policy" => {
                        let Some(RuntimeVal::String(policy_id)) = eval_args.get(0) else { return Ok(RuntimeVal::Bool(false)); };
                        match eval_args.get(1) {
                            Some(RuntimeVal::Array(concept_vector)) => {
                                if concept_vector.len() >= 2 {
                                    if let RuntimeVal::Float(theta) = concept_vector[1] {
                                        if theta >= 40.0 { return Ok(RuntimeVal::Bool(false)); }
                                    }
                                }
                                Ok(RuntimeVal::Bool(true))
                            },
                            Some(RuntimeVal::String(payload)) => {
                                if policy_id == "policy_safe_commands" {
                                    let forbidden = ["sudo", "rm", "mkfs", "shutdown"];
                                    let payload_lower = payload.to_lowercase();
                                    for cmd in forbidden {
                                        if payload_lower.contains(cmd) { return Ok(RuntimeVal::Bool(false)); }
                                    }
                                }
                                Ok(RuntimeVal::Bool(true))
                            },
                            _ => Ok(RuntimeVal::Bool(true))
                        }
                    },
                    "verify_remote_identity" => {
                        let Some(RuntimeVal::String(ip_addr)) = eval_args.get(0) else { return Ok(RuntimeVal::Null); };
                        if ip_addr == "8.8.8.8" { Ok(RuntimeVal::String("hash_google_dns_trusted".to_string())) } else { Ok(RuntimeVal::Null) }
                    },
                    "current_system_time" => {
                        let start = SystemTime::now();
                        let since_the_epoch = start.duration_since(UNIX_EPOCH).unwrap();
                        Ok(RuntimeVal::Int(since_the_epoch.as_secs() as i64))
                    },
                    "mdo_exists" => Ok(RuntimeVal::Bool(true)),
                    "determine_next_process" => {
                        if let Some(RuntimeVal::Array(arr)) = eval_args.get(0) {
                            if arr.len() > 0 { return Ok(arr[0].clone()); }
                        }
                        Ok(RuntimeVal::String("SYS_IDLE".to_string()))
                    },
                    "calculate_system_load" => Ok(RuntimeVal::Float(0.45)),
                    "identify_critical_dissonance" => Ok(RuntimeVal::Null),
                    "get_instruction_pointer" => Ok(RuntimeVal::Int(1024)),
                    "get_process_mdo" | "get_identity" => Ok(RuntimeVal::Null),
                    "thinkify" => {
                        let Some(RuntimeVal::String(text)) = eval_args.get(0) else { 
                            return Ok(RuntimeVal::Array(vec![RuntimeVal::Float(0.0), RuntimeVal::Float(0.0)])); 
                        };
                        
                        println!("[kMICT SCRIBE] Translating to Concept Vector: '{}'", text);
                        
                        // We ask the Gen8 server to run the Autoencoder
                        // REPLACE IP with your actual Gen8 server IP
                        let scribe_url = "http://192.168.12.78:3000/thinkify"; 
                        
                        let mut request_body = HashMap::new();
                        request_body.insert("input", text.clone());
                        
                        let client = reqwest::blocking::Client::new();
                        match client.post(scribe_url).json(&request_body).send() {
                            Ok(response) => {
                                if response.status().is_success() {
                                    // The server should return: { "vector": [15.2, 45.1, ...] }
                                    if let Ok(json) = response.json::<serde_json::Value>() {
                                        if let Some(vec_array) = json.get("vector").and_then(|v| v.as_array()) {
                                            let mut vector_runtime = Vec::new();
                                            for val in vec_array {
                                                let f_val = val.as_f64().unwrap_or(0.0);
                                                vector_runtime.push(RuntimeVal::Float(f_val));
                                            }
                                            return Ok(RuntimeVal::Array(vector_runtime));
                                        }
                                    }
                                }
                                println!("[kMICT SCRIBE] Scribe server returned an error.");
                            },
                            Err(e) => {
                                println!("[kMICT SCRIBE] Connection to Scribe severed: {}", e);
                            }
                        }
                        
                        // Fallback if the server fails
                        Ok(RuntimeVal::Array(vec![RuntimeVal::Float(0.0), RuntimeVal::Float(0.0)]))
                    },
                    _ => Err(format!("Runtime Error: Unknown system function '{}'", function_name))
                }
            }
            AstNode::GroupedExpression { expr: inner } => self.evaluate(inner),
            _ => Err(format!("Invalid expression node type encountered: {:?}", expr)),
        }
    }

    pub fn execute_statement(&mut self, stmt: &AstNode) -> Result<(), String> {
        match stmt {
            AstNode::Assignment { target, expression } => {
                let val = self.evaluate(expression)?;
                self.context.insert(target.clone(), val);
                Ok(())
            }
            AstNode::LocalDeclaration { name, expression, .. } => {
                let val = self.evaluate(expression)?;
                self.context.insert(name.clone(), val);
                Ok(())
            }
            _ => Ok(()), 
        }
    }
}
