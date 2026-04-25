import React, { useState, useEffect, useRef } from 'react';
//import axios from 'axios';
import { api as axios } from '../utils/api';

// --- STYLES ---
const theme = {
    map: '#2196f3',
    iterate: '#ff9800',
    check: '#f44336',
    transform: '#4caf50',
    bg: '#1e1e1e',
    panel: '#121212',
    text: '#e0e0e0'
};

const styles = {
    container: { padding: '20px', maxWidth: '1200px', margin: '0 auto', color: theme.text },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid #333', paddingBottom: '15px' },
    grid: { display: 'grid', gridTemplateColumns: '300px 1fr', gap: '30px' },
    sidebar: { display: 'flex', flexDirection: 'column', gap: '15px' },
    studyCard: { background: theme.bg, border: '1px solid #333', padding: '15px', borderRadius: '8px', cursor: 'pointer', transition: '0.2s' },
    stageBadge: { fontSize: '0.7em', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', float: 'right' },
    
    // THE FLOW UI
    flowContainer: { display: 'flex', flexDirection: 'column', gap: '20px' },
    historyCard: { background: '#111', borderLeft: '4px solid #444', padding: '15px', borderRadius: '0 8px 8px 0', opacity: 0.8 },
    activeCard: { background: theme.bg, border: '1px solid #555', padding: '25px', borderRadius: '8px', boxShadow: '0 5px 20px rgba(0,0,0,0.3)' },
    
    label: { display: 'block', marginBottom: '10px', fontWeight: 'bold', fontSize: '0.9em', letterSpacing: '1px' },
    textArea: { width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '15px', minHeight: '120px', borderRadius: '4px', fontFamily: 'monospace', lineHeight: '1.5' },
    btn: { background: '#333', color: '#fff', border: '1px solid #555', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', marginRight: '10px' },
    primaryBtn: { background: theme.transform, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
    
    artifactRow: { display: 'flex', alignItems: 'center', gap: '10px', background: '#222', padding: '8px', marginTop: '5px', borderRadius: '4px', fontSize: '0.9em' }
};

const STAGES = ['MAP', 'ITERATE', 'CHECK', 'TRANSFORM'];

const ResearchLab = () => {
    const [studies, setStudies] = useState([]);
    const [activeStudy, setActiveStudy] = useState(null);
    const [artifacts, setArtifacts] = useState([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);


    // --- DATA LOADING ---
    const loadData = async () => {
        const token = localStorage.getItem('mice_token');
        const res = await axios.get('https://boredbrains.net/mice/api/research', { headers: { Authorization: `Bearer ${token}` } });
        if (res.data.success) setStudies(res.data.data);
    };

    const loadDetails = async (id) => {
        const token = localStorage.getItem('mice_token');
        const res = await axios.get(`https://boredbrains.net/mice/api/research/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.data.success) {
            setActiveStudy(res.data.study);
            setArtifacts(res.data.artifacts);
        }
    };

    useEffect(() => { loadData(); }, []);

    // --- ACTIONS ---
    const handleUpdate = async (updates) => {
        const token = localStorage.getItem('mice_token');
        await axios.put(`https://boredbrains.net/mice/api/research/${activeStudy.id}/stage`, updates, { headers: { Authorization: `Bearer ${token}` } });
        loadDetails(activeStudy.id); // Refresh
        loadData(); // Refresh List
    };

    const advanceStage = () => {
        const idx = STAGES.indexOf(activeStudy.stage);
        if (idx < STAGES.length - 1) handleUpdate({ stage: STAGES[idx + 1] });
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);

        const token = localStorage.getItem('mice_token');
        const formData = new FormData();
        formData.append('evidence', file); // Matches uploadController

        try {
            // 1. Upload File
            const uploadRes = await axios.post('https://boredbrains.net/mice/api/community/upload', formData, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
            });

            // 2. Link to Study
            await axios.post('https://boredbrains.net/mice/api/research/artifact', {
                studyId: activeStudy.id,
                type: 'file',
                content: uploadRes.data.url, // The path returned by uploadController
                description: file.name,
                stage: activeStudy.stage
            }, { headers: { Authorization: `Bearer ${token}` } });

            loadDetails(activeStudy.id);
        } catch (err) { alert("Upload failed"); } finally { setUploading(false); }
    };

    const handleCreate = async () => {
        const title = prompt("New Research Topic:");
        if (title) {
            const token = localStorage.getItem('mice_token');
            const res = await axios.post('https://boredbrains.net/mice/api/research', { title, hypothesis: "" }, { headers: { Authorization: `Bearer ${token}` } });
            loadData();
            loadDetails(res.data.id);
        }
    };

    const handleGraduate = async () => {
        if (!window.confirm("Graduate this study to an Active Project?")) return;
        const token = localStorage.getItem('mice_token');
        const res = await axios.post(`https://boredbrains.net/mice/api/research/${activeStudy.id}/graduate`, {}, { headers: { Authorization: `Bearer ${token}` } });
        if(res.data.success) navigate(`/mice/projects/${res.data.projectId}`);
    };

// Add this inside the component function
    const runSimulation = async () => {
        if (!activeStudy) return;
        
        // Simple loading feedback
        const confirmRun = window.confirm("Run Kernel Simulation? This will stress the CPU.");
        if (!confirmRun) return;

        try {
            // Call the Shim
            const res = await axios.post('/api/research/simulate', { type: 'elastic' });
            
            if (res.data.success) {
                // The result string from Rust
                const report = res.data.result; 
                alert(report);
                
                // Save it to the Conclusion field so we can see it
                handleUpdate({ conclusion: report });
                // Or update hypothesis if you prefer
                // handleUpdate({ hypothesis: activeStudy.hypothesis + "\n\n" + report });
            }
        } catch (e) { alert("Sim failed: " + e.message); }
    };

    // --- RENDER HELPERS ---
    
    // Renders a read-only history block
    const HistoryBlock = ({ title, content, color, stageFilter }) => {
        const stageArtifacts = artifacts.filter(a => a.description === stageFilter || a.type === 'file'); // loose filtering for now
        
        return (
            <div style={{...styles.historyCard, borderLeftColor: color}}>
                <div style={{color, fontWeight:'bold', marginBottom:'5px'}}>{title}</div>
                <div style={{whiteSpace:'pre-wrap', color:'#bbb', fontSize:'0.9rem'}}>{content || "No data recorded."}</div>
                {/* Show artifacts attached to this stage */}
                {stageArtifacts.length > 0 && (
                    <div style={{marginTop:'10px', borderTop:'1px solid #333', paddingTop:'5px'}}>
                        {stageArtifacts.map(a => (
                            <div key={a.id} style={styles.artifactRow}>
                                <span>📎</span>
                                <a href={`https://boredbrains.net/mice${a.file_path}`} target="_blank" rel="noreferrer" style={{color: color, textDecoration:'none'}}>
                                    {a.description}
                                </a>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // --- MAIN RENDER ---
    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2 style={{margin:0, color: theme.text}}>🔬 The Lab</h2>
                <button style={styles.btn} onClick={handleCreate}>+ New Study</button>
            </div>

            <div style={styles.grid}>
                {/* LEFT: LIST */}
                <div style={styles.sidebar}>
                    {studies.map(s => {
                        // SAFETY: Fallback to 'MAP' if stage is null/undefined
                        const safeStage = (s.stage || 'MAP').toLowerCase();
                        const borderColor = activeStudy?.id === s.id ? theme[safeStage] : '#333';
                        const badgeColor = theme[safeStage] || '#666';

                        return (
                            <div key={s.id} onClick={() => loadDetails(s.id)} style={{
                                ...styles.studyCard,
                                borderColor: borderColor
                            }}>
                                <span style={{...styles.stageBadge, background: badgeColor, color:'#fff'}}>
                                    {s.stage || 'MAP'}
                                </span>
                                <div style={{fontWeight:'bold', marginTop:'5px'}}>{s.title}</div>
                                <div style={{fontSize:'0.8em', color:'#888', marginTop:'5px'}}>
                                    {new Date(s.updated_at).toLocaleDateString()}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* RIGHT: FLOW WORKSPACE */}
                {activeStudy ? (
                    <div style={styles.flowContainer}>
                        
                        {/* 1. MAP HISTORY (Always visible if past MAP) */}
                        {(activeStudy.stage !== 'MAP') && (
                            <HistoryBlock 
                                title="MAP // Context & Hypothesis" 
                                content={activeStudy.hypothesis} 
                                color={theme.map} 
                                stageFilter="MAP"
                            />
                        )}

                        {/* 2. ITERATE HISTORY */}
                        {(activeStudy.stage === 'CHECK' || activeStudy.stage === 'TRANSFORM') && (
                            <HistoryBlock 
                                title="ITERATE // Experiments" 
                                content="Simulation data processed..." 
                                color={theme.iterate} 
                                stageFilter="ITERATE"
                            />
                        )}

                        {/* 3. ACTIVE WORKSPACE */}
                        <div style={{
                            ...styles.activeCard, 
                            borderColor: theme[(activeStudy.stage || 'MAP').toLowerCase()] || '#333'
                        }}>
                            <h3 style={{marginTop:0, color: theme[(activeStudy.stage || 'MAP').toLowerCase()] || '#ccc'}}>
                                Current Cycle: {activeStudy.stage || 'MAP'}
                            </h3>

                            {/* DYNAMIC INPUTS BASED ON STAGE */}
                            
                            {activeStudy.stage === 'MAP' && (
                                <>
                                    <label style={styles.label}>Define Hypothesis & Context</label>
                                    <textarea 
                                        style={styles.textArea}
                                        value={activeStudy.hypothesis || ""}
                                        onChange={e => setActiveStudy({...activeStudy, hypothesis: e.target.value})}
                                        onBlur={e => handleUpdate({hypothesis: e.target.value})}
                                        placeholder="What are we trying to prove?"
                                    />
                                </>
                            )}

                            {activeStudy.stage === 'ITERATE' && (
                                <>
                                    <p style={{color:'#aaa'}}>Run your experiments. Upload screenshots, logs, or scripts.</p>
                                    {/* Iteration logs could go here in a future update */}
                                    <div style={{marginTop: '20px', padding: '15px', background: '#222', borderRadius: '8px', border: '1px dashed #444'}}>
                                        <h4 style={{marginTop:0, color:'#ff9800'}}>🧪 Kernel Simulation</h4>
                                        <p style={{fontSize:'0.8em', color:'#888'}}>Run Krapivin Benchmark (Standard vs. Elastic Hashing)</p>
                                        <button 
                                            style={{...styles.btn, background: '#ff9800', color: '#000', fontWeight: 'bold'}} 
                                            onClick={runSimulation}
                                        >
                                            Run Benchmark
                                        </button>
                                    </div>
                                    {/* ----------------------------- */}
                                </>
                            )}

                            {activeStudy.stage === 'CHECK' && (
                                <>
                                    <label style={styles.label}>Validation & Results</label>
                                    <textarea 
                                        style={styles.textArea}
                                        value={activeStudy.conclusion || ""} // Using conclusion field for results temporarily
                                        onChange={e => setActiveStudy({...activeStudy, conclusion: e.target.value})}
                                        onBlur={e => handleUpdate({conclusion: e.target.value})}
                                        placeholder="Did the experiments support the hypothesis?"
                                    />
                                </>
                            )}

                            {activeStudy.stage === 'TRANSFORM' && (
                                <>
                                    <label style={styles.label}>Final Synthesis</label>
                                    <textarea 
                                        style={styles.textArea}
                                        value={activeStudy.conclusion || ""}
                                        onChange={e => setActiveStudy({...activeStudy, conclusion: e.target.value})}
                                        onBlur={e => handleUpdate({conclusion: e.target.value})}
                                        placeholder="Summary for implementation..."
                                    />
                                    <div style={{marginTop:'20px', textAlign:'right'}}>
                                        <button style={styles.primaryBtn} onClick={handleGraduate}>Graduate to Project</button>
                                    </div>
                                </>
                            )}

                            {/* UNIVERSAL ACTIONS */}
                            <div style={{marginTop: '20px', display:'flex', gap:'10px', alignItems:'center', borderTop:'1px solid #333', paddingTop:'15px'}}>
                                <input type="file" ref={fileInputRef} style={{display:'none'}} onChange={handleFileUpload} />
                                <button style={styles.btn} onClick={() => fileInputRef.current.click()}>
                                    {uploading ? "Uploading..." : "📎 Upload Artifact"}
                                </button>
                                
                                {activeStudy.stage !== 'TRANSFORM' && (
                                    <button style={{...styles.btn, marginLeft:'auto', background: theme[activeStudy.stage.toLowerCase()], border:'none'}} onClick={advanceStage}>
                                        Next Phase &rarr;
                                    </button>
                                )}
                            </div>
                            
                            {/* CURRENT STAGE ARTIFACTS LIST */}
                            <div style={{marginTop: '15px'}}>
                                {artifacts.map(a => (
                                    <div key={a.id} style={styles.artifactRow}>
                                        <span>📄</span>
                                        <a href={`https://boredbrains.net/mice${a.file_path}`} target="_blank" rel="noreferrer" style={{color:'#80cbc4'}}>
                                            {a.description}
                                        </a>
                                        <span style={{fontSize:'0.8em', color:'#666', marginLeft:'10px'}}>({new Date(a.uploaded_at).toLocaleDateString()})</span>
                                    </div>
                                ))}
                            </div>

                        </div>
                    </div>
                ) : (
                    <div style={{display:'flex', alignItems:'center', justifyContent:'center', color:'#555', border:'1px dashed #333', borderRadius:'8px'}}>
                        Select a study to enter the lab.
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResearchLab;
