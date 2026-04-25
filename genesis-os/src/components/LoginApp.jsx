// src/components/LoginApp.jsx

import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

const LoginApp = () => {
    const [username, setUsername] = useState('alice');
    const [userId, setUserId] = useState('');
    const [keys, setKeys] = useState(null);
    const [log, setLog] = useState([]);

    const addLog = (msg) => setLog(prev => [msg, ...prev]);

    const handleCreateUser = async () => {
        try {
            const result = await invoke('create_user_identity', { username });
            addLog(result);
            setUserId(`user_${username}`);
        } catch (e) {
            addLog(`[ERROR] ${e}`);
        }
    };

    const handleFetchKeys = async () => {
        if (!userId) {
            addLog("Create a user first.");
            return;
        }
        try {
            const fetchedKeys = await invoke('get_user_keys', { userId });
            setKeys(fetchedKeys);
            addLog(`Fetched keys for ${userId}.`);
        } catch (e) {
            addLog(`[ERROR] ${e}`);
        }
    };

    const handleLogin = async () => {
        if (!keys) {
            addLog("Fetch keys before logging in.");
            return;
        }
        addLog("--- BEGIN AUTHENTICATION CEREMONY ---");
        
        // 1. Generate a random challenge (a nonce)
        const challenge = `nonce_${Date.now()}_${Math.random()}`;
        addLog(`Generated Challenge: ${challenge}`);

        // 2. "Sign" the challenge with the private key (using a Rust helper)
        let signature;
        try {
            signature = await invoke('sign_challenge', { privateKey: keys.private_key, challenge });
            addLog(`Signature generated: ${signature.substring(0, 20)}...`);
        } catch (e) {
            addLog(`[SIGN ERROR] ${e}`);
            return;
        }

        // 3. Prepare the Context and Execute Identity.mdo atomically
        addLog("Executing Identity.mdo with full cryptographic context...");
        
        try {
            // We pass ALL the 'requires' variables directly in the payload!
            // This is much cleaner than setting global state variables one by one.
            const executionLog = await invoke('cmd_exec_mdo', { 
                mdoId: 'mdo_identity', 
                action: 'AUTHENTICATE',
                
                // --- THE CRITICAL FIX: The Payload ---
                // We must satisfy the MAP block's requirements.
                payload: {
                    "object_id": { "String": userId }, // e.g., "user_alice"
                    "owner_id": { "String": "System_Root" },
                    "entity_name": { "String": username },
                    "entity_type": { "String": "Human" },
                    "public_key": { "String": keys.public_key },
                    "input_signed_challenge": { "String": signature },
                    "input_challenge_nonce": { "String": challenge },
                    // We must provide an empty array to satisfy the type checker for roles
                    "input_new_roles": { "Array": [] } 
                }
            });
            
            executionLog.forEach(l => addLog(l));

            addLog("--- CEREMONY COMPLETE ---");
            
        } catch (e) {
            addLog(`[EXECUTION ERROR] ${e}`);
        }
    };


    return (
        <div style={containerStyle}>
            <h2>GenesisOS Identity Test</h2>
            <div style={controlsContainerStyle}>
                <input 
                    type="text" 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)} 
                    style={{ background: '#333', color: '#fff', border: '1px solid #555' }}
                />
                <button onClick={handleCreateUser} style={btnStyle}>1. Create User</button>
                <button onClick={handleFetchKeys} style={btnStyle}>2. Fetch Keys</button>
                <button onClick={handleLogin} style={btnStyle}>3. Authenticate</button>
            </div>
            <div style={logBoxStyle}>
                {log.map((line, i) => <div key={i}>{line}</div>)}
            </div>
        </div>
    );
};

const containerStyle = { padding: '10px', fontFamily: 'monospace', color: '#ccc', backgroundColor: '#111', height: '100%', boxSizing: 'border-box' };
const controlsContainerStyle = { display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' };
const btnStyle = { padding: '5px', background: '#333', color: '#0f0', border: '1px solid #0f0', cursor: 'pointer' };
const logBoxStyle = { border: '1px solid #333', padding: '5px', height: 'calc(100% - 80px)', overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse' };

export default LoginApp;