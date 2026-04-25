import axios from 'axios';
// Uncomment based on your Tauri version
// import { invoke } from '@tauri-apps/api/tauri'; // V1
import { invoke } from '@tauri-apps/api/core'; // V2

// CONFIGURATION
const USE_CLOUD = true; // <--- Set to FALSE to test Local Rust DB
const CLOUD_URL = "https://boredbrains.net";

const REGISTRY = {
    'LOCAL_HIVE': { target: 'http://192.168.12.208:3000' }, // Gen8 Server
    'CLOUD_HIVE': { target: 'https://boredbrains.net/mice/api/dojo' }
};

const getTargetUrl = (path) => {
    if (path.startsWith('http')) return path; 
    return `${CLOUD_URL}${path}`;
};

// Helper to ensure Auth Header
const ensureAuth = (config) => {
    if (!config) config = { headers: {} };
    if (!config.headers) config.headers = {};
    if (!config.headers.Authorization) {
        const token = localStorage.getItem('mice_token');
        if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
};

export const api = {
    get: async (url, config) => {
        config = ensureAuth(config);

        // --- 1. LOCAL HIVE STATUS (Always Hybrid) ---
        if (url.includes('/dojo/local_status')) {
            try {
                const res = await axios.get(`${REGISTRY.LOCAL_HIVE.target}/status`, { timeout: 2000 });
                return { data: { active_agents: res.data.active_agents || [] } };
            } catch (e) { return { data: { active_agents: [] } }; }
        }

        // --- 2. CLOUD MODE ---
        if (USE_CLOUD) {
            return axios.get(getTargetUrl(url), config);
        }

        // --- 3. LOCAL KERNEL MODE (RUST) ---
        console.log(`[KERNEL] GET ${url}`);

        try {
            // A. LIST PROJECTS
            if (url.includes('/projects') && !url.includes('/tasks')) {
                const data = await invoke('get_local_projects');
                return { data: { success: true, data: data } };
            }
            
            // B. RESEARCH LIST vs DETAIL
            if (url.includes('/research')) {
                // Check if asking for specific ID (e.g. /research/15)
                const match = url.match(/\/research\/(\d+)$/);
                if (match) {
                    const id = parseInt(match[1]);
                    const data = await invoke('get_local_study_details', { id });
                    return { data: { success: true, ...data } };
                }
                
                // Else List
                const data = await invoke('get_local_studies');
                return { data: { success: true, data: data } };
            }

            // C. LOGOS INVENTORY
            if (url.includes('/logos/inventory')) {
                const data = await invoke('get_local_inventory');
                return { data: { success: true, data: data } };
            }

        } catch (err) {
            console.error("[KERNEL ERROR]", err);
            return { data: { success: false, message: typeof err === 'string' ? err : err.message } };
        }

        return { data: { success: false, message: "Route Not Implemented Locally" } };
    },

    post: async (url, body, config) => {
        config = ensureAuth(config);

        // --- 1. AI ROUTING (Always Hybrid) ---
        if (url.includes('/dojo/chat') || url.includes('/ask')) {
            const agent = body.agent || 'grandpa';
            if (agent === 'grandpa') return axios.post(`${REGISTRY.CLOUD_HIVE.target}/chat`, body, config);
            else return axios.post(`${REGISTRY.LOCAL_HIVE.target}/ask/${agent}`, { input: body.message || body.input });
        }
        
        // --- 2. SIMULATION ROUTING ---
        if (url.includes('/research/simulate')) {
            // This runs locally regardless of Cloud/Local mode if you want the Laptop CPU to do it
            // Or route to Cloud if USE_CLOUD=true. 
            // For this benchmark, we want LOCAL RUST.
            const result = await invoke('run_elastic_simulation');
            return { data: { success: true, result: result } };
        }

        // --- 3. CLOUD MODE ---
        if (USE_CLOUD) {
            return axios.post(getTargetUrl(url), body, config);
        }

        // --- 4. LOCAL KERNEL MODE (RUST) ---
        console.log(`[KERNEL] POST ${url}`, body);

        try {
            if (url.includes('/projects')) {
                const id = await invoke('create_local_project', {
                    title: body.title,
                    description: body.description || "",
                    category: body.category || "standard",
                    budget: parseFloat(body.budget) || 0.0
                });
                return { data: { success: true, projectId: id } };
            }

            if (url.includes('/research')) {
                // Check if adding artifact
                if (url.includes('/artifact')) {
                    // Implement create_local_artifact in Rust if needed
                    return { data: { success: true } }; 
                }

                const id = await invoke('create_local_study', {
                    title: body.title,
                    hypothesis: body.hypothesis || ""
                });
                return { data: { success: true, id: id } };
            }

            if (url.includes('/auth/login')) {
                return {
                    data: {
                        success: true,
                        token: "local_session_token",
                        user: { id: 0, name: "Local Admin", role: "admin", discipline: "Architect" }
                    }
                };
            }

        } catch (err) {
            console.error("[KERNEL ERROR]", err);
            return { data: { success: false, message: err } };
        }
        
        return { data: { success: true } };
    },

    put: async (url, body, config) => {
        if (USE_CLOUD) return axios.put(getTargetUrl(url), body, config);
        
        // Local Update Logic
        if (url.includes('/research') && url.includes('/stage')) {
             const match = url.match(/\/research\/(\d+)\/stage$/);
             if (match) {
                 const id = parseInt(match[1]);
                 await invoke('update_study_stage', { id, stage: body.stage });
                 return { data: { success: true } };
             }
        }
        
        return { data: { success: true } };
    },

    delete: async (url, config) => {
        if (USE_CLOUD) return axios.delete(getTargetUrl(url), config);
        return { data: { success: true } };
    }
};