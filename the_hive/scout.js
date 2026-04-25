const { exec } = require('child_process');
const axios = require('axios');

// --- CONFIGURATION ---
const CONSOLE_IP = '192.168.1.20:8080'; // The Dell Laptop (GenesisOS)
const HIVE_IP = '192.168.1.50:6000';    // The Gen8 Server (AI)
const SCOUT_ID = "SCOUT_V60_01";        // Unique ID

// --- HARDWARE INTERFACE (Termux) ---

const speak = (text) => {
    console.log(`[VOCAL] Speaking: "${text}"`);
    // Uses Android Native TTS
    exec(`termux-tts-speak "${text}"`);
};

const listen = () => {
    return new Promise((resolve) => {
        console.log("[LISTEN] Microphone Active...");
        // Uses Android Native Speech-to-Text
        exec('termux-speech-to-text', (err, stdout) => {
            if (err || !stdout) return resolve("");
            resolve(stdout.trim());
        });
    });
};

const getStatus = () => {
    return new Promise((resolve) => {
        exec('termux-battery-status', (err, stdout) => {
            try {
                const data = JSON.parse(stdout);
                resolve({ battery: data.percentage, plugged: data.plugged });
            } catch { resolve({ battery: 0, plugged: false }); }
        });
    });
};

// --- LOGIC LOOP ---

const reportStatus = async () => {
    const stats = await getStatus();
    try {
        // Send heartbeat to GenesisOS Console
        // (You need to add a receiver route in the Rust backend later)
        // For now, we just log it to prove it works
        console.log(`[STATUS] Battery: ${stats.battery}%`);
    } catch (e) {
        console.log("[STATUS] Console unreachable");
    }
};

const voiceLoop = async () => {
    // 1. LISTEN
    const input = await listen();
    
    if (input) {
        console.log(`[HEARD] "${input}"`);
        
        // 2. THINK (Send to Hive)
        try {
            const res = await axios.post(`http://${HIVE_IP}/ask/grandpa`, { input });
            const reply = res.data.response;
            
            // 3. SPEAK (Output)
            speak(reply);
            
        } catch (e) {
            console.error("[HIVE ERROR]", e.message);
            speak("I cannot reach the Hive.");
        }
    }
    
    // Loop immediately if active, or wait for button press
    // For demo: Loop every 5 seconds
    setTimeout(voiceLoop, 2000);
};

// --- INIT ---
console.log(`[SCOUT] ${SCOUT_ID} Online.`);
speak("Scout unit initialized. Connecting to Hive.");

// Start Loops
setInterval(reportStatus, 10000); // Status every 10s
voiceLoop(); // Start Listening
