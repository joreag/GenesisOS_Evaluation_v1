import React, { useState, useEffect, useRef } from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

const styles = {
    container: { display: 'flex', gap: '20px', height: '100%', padding: '20px', background: '#0a0a0a', color: '#e0e0e0', overflowY: 'auto' },
    panel: { flex: 1, background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column' },
    title: { color: '#ffb74d', marginTop: 0, borderBottom: '1px solid #333', paddingBottom: '10px' },
    row: { display: 'flex', flexWrap: 'wrap', gap: '15px', marginBottom: '15px' },
    inputGroup: { flex: '1 1 200px', display: 'flex', flexDirection: 'column' },
    label: { fontSize: '0.85em', color: '#888', marginBottom: '5px', fontWeight: 'bold' },
    input: { background: '#222', border: '1px solid #444', color: '#fff', padding: '10px', borderRadius: '4px', outline: 'none' },
    select: { background: '#222', border: '1px solid #444', color: '#fff', padding: '10px', borderRadius: '4px', outline: 'none' },
    btnPrimary: { background: '#ff9800', color: '#000', border: 'none', padding: '12px 20px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginTop: '15px' },
    btnSecondary: { background: 'transparent', color: '#80cbc4', border: '1px solid #80cbc4', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9em', alignSelf: 'flex-start' },
    gauges: { display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '20px' },
    gaugeBox: { width: '150px', textAlign: 'center' },
    logBox: { flex: 1, background: '#000', border: '1px solid #333', borderRadius: '4px', padding: '15px', fontFamily: 'monospace', fontSize: '0.85em', color: '#0f0', overflowY: 'auto', whiteSpace: 'pre-wrap' }
};

const EasyBakeApp = () => {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isForging, setIsForging] = useState(false);
    
    // Default to the user's home directory forge setup
    const [forgePath, setForgePath] = useState('~/ulshe_ai_forge'); 
    
    // --- STATE PERFECTLY ALIGNED WITH build_engine.py ---
    const [config, setConfig] = useState({
        arch_type: 'standard', // Options: 'standard', 'pascal'
        curriculum_dir: 'curriculum',
        output_dir: 'data/output_model',
        epochs: 30,
        batch_size: 32,
        learning_rate: 0.0001,
        max_seq_length: 256,
        d_model: 512,
        nhead: 8,
        num_encoder_layers: 6,
        num_decoder_layers: 6,
        dim_feedforward: 2048
    });
 
    const [loss, setLoss] = useState(0);
    const [speed, setSpeed] = useState(0);
    const [logs, setLogs] = useState("Welcome! Configure your build and click 'Forge AI' to begin.\n");
    const logEndRef = useRef(null);

    // Auto-scroll logs
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    useEffect(() => {
        let unlistenLog, unlistenLoss, unlistenSpeed, unlistenStatus;

        const setupListeners = async () => {
            unlistenLog = await listen('forge-log', (event) => setLogs(prev => prev + event.payload + '\n'));
            
            unlistenLoss = await listen('forge-telemetry-loss', (event) => {
                const lossVal = parseFloat(event.payload);
                if (!isNaN(lossVal)) setLoss(lossVal);
            });

            unlistenSpeed = await listen('forge-telemetry-speed', (event) => {
                const speedVal = parseFloat(event.payload);
                if (!isNaN(speedVal)) setSpeed(speedVal);
            });

            unlistenStatus = await listen('forge-status', (event) => {
                setIsForging(false);
                setLogs(prev => prev + `\n[SYSTEM] Forge Process ${event.payload}.\n`);
                if (event.payload === 'COMPLETE') { setLoss(0); setSpeed(0); }
            });
        };

        setupListeners();

        return () => {
            if (unlistenLog) unlistenLog();
            if (unlistenLoss) unlistenLoss();
            if (unlistenSpeed) unlistenSpeed();
            if (unlistenStatus) unlistenStatus();
        };
    }, []);

    const handleInputChange = (e) => {
        const { id, value, type } = e.target;
        // Strict casting for Rust serialization
        const parsedValue = type === 'number' ? (value === '' ? '' : parseFloat(value)) : value;
        setConfig(prev => ({ ...prev, [id]: parsedValue }));
    };

    const startForge = async () => {
        setIsForging(true);
        setLogs(`\n[SYSTEM] Initiating Full Engine Pipeline...\nTarget: ${forgePath}\n`);
        setLoss(0); setSpeed(0);

        try {
            await invoke('spawn_easy_bake', { config, forgePath });
            setLogs(prev => prev + `[SYSTEM] Process Spawned. Awaiting Telemetry...\n`);
        } catch (e) {
            setLogs(prev => prev + `[FATAL] Rust Spawner Error: ${e}\n`);
            setIsForging(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.panel}>
                <h2 style={styles.title}>Configuration</h2>
                
                <div style={{...styles.inputGroup, marginBottom: '15px'}}>
                    <label style={styles.label}>Ulshe Forge Directory Path:</label>
                    <input style={styles.input} value={forgePath} onChange={(e) => setForgePath(e.target.value)} />
                </div>

                <div style={styles.row}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Architecture:</label>
                        <select id="arch_type" style={styles.select} value={config.arch_type} onChange={handleInputChange}>
                            <option value="standard">Standard HCTS (v1)</option>
                            <option value="pascal">Pascal-Guided (Model Z)</option>
                        </select>
                    </div>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Curriculum Dir:</label>
                        <input id="curriculum_dir" style={styles.input} value={config.curriculum_dir} onChange={handleInputChange} />
                    </div>
                </div>

                <div style={styles.row}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Output Dir:</label>
                        <input id="output_dir" style={styles.input} value={config.output_dir} onChange={handleInputChange} />
                    </div>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Epochs:</label>
                        <input id="epochs" type="number" style={styles.input} value={config.epochs} onChange={handleInputChange} />
                    </div>
                </div>

                <button style={styles.btnSecondary} onClick={() => setShowAdvanced(!showAdvanced)}>
                    {showAdvanced ? "▲ Hide Advanced Settings" : "▼ Show Advanced Settings"}
                </button>

                {showAdvanced && (
                    <div style={{...styles.row, marginTop: '15px', background: '#000', padding: '15px', borderRadius: '8px'}}>
                        <div style={styles.inputGroup}><label style={styles.label}>Batch Size</label><input id="batch_size" type="number" style={styles.input} value={config.batch_size} onChange={handleInputChange} /></div>
                        <div style={styles.inputGroup}><label style={styles.label}>Learning Rate</label><input id="learning_rate" type="number" step="0.00001" style={styles.input} value={config.learning_rate} onChange={handleInputChange} /></div>
                        <div style={styles.inputGroup}><label style={styles.label}>Max Seq Length</label><input id="max_seq_length" type="number" style={styles.input} value={config.max_seq_length} onChange={handleInputChange} /></div>
                        <div style={styles.inputGroup}><label style={styles.label}>d_model</label><input id="d_model" type="number" style={styles.input} value={config.d_model} onChange={handleInputChange} /></div>
                        <div style={styles.inputGroup}><label style={styles.label}>Attn Heads</label><input id="nhead" type="number" style={styles.input} value={config.nhead} onChange={handleInputChange} /></div>
                        <div style={styles.inputGroup}><label style={styles.label}>Encoder Layers</label><input id="num_encoder_layers" type="number" style={styles.input} value={config.num_encoder_layers} onChange={handleInputChange} /></div>
                        <div style={styles.inputGroup}><label style={styles.label}>Decoder Layers</label><input id="num_decoder_layers" type="number" style={styles.input} value={config.num_decoder_layers} onChange={handleInputChange} /></div>
                        <div style={styles.inputGroup}><label style={styles.label}>Feedforward Dim</label><input id="dim_feedforward" type="number" style={styles.input} value={config.dim_feedforward} onChange={handleInputChange} /></div>
                    </div>
                )}

                <button style={{...styles.btnPrimary, opacity: isForging ? 0.5 : 1}} onClick={startForge} disabled={isForging}>
                    {isForging ? "Forging..." : "Forge AI"}
                </button>
            </div>

            <div style={styles.panel}>
                <h2 style={styles.title}>Forge Dashboard</h2>
                <div style={styles.gauges}>
                    <div style={styles.gaugeBox}>
                        <h4 style={{color: '#888', marginTop:0}}>Training Loss</h4>
                        <CircularProgressbar value={loss} maxValue={3.0} text={`${loss.toFixed(2)}`} styles={buildStyles({ pathColor: '#ff5252', textColor: '#fff', trailColor: '#333' })}/>
                    </div>
                    <div style={styles.gaugeBox}>
                        <h4 style={{color: '#888', marginTop:0}}>Speed (it/s)</h4>
                        <CircularProgressbar value={speed} maxValue={20.0} text={`${speed}`} styles={buildStyles({ pathColor: '#4caf50', textColor: '#fff', trailColor: '#333' })}/>
                    </div>
                </div>
                <div style={styles.logBox}>
                    {logs}
                    <div ref={logEndRef} />
                </div>
            </div>
        </div>
    );
};

export default EasyBakeApp;