import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { discoverLogic } from '../utils/DiscoveryEngine'; // The Scribe

const CodeForgeApp = () => {
    // --- Editor State ---
    const [filename, setFilename] = useState("app_logic.cpp");
    const [fileContent, setFileContent] = useState("// Write C++ or GenLang here...\n\nint main() {\n  int x = 5;\n  if (x > 0) {\n    x = x + 1;\n  }\n  return 0;\n}");
    const [status, setStatus] = useState("Ready");
    const [isProcessing, setIsProcessing] = useState(false);

    // --- Archaeologist State ---
    const [strategy, setStrategy] = useState('cpp');
    const [extractedData, setExtractedData] = useState(null);

    // The Zero-Trust Token
    const sessionToken = "gsk_admin_override"; 

    // Helper for Rust Ints
    const parseRustInt = (rustString) => {
        if (!rustString) return 0;
        const match = String(rustString).match(/Int\((\d+)\)/);
        return match ? parseInt(match[1], 10) : 0;
    };

    // --- 1. THE SCRIBE (Run the Archaeologist) ---
    const handleAnalyze = async () => {
        if (!fileContent.trim()) return;
        setIsProcessing(true);
        setStatus("Archaeologist is scanning...");

        try {
            // Run the local JavaScript MICT engine to extract the logic
            const result = await discoverLogic(fileContent, strategy);
            
            // We format it into the exact Pre-Graph Schema JARVITS needs
            const preGraphPayload = {
                file_id: filename,
                strategy: strategy,
                mict_summary: {
                    MAP: { data_dictionary: result.finalOutput.data_dictionary },
                    ITERATE: { logic_blocks: result.finalOutput.business_logic },
                    CHECK: { security_findings: result.finalOutput.security_findings },
                    TRANSFORM: { generated_code: result.finalOutput.generated_code }
                },
                dependency_graph: result.finalOutput.dependency_graph,
                raw_content: btoa(fileContent) // Base64 encode the raw text for safety
            };

            setExtractedData(preGraphPayload);
            setStatus("Analysis complete. Ready for Knowledge Base.");
        } catch (err) {
            setStatus(`Analysis Failed: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

// --- 2. COMMIT TO KNOWLEDGE BASE (Save the JSON) ---
    const handleCommitToKB = async () => {
        if (!extractedData) {
            setStatus("Analyze the code first!");
            return;
        }
        setIsProcessing(true);
        setStatus("Committing to JARVITS Knowledge Base...");

        const kbFilename = `kb_${filename}.json`;
        const jsonData = JSON.stringify(extractedData, null, 2);

        try {
            // 1. Ensure File Context exists (WITH CORRECT PREFIXES!)
            const state = await invoke('get_kmict_world_state');
            
            // Check if the prefixed object_id exists
            if (!state[`${kbFilename}_object_id`]) {
                await invoke('cmd_set_state', { key: `${kbFilename}_object_id`, valType: 'String', valStr: kbFilename });
                await invoke('cmd_set_state', { key: `${kbFilename}_owner_id`, valType: 'String', valStr: 'mdo_jarvits' });
                await invoke('cmd_set_state', { key: `${kbFilename}_system_max_file_size`, valType: 'Int', valStr: '5000000' }); 
                await invoke('cmd_set_state', { key: `${kbFilename}_mime_type`, valType: 'String', valStr: 'application/json' });
                await invoke('cmd_set_state', { key: `${kbFilename}_current_calculated_hash`, valType: 'String', valStr: '' });
            }

            // 2. Reset the file pointers (WITH CORRECT PREFIXES!)
            await invoke('cmd_set_state', { key: `${kbFilename}_content`, valType: 'Null', valStr: '' });
            await invoke('cmd_set_state', { key: `${kbFilename}_size`, valType: 'Int', valStr: '0' });
            await invoke('cmd_set_state', { key: `${kbFilename}_write_cursor`, valType: 'Int', valStr: '0' });

            // 3. Securely Write to ElasticMemory
            const executionLog = await invoke('cmd_exec_mdo', { 
                mdoId: kbFilename, // <--- FIXED: Target the exact KB file context!
                action: 'APPEND', 
                payload: {
                    "object_id": { "String": kbFilename },
                    "requestor_id": { "String": "user_alice" }, 
                    "requestor_token": { "String": sessionToken },
                    "input_data": { "String": jsonData },
                    "input_offset": { "Int": 0 },
                    "input_read_length": { "Int": 0 },
                }
            });
            
            const hasError = executionLog.some(l => l.includes("HALTED"));
            if (hasError) {
                setStatus("Error: OS rejected the KB commit.");
                console.error(executionLog);
            } else {
                setStatus(`Committed to ${kbFilename}`);
            }
        } catch (e) {
            setStatus(`IPC Error: ${e}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // --- Standard File Load (Unchanged) ---
    const handleLoadRaw = async () => {         
        try {
                setStatus('Loading...');
                const content = await invoke('read_local_file', { path: filePath });
                setCode(content);
                setLanguage(detectLanguage(filePath));
                setStatus('Loaded');
            } catch (e) {
                setStatus('Error: ' + e);
            }
         };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#1e1e1e', color: '#d4d4d4' }}>
            
            {/* TOOLBAR */}
            <div style={{ padding: '10px', backgroundColor: '#2d2d2d', display: 'flex', gap: '15px', alignItems: 'center' }}>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#80cbc4' }}>📝 CodeForge v2</span>
                
                <input 
                    value={filename} 
                    onChange={(e) => setFilename(e.target.value)} 
                    style={{ background: '#111', color: '#fff', border: '1px solid #444', padding: '5px', width: '150px' }}
                />
                
                <select style={{ background: '#111', color: '#fff', border: '1px solid #444', padding: '5px' }} value={strategy} onChange={e => setStrategy(e.target.value)}>
                    <option value="cpp">C++</option>
                    <option value="genlang">GenLang</option> 
                    <option value="dna">DNA</option>
                    <option value="text">Raw Text (Docs)</option> 
                </select>

                <button onClick={handleAnalyze} disabled={isProcessing} style={btnStyle}>1. Analyze Logic</button>
                <button onClick={handleCommitToKB} disabled={!extractedData || isProcessing} style={{...btnStyle, background: extractedData ? '#4caf50' : '#444'}}>2. Commit to JARVITS Brain</button>
                
                <span style={{ marginLeft: 'auto', color: status.includes('Error') ? '#ff5252' : '#80cbc4', fontSize: '12px' }}>{status}</span>
            </div>
            
            {/* SPLIT PANE WORKSPACE */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                
                {/* LEFT: Raw Code Editor */}
                <textarea 
                    value={fileContent}
                    onChange={(e) => setFileContent(e.target.value)}
                    style={{ flex: 1, backgroundColor: '#1e1e1e', color: '#d4d4d4', fontFamily: 'monospace', padding: '15px', border: 'none', borderRight: '1px solid #333', resize: 'none', outline: 'none', fontSize: '14px' }}
                    spellCheck="false"
                />

                {/* RIGHT: The Archaeologist's Extracted Pre-Graph JSON */}
                <div style={{ flex: 1, backgroundColor: '#0a0a0a', padding: '15px', overflowY: 'auto' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#888' }}>Extracted MICT Pre-Graph (JSON)</h4>
                    {extractedData ? (
                        <pre style={{ fontSize: '12px', color: '#a6e22e', margin: 0 }}>
                            {JSON.stringify(extractedData, null, 2)}
                        </pre>
                    ) : (
                        <div style={{ color: '#555', fontStyle: 'italic' }}>Click 'Analyze Logic' to extract the MICT structure...</div>
                    )}
                </div>

            </div>
        </div>
    );
};

const btnStyle = { padding: '6px 12px', background: '#0e639c', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: '3px', fontSize: '12px' };

export default CodeForgeApp;