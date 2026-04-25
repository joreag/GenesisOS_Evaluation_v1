// src-tauri/src/mict_memory.rs

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use crate::mdo_runtime::RuntimeVal;

// The size of our OS Global Memory Space
const TABLE_SIZE: usize = 10_000; 
// The Krapivin Bound: The absolute maximum latency for any memory operation
const LOOKAHEAD_K: usize = 64;    

pub struct ElasticMemory {
    keys: Vec<Option<String>>,
    values: Vec<Option<RuntimeVal>>,
    pub length: usize,
}

impl ElasticMemory {
    pub fn new() -> Self {
        ElasticMemory {
            keys: vec![None; TABLE_SIZE],
            values: vec![None; TABLE_SIZE],
            length: 0,
        }
    }

    // Deterministic Memory Address Calculator
    fn calculate_address(key: &str) -> usize {
        let mut hasher = DefaultHasher::new();
        key.hash(&mut hasher);
        (hasher.finish() as usize) % TABLE_SIZE
    }

    /// INSERT: O(K) Worst-Case Write Latency
    pub fn insert(&mut self, key: String, val: RuntimeVal) -> Result<(), String> {
        let start_addr = Self::calculate_address(&key);

        // Phase 1: Check if it already exists in the neighborhood (Overwrite)
        for i in 0..LOOKAHEAD_K {
            let idx = (start_addr + i) % TABLE_SIZE;
            if let Some(existing_key) = &self.keys[idx] {
                if existing_key == &key {
                    self.values[idx] = Some(val);
                    return Ok(());
                }
            }
        }

        // Phase 2: If not found, find the best empty slot in the neighborhood
        for i in 0..LOOKAHEAD_K {
            let idx = (start_addr + i) % TABLE_SIZE;
            if self.keys[idx].is_none() {
                self.keys[idx] = Some(key);
                self.values[idx] = Some(val);
                self.length += 1;
                return Ok(());
            }
        }

        // The absolute limit of our Elastic Bound was breached.
        Err(format!("KERNEL PANIC: Elastic Memory Neighborhood Exhausted for key '{}'.", key))
    }

/// GET: O(K) Worst-Case Read Latency
    pub fn get(&self, key: &str) -> Option<&RuntimeVal> {
        let start_addr = Self::calculate_address(key);

        for i in 0..LOOKAHEAD_K {
            let idx = (start_addr + i) % TABLE_SIZE;
            match &self.keys[idx] {
                Some(existing_key) if existing_key == key => return self.values[idx].as_ref(),
                None => (), // Keep scanning, open addressing allows gaps
                _ => (),
            }
        }
        None
    }

    /// CONTAINS: Quick Check
    #[allow(dead_code)] // Tell the compiler we intentionally wrote this API method
    pub fn contains_key(&self, key: &str) -> bool {
        self.get(key).is_some()
    }

    /// CLEAR: Wipe memory (Reboot)
    #[allow(dead_code)] // Tell the compiler we intentionally wrote this API method
    pub fn clear(&mut self) {
        self.keys.fill(None);
        self.values.fill(None);
        self.length = 0;
    }

    /// ITERATOR: Required for bridging state to the React UI
    // Added the explicit anonymous lifetime <'_> as requested by the compiler
    pub fn iter(&self) -> ElasticMemoryIterator<'_> { 
        ElasticMemoryIterator { memory: self, current: 0 }
    }
}

// --- Iterator Implementation for the UI Bridge (Clean Lifetimes) ---

pub struct ElasticMemoryIterator<'a> {
    memory: &'a ElasticMemory,
    current: usize,
}

// CHANGED: We now yield owned (cloned) Strings and RuntimeVals, not references.
impl<'a> Iterator for ElasticMemoryIterator<'a> {
    type Item = (String, RuntimeVal);

    fn next(&mut self) -> Option<Self::Item> {
        while self.current < self.memory.keys.len() {
            let idx = self.current;
            self.current += 1;
            
            // If both key and value exist at this index, clone them and return
            if let (Some(k), Some(v)) = (&self.memory.keys[idx], &self.memory.values[idx]) {
                return Some((k.clone(), v.clone()));
            }
        }
        None
    }
}