import React, { useState, useEffect, useRef } from 'react';
import { api as axios } from '../utils/api'; 
import { invoke } from '@tauri-apps/api/core';

// --- STYLES ---
const styles = {
    container: { maxWidth: '900px', margin: '20px auto', padding: '20px', height: '85vh', display: 'flex', flexDirection: 'column', background: '#121212', border: '1px solid #333', borderRadius: '12px' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' },
    controls: { display: 'flex', gap: '10px' },
    agentSelect: { background: '#222', color: '#fff', border: '1px solid #444', padding: '5px', borderRadius: '4px' },
    modeToggle: { background: '#333', color: '#aaa', border: '1px solid #555', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8em' },
    modeActive: { background: '#00796b', color: '#fff', border: '1px solid #004d40' },
    
    // Windows
    chatWindow: { flex: 1, overflowY: 'auto', marginBottom: '20px', paddingRight: '10px' },
    councilWindow: { flex: 1, overflowY: 'auto', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '15px' },
    
    // Chat Bubbles
    userMsg: { alignSelf: 'flex-end', background: '#263238', color: '#e0e0e0', padding: '10px 15px', borderRadius: '12px 2px 12px 12px', marginBottom: '10px', maxWidth: '70%', marginLeft: 'auto' },
    aiMsg: { alignSelf: 'flex-start', background: '#1e1e1e', border: '1px solid #333', color: '#80cbc4', padding: '15px', borderRadius: '2px 12px 12px 12px', marginBottom: '10px', maxWidth: '75%', position: 'relative' },
    
    // Council Cards
    councilCard: { background: '#1e1e1e', border: '1px solid #444', borderRadius: '8px', padding: '15px' },
    cardHeader: { borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '10px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' },
    splitView: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' },
    thesisBox: { background: '#0d1b2a', padding: '10px', borderRadius: '4px', borderLeft: '3px solid #2196f3' },
    antithesisBox: { background: '#1a0d0d', padding: '10px', borderRadius: '4px', borderLeft: '3px solid #f44336' },
    
    // Input
    inputRow: { display: 'flex', gap: '10px' },
    input: { flex: 1, padding: '15px', borderRadius: '8px', border: '1px solid #444', background: '#1e1e1e', color: '#fff', outline: 'none' },
    btn: { padding: '0 25px', borderRadius: '8px', border: 'none', background: '#00796b', color: '#fff', fontWeight: 'bold', cursor: 'pointer' },
    
    // Correction
    teachBtn: { position: 'absolute', bottom: '-10px', right: '10px', background: '#ff9800', color: '#000', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', border: '1px solid #000' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
    modal: { width: '600px', background: '#1e1e1e', padding: '30px', borderRadius: '12px', border: '1px solid #555' },
    label: { display: 'block', color: '#888', marginBottom: '5px', fontSize: '0.9em' },
    readOnlyBox: { background: '#111', padding: '10px', borderRadius: '4px', color: '#aaa', marginBottom: '15px', fontFamily: 'monospace', fontSize: '0.9em' }
};

const Dojo = () => {
    const [mode, setMode] = useState('chat'); // 'chat' or 'council'
    const [history, setHistory] = useState([]);
    const [councilHistory, setCouncilHistory] = useState([]); // Separate history for Council
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    
    const [agents, setAgents] = useState(['grandpa']);
    const [currentAgent, setCurrentAgent] = useState('grandpa');
    
    const [correctionTarget, setCorrectionTarget] = useState(null);
    const [betterResponse, setBetterResponse] = useState("");
    
    const scrollRef = useRef();

    // 1. DISCOVER AGENTS
    useEffect(() => {
        const checkHive = async () => {
            let availableAgents = ['grandpa'];
            try {
                const res = await axios.get('/api/dojo/local_status'); 
                const list = res.data.active_agents || res.data.agents || [];
                if (list.length > 0) availableAgents = [...availableAgents, ...list];
            } catch (e) { console.warn("Local Hive Offline"); }
            setAgents([...new Set(availableAgents)]);
        };
        checkHive();
    }, []);

    // Auto-Scroll
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [history, councilHistory, mode]);

    const handleSend = async () => {
        if (!input.trim()) return;
        const userText = input;
        setInput("");
        setLoading(true);

        if (mode === 'chat') {
            // --- STANDARD CHAT (Now routed through GenesisOS) ---
            setHistory(prev => [...prev, { role: 'user', text: userText, id: Date.now() }]);
            try {
                // 1. Ensure JARVITS is loaded and has context
                const state = await invoke('get_kmict_world_state');
                if (!state.mdo_jarvits_object_id) {
                    await invoke('cmd_set_state', { key: 'mdo_jarvits_object_id', valType: 'String', valStr: 'mdo_jarvits'});
                    await invoke('cmd_set_state', { key: 'mdo_jarvits_owner_id', valType: 'String', valStr: 'System_Root'});
                    await invoke('cmd_set_state', { key: 'mdo_jarvits_dopamine_level', valType: 'Float', valStr: '0.0'});
                }

                // 2. Send the Task to Jarvits.mdo!
                const executionLog = await invoke('cmd_exec_mdo', { 
                    mdoId: 'mdo_jarvits', 
                    action: 'NEW_TASK',
                    payload: {
                        // ...
                        "input_goal": { "String": userText },
                        "input_task": { "String": "CHAT" },
                        "input_agent_persona": { "String": currentAgent }, // <-- THE CRITICAL FIX
                        "input_amount": { "Float": 0.0 }
                    }
                });

                // 3. Parse the IPC Response from the log to get the AI's reply
                let aiReply = "No response generated.";
                const logString = executionLog.join('\n');
                
                // We use the safer regex that catches everything between the quotes
                const match = logString.match(/response: String\("(.*)"\)/s);
                if (match && match[1]) {
                    // Clean up Rust formatting
                    aiReply = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                } else {
                    console.error("Execution Log:", executionLog);
                }

                setHistory(prev => [...prev, { 
                    role: 'ai', text: aiReply, relatedPrompt: userText, agent: "jarvits", id: Date.now() + 1 
                }]);

            } catch (e) {
                setHistory(prev => [...prev, { role: 'ai', text: `OS IPC Error: ${e}`, id: Date.now() }]);
            }
        } else {
            // --- COUNCIL SESSION (Legacy Axios calls for now) ---
            setCouncilHistory(prev => [...prev, { type: 'topic', text: userText, id: Date.now() }]);
            
            try {
                // Step 1: Blue (Thesis)
                const res1 = await axios.post('/api/dojo/chat', { message: `Analyze: ${userText}`, agent: 'guardian_blue' });
                const thesis = res1.data.response || "[Blue Offline]";

                // Step 2: Red (Antithesis)
                const res2 = await axios.post('/api/dojo/chat', { message: `Critique this analysis: "${thesis}"`, agent: 'guardian_red' });
                const antithesis = res2.data.response || "[Red Offline]";

                setCouncilHistory(prev => [...prev, { 
                    type: 'debate', 
                    thesis: { agent: 'BLUE', text: thesis },
                    antithesis: { agent: 'RED', text: antithesis },
                    id: Date.now() + 1
                }]);
            } catch (e) {
                setCouncilHistory(prev => [...prev, { type: 'error', text: "Council quorum not met (Agents offline).", id: Date.now() }]);
            }
        }
        // This was outside the try/catch, safely resetting the UI state
        setLoading(false); 
    };

    const submitCorrection = async () => {
        try {
            await axios.post('https://boredbrains.net/mice/api/dojo/correct', {
                agent: currentAgent, prompt: correctionTarget.relatedPrompt,
                aiResponse: correctionTarget.text, correction: betterResponse
            });
            alert("Lesson learned.");
            setCorrectionTarget(null); setBetterResponse("");
        } catch (e) { alert("Failed."); }
    };

    return (
        <div style={styles.container}>
            
            {/* HEADER & CONTROLS */}
            <div style={styles.header}>
                <h2 style={{color: '#e0e0e0', margin:0}}>🥋 The Dojo</h2>
                <div style={styles.controls}>
                    <button 
                        style={{...styles.modeToggle, ...(mode==='chat' ? styles.modeActive : {})}}
                        onClick={() => setMode('chat')}
                    >Chat</button>
                    <button 
                        style={{...styles.modeToggle, ...(mode==='council' ? styles.modeActive : {})}}
                        onClick={() => setMode('council')}
                    >Council</button>
                    
                    {mode === 'chat' && (
                        <select style={styles.agentSelect} value={currentAgent} onChange={(e) => setCurrentAgent(e.target.value)}>
                            {agents.map(a => <option key={a} value={a}>{a.toUpperCase()}</option>)}
                        </select>
                    )}
                </div>
            </div>
            
            {/* --- VIEW: CHAT --- */}
            {mode === 'chat' && (
                <div style={styles.chatWindow} ref={scrollRef}>
                    {history.length === 0 && <div style={{textAlign:'center', color:'#555', marginTop:'100px'}}>Select Agent. Begin Training.</div>}
                    {history.map((msg) => (
                        <div key={msg.id} style={msg.role === 'user' ? styles.userMsg : styles.aiMsg}>
                            {msg.role === 'ai' && <div style={{fontSize:'0.6em', color:'#666', marginBottom:'5px'}}>{msg.agent?.toUpperCase()}</div>}
                            {msg.text}
                            {msg.role === 'ai' && !msg.text.includes("severed") && (
                                <div style={styles.teachBtn} onClick={() => setCorrectionTarget(msg)}>✏️ Correct</div>
                            )}
                        </div>
                    ))}
                    {loading && <div style={{color:'#666'}}>Thinking...</div>}
                </div>
            )}

            {/* --- VIEW: COUNCIL --- */}
            {mode === 'council' && (
                <div style={styles.councilWindow} ref={scrollRef}>
                    {councilHistory.length === 0 && <div style={{textAlign:'center', color:'#555', marginTop:'100px'}}>Propose a topic for the Council.</div>}
                    {councilHistory.map((item) => (
                        <div key={item.id} style={{width:'100%'}}>
                            {item.type === 'topic' && (
                                <div style={{textAlign:'center', color:'#80cbc4', borderBottom:'1px solid #333', paddingBottom:'10px', marginBottom:'10px'}}>
                                    TOPIC: {item.text}
                                </div>
                            )}
                            {item.type === 'debate' && (
                                <div style={styles.splitView}>
                                    <div style={styles.thesisBox}>
                                        <div style={{color:'#2196f3', fontWeight:'bold', marginBottom:'5px'}}>BLUE (Architect)</div>
                                        <div style={{fontSize:'0.9em', color:'#ccc'}}>{item.thesis.text}</div>
                                    </div>
                                    <div style={styles.antithesisBox}>
                                        <div style={{color:'#f44336', fontWeight:'bold', marginBottom:'5px'}}>RED (Critic)</div>
                                        <div style={{fontSize:'0.9em', color:'#ccc'}}>{item.antithesis.text}</div>
                                    </div>
                                </div>
                            )}
                             {item.type === 'error' && <div style={{color:'#ff5252', textAlign:'center'}}>{item.text}</div>}
                        </div>
                    ))}
                    {loading && <div style={{textAlign:'center', color:'#ff9800'}}>Convening Council...</div>}
                </div>
            )}

            {/* INPUT */}
            <div style={styles.inputRow}>
                <input style={styles.input} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder={mode === 'chat' ? "Message..." : "Topic for debate..."} autoFocus />
                <button style={styles.btn} onClick={handleSend}>Send</button>
            </div>

            {/* CORRECTION MODAL (Same as before) */}
            {correctionTarget && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modal}>
                        <h3 style={{color:'#ff9800', marginTop:0}}>Correction</h3>
                        <div style={styles.readOnlyBox}>{correctionTarget.relatedPrompt}</div>
                        <div style={styles.readOnlyBox}>{correctionTarget.text}</div>
                        <textarea style={{width:'100%', height:'80px', background:'#000', color:'#fff', padding:'10px', border:'1px solid #4caf50', marginBottom:'10px'}} value={betterResponse} onChange={e => setBetterResponse(e.target.value)} />
                        <div style={{display:'flex', gap:'10px', justifyContent:'flex-end'}}>
                            <button onClick={() => setCorrectionTarget(null)} style={{...styles.btn, background:'#333'}}>Cancel</button>
                            <button onClick={submitCorrection} style={styles.btn}>Submit</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dojo;
