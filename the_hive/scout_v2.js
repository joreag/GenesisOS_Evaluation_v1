const { exec } = require('child_process');
const axios = require('axios');

// --- CONFIGURATION ---
const CONSOLE_IP = '192.168.12.111:8080';
const HIVE_IP = '192.168.12.208:3000';   
const SCOUT_ID = "SCOUT_V60_01";

// Default Agent
let activeAgent = "medic"; 

// --- HARDWARE INTERFACE ---

const speak = (text) => {
    return new Promise((resolve) => {
        console.log(`[VOCAL] Speaking: "${text}"`);
        // Note: termux-tts-speak is async, but we can't easily await its completion.
        // We estimate duration based on length to pause the listener.
        exec(`termux-tts-speak "${text}"`);
        
        // Heuristic: 100ms per character + 1s buffer
        const duration = (text.length * 100) + 1000;
        setTimeout(resolve, duration);
    });
};

const listen = () => {
    return new Promise((resolve) => {
        console.log(`[LISTEN] Listening for ${activeAgent.toUpperCase()}...`);
        // Limit listen time to 5s to keep loop tight
        exec('termux-speech-to-text', (err, stdout) => {
            if (err || !stdout) return resolve("");
            resolve(stdout.trim().toLowerCase());
        });
    });
};

// --- LOGIC LOOP ---

const voiceLoop = async () => {
    // 1. LISTEN
    const input = await listen();
    
    if (input) {
        console.log(`[HEARD] "${input}"`);

        // --- COMMAND PARSING ---
        
        // Dynamic Agent Switching
        if (input.includes("switch to")) {
            // Extract last word: "switch to [chaos]"
            const words = input.split(" ");
            const target = words[words.length - 1]; // "chaos"
            
            // Optimistic switch
            activeAgent = target;
            await speak(`Routing to ${target}.`);
        }
        
        // Command: "Scout status"
        else if (input.includes("status report")) {
            await speak(`Battery systems nominal. Hive link active.`);
        }
        
        // Standard Query
        else {
            try {
                // 2. THINK
                const res = await axios.post(`http://${HIVE_IP}/ask/${activeAgent}`, { input });
                const reply = res.data.response;
                
                // 3. SPEAK (With Locking)
                if (reply && reply.length > 0) {
                    await speak(reply);
                }
            } catch (e) {
                console.error("[HIVE ERROR]", e.message);
                await speak("Hive link severed.");
            }
        }
    }
    
    // 4. RESTART LOOP (Short delay to prevent instant re-trigger)
    setTimeout(voiceLoop, 500);
};

// --- INIT ---
console.log(`[SCOUT] ${SCOUT_ID} Online.`);
speak("Scout Online. Listening.");

// Status Heartbeat (Background)
setInterval(() => {
    exec('termux-battery-status', (err, stdout) => {
        try {
            const data = JSON.parse(stdout);
            console.log(`[STATUS] Battery: ${data.percentage}%`);
        } catch {}
    });
}, 10000);

voiceLoop();