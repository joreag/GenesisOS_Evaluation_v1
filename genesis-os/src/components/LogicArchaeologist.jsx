import React, { useState, useRef, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { discoverLogic } from '../utils/DiscoveryEngine'; // Local Logic

const styles = {
    container: { height: '100%', display: 'flex', flexDirection: 'column', padding: '20px', color: '#e0e0e0', background: '#0a0a0a' },
    header: { display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '10px' },
    grid: { display: 'grid', gridTemplateColumns: '300px 1fr 300px', gap: '20px', flex: 1, overflow: 'hidden' },
    panel: { background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '15px', overflowY: 'auto' },
    panelTitle: { color: '#80cbc4', borderBottom: '1px solid #444', paddingBottom: '5px', marginBottom: '10px', fontSize: '0.9em', fontWeight: 'bold' },
    
    // Items
    varItem: { fontSize: '0.8em', padding: '5px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between' },
    logicItem: { fontSize: '0.8em', padding: '8px', background: '#222', marginBottom: '5px', borderRadius: '4px', borderLeft: '3px solid #555' },
    
    // Inputs
    input: { background: '#222', border: '1px solid #444', color: '#fff', padding: '5px', borderRadius: '4px' },
    btn: { background: '#8e44ad', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }
};

const LogicArchaeologist = () => {
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [strategy, setStrategy] = useState('cpp');
    
    // Handle File Upload
    const handleFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        setLoading(true);
        const reader = new FileReader();
        
        reader.onload = async (event) => {
            const text = event.target.result;
            
            // RUN ENGINE (Local)
            try {
                const result = await discoverLogic(text, strategy);
                processResults(result.finalOutput);
            } catch (err) {
                alert("Analysis Failed: " + err.message);
            }
            setLoading(false);
        };
        
        reader.readAsText(file);
    };

    // Transform Analysis to Graph Data
    const processResults = (data) => {
        setAnalysis(data);
        
        const nodes = [];
        const links = [];
        
        // 1. Add Variables as Nodes
        Object.values(data.data_dictionary).forEach(v => {
            nodes.push({ id: v.name, group: 'variable', val: 5 });
        });

        // 2. Add Dependencies as Links
        Object.entries(data.dependency_graph).forEach(([target, sources]) => {
            sources.forEach(source => {
                links.push({ source: source, target: target });
            });
        });

        setGraphData({ nodes, links });
    };

    return (
        <div style={styles.container}>
            {/* HEADER */}
            <div style={styles.header}>
                <div>
                    <h2 style={{margin:0}}>Logic Archaeologist <span style={{fontSize:'0.6em', color:'#666'}}>v7.0</span></h2>
                    <span style={{fontSize:'0.7em', color:'#888'}}>Legacy Code - Logic Extraction</span>
                </div>
                
                <div style={{display:'flex', gap:'10px'}}>
                    <select style={styles.input} value={strategy} onChange={e => setStrategy(e.target.value)}>
                        <option value="cpp">C++ / Polyglot</option>
                        <option value="dna">Genomic (DNA)</option>
                    </select>
                    <input type="file" style={styles.input} onChange={handleFile} />
                </div>
            </div>

            {/* DASHBOARD */}
            <div style={styles.grid}>
                
                {/* COL 1: DATA DICTIONARY */}
                <div style={styles.panel}>
                    <div style={styles.panelTitle}>DATA DICTIONARY</div>
                    {analysis ? Object.values(analysis.data_dictionary).map((v, i) => (
                        <div key={i} style={styles.varItem}>
                            <span style={{color:'#4caf50'}}>{v.name}</span>
                            <span style={{color:'#888'}}>{v.type}</span>
                        </div>
                    )) : <div style={{color:'#666'}}>Waiting for artifact...</div>}
                </div>

                {/* COL 2: VISUALIZER */}
                <div style={{...styles.panel, padding:0, background:'#000'}}>
                    {loading ? <div style={{padding:'20px', color:'#fff'}}>Scanning...</div> : 
                        <ForceGraph2D 
                            graphData={graphData}
                            nodeAutoColorBy="group"
                            nodeLabel="id"
                            linkDirectionalParticles={2}
                        />
                    }
                </div>

                {/* COL 3: LOGIC FLOW & SECURITY */}
                <div style={styles.panel}>
                    <div style={styles.panelTitle}>LOGIC FLOW</div>
                    {analysis && analysis.business_logic.map((block, i) => (
                        <div key={i} style={{...styles.logicItem, borderLeftColor: block.type === 'LOGIC_BLOCK' ? '#ff9800' : '#2196f3'}}>
                            {block.type === 'LOGIC_BLOCK' ? (
                                <div>
                                    <strong>IF</strong> {block.condition}
                                    <div style={{paddingLeft:'10px', marginTop:'5px', color:'#aaa'}}>
                                        {block.actions.length} actions
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    {block.type === 'UPDATE_STATE' ? `SET ${block.variable}` : `EXEC ${block.command}`}
                                </div>
                            )}
                        </div>
                    ))}

                    {/* SECURITY ALERTS */}
                    {analysis && analysis.security_findings.length > 0 && (
                        <div style={{marginTop:'20px'}}>
                            <div style={{...styles.panelTitle, color:'#ff5252'}}>VULNERABILITIES</div>
                            {analysis.security_findings.map((vuln, i) => (
                                <div key={i} style={{background:'#260000', padding:'5px', color:'#ff8a80', fontSize:'0.8em', marginBottom:'5px', borderRadius:'4px'}}>
                                    [LINE {vuln.line}] {vuln.reason}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default LogicArchaeologist;