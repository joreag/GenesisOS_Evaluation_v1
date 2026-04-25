import axios from 'axios';
import { api } from './api'; // Use our Shim for transport

// --- THE COUNCIL REGISTRY ---
const COUNCIL = {
    'BLUE': 'guardian_blue_v4', // Logic / Architect
    'RED': 'guardian_red_v4',   // Critic / Security
    'MEDIC': 'sentinel_l2_medic_v4', // Health / Optimist
    'GRANDPA': 'grandpa' // Creative / Storyteller
};

export const OmztaRouter = {
    
    // 1. DIRECT ROUTE (Simple)
    askAgent: async (agentName, prompt) => {
        return api.post('/api/dojo/chat', { message: prompt, agent: agentName });
    },

    // 2. THE COUNCIL SESSION (Swarm)
    // Runs a debate between two agents
    conveneCouncil: async (topic, primaryAgent = 'BLUE', criticAgent = 'RED') => {
        console.log(`[OMZTA] Convening Council on: "${topic}"`);

        // Step 1: Primary Analysis
        console.log(`[OMZTA] Phase 1: ${primaryAgent} Analysis...`);
        const res1 = await api.post('/api/dojo/chat', { 
            message: `Analyze this topic: ${topic}`, 
            agent: COUNCIL[primaryAgent] 
        });
        const primaryThesis = res1.data.response;

        // Step 2: Critical Review
        console.log(`[OMZTA] Phase 2: ${criticAgent} Review...`);
        const res2 = await api.post('/api/dojo/chat', { 
            message: `Review this analysis for flaws: "${primaryThesis}"`, 
            agent: COUNCIL[criticAgent] 
        });
        const critique = res2.data.response;

        // Step 3: Synthesis (Optional - ask Blue to resolve)
        // For now, return both
        return {
            topic: topic,
            thesis: { agent: primaryAgent, content: primaryThesis },
            antithesis: { agent: criticAgent, content: critique },
            synthesis: "Pending Human Review"
        };
    }
};