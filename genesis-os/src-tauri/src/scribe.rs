// src-tauri/src/scribe.rs

/// Simulates the Pascal-Chimera Conceptual Autoencoder.
/// Maps text tokens to Base-60 Polar Coordinates (r, theta).
pub fn text_to_concept_vector(text: &str) -> Vec<f64> {
    let mut vector = Vec::new();
    
    // For our simulation, we treat the whole string as one "Chunk" (K-tokens).
    // We will assign it a Magnitude (r) and a Phase Angle (theta) in Base-60.
    
    let text_lower = text.to_lowercase();
    
    // r: Magnitude (Signal Strength)
    // We'll just use the length of the string as a mock magnitude
    let r = text.len() as f64;
    vector.push(r);

    // theta: Semantic Phase Angle (The actual "Meaning")
    // In our Base-60 complex plane, we designate the 0-30 degree quadrant as "Safe/Standard"
    // We designate the 40+ degree quadrant as "Anomalous/Malicious"
    
    let theta = if text_lower.contains("malware") || text_lower.contains("hack") {
        45.0 // Phase rotation into the anomalous quadrant
    } else if text.is_empty() {
        0.0 // Null state
    } else {
        15.0 // Standard safe semantic space
    };
    
    vector.push(theta);
    
    vector
}