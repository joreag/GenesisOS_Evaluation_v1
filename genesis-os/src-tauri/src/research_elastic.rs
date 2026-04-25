use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use rand::Rng;

const TABLE_SIZE: usize = 100_000;
const LOOKAHEAD_K: usize = 32;
const BLOCK_SIZE: usize = 64;

// --- STANDARD MAP (Greedy) ---
// (Same as before)
struct StandardMap { buckets: Vec<Option<u64>> }
impl StandardMap {
    fn new() -> Self { StandardMap { buckets: vec![None; TABLE_SIZE] } }
    fn insert(&mut self, val: u64) -> usize {
        let mut hasher = DefaultHasher::new();
        val.hash(&mut hasher);
        let start = (hasher.finish() as usize) % TABLE_SIZE;
        for i in 0..TABLE_SIZE {
            let idx = (start + i) % TABLE_SIZE;
            if self.buckets[idx].is_none() {
                self.buckets[idx] = Some(val);
                return i + 1; 
            }
        }
        TABLE_SIZE
    }
}


struct ElasticMap { 
    buckets: Vec<Option<u64>>,
    heatmap: Vec<u8> 
}

impl ElasticMap {
    fn new() -> Self { 
        // Heatmap size: 1 byte per Block
        let map_size = (TABLE_SIZE / BLOCK_SIZE) + 1;
        ElasticMap { 
            buckets: vec![None; TABLE_SIZE],
            heatmap: vec![0; map_size] 
        } 
    }

    // NEW: Accepts 'stress' (0.0 - 1.0)
    fn insert(&mut self, val: u64, stress: f32) -> usize {
        let mut hasher = DefaultHasher::new();
        val.hash(&mut hasher);
        let mut start = (hasher.finish() as usize) % TABLE_SIZE;
        let mut total_cost = 0;

        // DYNAMIC THRESHOLD (The Cybernetic Feedback Loop)
        // If Stress is High (> 0.5), be Aggressive (skip if 75% full).
        // If Stress is Low, be Patient (fill to 100%).
        let threshold = if stress > 0.5 { (BLOCK_SIZE as f32 * 0.75) as u8 } else { BLOCK_SIZE as u8 };

        let mut block_idx = start / BLOCK_SIZE;
        let mut attempts = 0;

        // MAP PHASE: Check Heatmap against Dynamic Threshold
        while self.heatmap[block_idx] >= threshold && attempts < 20 {
            start = (start + BLOCK_SIZE) % TABLE_SIZE;
            block_idx = start / BLOCK_SIZE;
            total_cost += 1;
            attempts += 1;
        }

        // ITERATE PHASE (Scan K)
        for i in 0..LOOKAHEAD_K {
            let idx = (start + i) % TABLE_SIZE;
            if self.buckets[idx].is_none() {
                // TRANSFORM PHASE (Commit)
                self.buckets[idx] = Some(val);
                self.heatmap[idx / BLOCK_SIZE] += 1;
                return total_cost + 1;
            }
            total_cost += 1;
        }

        // Fallback
        for i in 0..TABLE_SIZE {
            let idx = (start + i) % TABLE_SIZE;
            if self.buckets[idx].is_none() {
                self.buckets[idx] = Some(val);
                self.heatmap[idx / BLOCK_SIZE] += 1;
                return total_cost + i;
            }
        }
        TABLE_SIZE
    }
}

pub fn run_benchmark() -> String {
    let mut rng = rand::thread_rng();
    let mut std_map = StandardMap::new();
    let mut els_map = ElasticMap::new();
    
    let mut std_max = 0;
    let mut els_max = 0;
    let mut std_sum = 0;
    let mut els_sum = 0;

    let items = (TABLE_SIZE as f64 * 0.90) as usize;

    for i in 0..items {
        let val: u64 = rng.gen();
        
        // SIMULATE RISING SYSTEM PRESSURE
        // As the table fills, we simulate "RAM Pressure" increasing from 0.0 to 0.9
        let current_stress = i as f32 / items as f32;

        let p1 = std_map.insert(val);
        std_sum += p1;
        if p1 > std_max { std_max = p1; }

        // MICT Adaptability: Pass the current stress level
        let p2 = els_map.insert(val, current_stress);
        els_sum += p2;
        if p2 > els_max { els_max = p2; }
    }

    let std_avg = std_sum as f64 / items as f64;
    let els_avg = els_sum as f64 / items as f64;

    format!(
        "RESULTS v3 (Dynamic Adaptation):\n\
        GREEDY: Avg {:.2} | Max {}\n\
        MICT:   Avg {:.2} | Max {}\n\
        \n\
        By adapting to system stress, MICT reduced worst-case latency by {:.1}%.",
        std_avg, std_max,
        els_avg, els_max,
        ((std_max as f64 - els_max as f64) / std_max as f64) * 100.0
    )
}