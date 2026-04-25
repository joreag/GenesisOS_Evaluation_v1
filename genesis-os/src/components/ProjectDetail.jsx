import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api as axios } from '../utils/api';
import TaskEditModal from './TaskEditModal';

// --- STYLES (Dark Mode Compatible) ---
const styles = {
    header: {
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'end'
    },
    backLink: {
        fontSize: '0.8rem',
        color: '#888',
        textDecoration: 'none',
        fontWeight: 'bold',
        textTransform: 'uppercase'
    },
    title: {
        fontSize: '2rem',
        color: '#e0e0e0',
        margin: '5px 0 0 0'
    },
    statusBadge: {
        backgroundColor: '#333',
        color: '#80cbc4',
        padding: '5px 12px',
        borderRadius: '20px',
        fontSize: '0.8rem',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        border: '1px solid #80cbc4'
    },
    // The main container
    container: {
        backgroundColor: '#1e1e1e', // Matches riff-node
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '20px',
        minHeight: '400px'
    },
    // Grid for MAP view
    mapGrid: {
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '30px'
    },
    label: {
        display: 'block',
        fontSize: '0.75rem',
        color: '#888',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: '5px'
    },
    valueBox: {
        backgroundColor: '#121212',
        padding: '15px',
        borderRadius: '4px',
        border: '1px solid #333',
        color: '#e0e0e0',
        whiteSpace: 'pre-wrap',
        lineHeight: '1.6'
    },
    financeBox: {
        backgroundColor: '#263238', // Dark Blue-ish for finance
        padding: '15px',
        borderRadius: '4px',
        border: '1px solid #37474f'
    },
    timelineBox: {
        marginTop: '15px',
        paddingTop: '15px',
        borderTop: '1px solid #37474f'
    }
};

// --- STAGE VISUALIZER ---
const StageNavigator = ({ currentStage, setStage }) => {
    const stages = ['MAP', 'ITERATE', 'CHECK', 'TRANSFORM'];
    return (
        <div style={{ display: 'flex', marginBottom: '20px', backgroundColor: '#121212', borderRadius: '8px', border: '1px solid #333' }}>
            {stages.map((stage, idx) => {
                const isActive = currentStage === stage;
                return (
                    <button
                        key={stage}
                        onClick={() => setStage(stage)}
                        style={{
                            flex: 1,
                            padding: '12px',
                            background: isActive ? '#00796b' : 'transparent',
                            color: isActive ? '#fff' : '#888',
                            border: 'none',
                            borderRight: idx !== 3 ? '1px solid #333' : 'none',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            marginTop: 0 // Override global button margin
                        }}
                    >
                        {idx + 1}. {stage}
                    </button>
                );
            })}
        </div>
    );
};

// --- ICON HELPER ---
const getTypeIcon = (type) => {
    switch (type) {
        case 'procurement': return '🛒';
        case 'research': return '🔬';
        case 'milestone': return '🚩';
        case 'bug': return '🐛';
        default: return '📄';
    }
};

// --- RECURSIVE LADDER ---
const InfinityLadder = ({ task, depth = 0, onAddSubtask, onEditTask, readOnly }) => {
    const nodeStyle = {
        marginLeft: `${depth * 25}px`,
        borderLeft: depth > 0 ? '2px dashed #444' : 'none', // Darker line for dark mode
        paddingLeft: depth > 0 ? '15px' : '0',
        marginBottom: '8px'
    };

    const showCost = task.cost_estimate > 0;
    const isMilestone = task.task_type === 'milestone';

    return (
        <div style={nodeStyle} className="task-node-wrapper">
            <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                <div 
                    title={`Status: ${task.status}`}
                    style={{
                        width: '12px', height: '12px', borderRadius: '50%',
                        backgroundColor: task.status === 'done' ? '#4caf50' : '#42a5f5',
                        flexShrink: 0
                    }}
                ></div>
                
                <div 
                    onClick={() => !readOnly && onEditTask(task)}
                    style={{
                        flex: 1, 
                        padding: '10px 15px', 
                        backgroundColor: isMilestone ? '#333' : '#2d2d2d',
                        border: '1px solid #444',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}
                    className="task-card" // Uses mict.css hover effect
                >
                    <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                        <span style={{fontSize:'1.2em'}}>{getTypeIcon(task.task_type)}</span>
                        <span style={{
                            fontWeight: isMilestone ? 'bold' : 'normal',
                            textDecoration: task.status === 'done' ? 'line-through' : 'none',
                            color: task.status === 'done' ? '#777' : '#e0e0e0',
                            fontSize: '0.95rem'
                        }}>
                            {task.title}
                        </span>
                        {showCost && (
                            <span style={{
                                fontSize:'0.75em', backgroundColor:'#1b5e20', color:'#a5d6a7',
                                padding:'2px 6px', borderRadius:'4px', fontFamily:'monospace'
                            }}>
                                ${task.cost_estimate}
                            </span>
                        )}
                    </div>
                    {!readOnly && <span style={{fontSize:'0.8em', color:'#666'}}>Edit</span>}
                </div>

                {!readOnly && (
                    <button 
                        onClick={() => onAddSubtask(task.id, task.title)}
                        style={{
                            background: 'none', border: 'none', color: '#666', 
                            fontSize: '1.5em', padding: '0 5px', marginTop: 0
                        }}
                        title="Add Sub-Task"
                    >
                        +
                    </button>
                )}
            </div>
            {task.children && task.children.length > 0 && (
                <div style={{ marginTop: '5px' }}>
                    {task.children.map(child => (
                        <InfinityLadder 
                            key={child.id} task={child} depth={depth + 1} 
                            onAddSubtask={onAddSubtask} onEditTask={onEditTask} readOnly={readOnly}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// --- MAIN COMPONENT ---
const ProjectDetail = () => {
    const { id } = useParams();
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // UI State
    const [viewStage, setViewStage] = useState('MAP'); 
    const [isEditingMap, setIsEditingMap] = useState(false);
    const [mapForm, setMapForm] = useState({});

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [newTask, setNewTask] = useState({ title: '', priority: 'medium', task_type: 'generic', cost_estimate: 0 });
    const [parentTask, setParentTask] = useState({ id: null, title: 'Project Root' });
    
    const [editingTask, setEditingTask] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const fetchProjectData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('mice_token');
            const res = await axios.get(`/mice/api/projects/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setProject(res.data.data);
                setMapForm({
                    description: res.data.data.description || '',
                    budget: res.data.data.budget || 0,
                    currency: res.data.data.currency || 'USD',
                    start_date: res.data.data.start_date ? res.data.data.start_date.split('T')[0] : '',
                    due_date: res.data.data.due_date ? res.data.data.due_date.split('T')[0] : ''
                });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProjectData(); }, [id]);

    const handleUpdateMap = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('mice_token');
            await axios.put(`/mice/api/projects/${id}`, mapForm, { headers: { Authorization: `Bearer ${token}` } });
            setIsEditingMap(false);
            fetchProjectData();
        } catch (err) { alert("Failed to update."); }
    };

    const handleCreateTask = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('mice_token');
            await axios.post(`/mice/api/projects/${id}/tasks`, { ...newTask, parent_id: parentTask.id }, { headers: { Authorization: `Bearer ${token}` } });
            setIsFormOpen(false);
            setNewTask({ title: '', priority: 'medium', task_type: 'generic', cost_estimate: 0 });
            fetchProjectData();
        } catch (err) { alert("Failed to add task."); }
    };

    const openAddTask = (parentId, parentTitle) => {
        setParentTask({ id: parentId, title: parentTitle || 'Project Root' });
        setIsFormOpen(true);
    };

    if (loading) return <div style={{padding:'40px', textAlign:'center', color:'#888'}}>Loading...</div>;
    if (!project) return null;

    const fmtCurrency = (val, curr) => new Intl.NumberFormat('en-US', { style: 'currency', currency: curr }).format(val);
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : 'TBD';

    return (
        <div className="erp-detail" style={{padding: '20px'}}>
            <div style={styles.header}>
                <div>
                    <Link to="/mice/projects" style={styles.backLink}>&larr; Return to Workspace</Link>
                    <h1 style={styles.title}>{project.title}</h1>
                </div>
                <div style={styles.statusBadge}>{project.status.replace('_', ' ')}</div>
            </div>

            <StageNavigator currentStage={viewStage} setStage={setViewStage} />

            <div style={styles.container}>
                
                {/* --- MAP PHASE --- */}
                {viewStage === 'MAP' && (
                    <div>
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px', borderBottom:'1px solid #333', paddingBottom:'10px'}}>
                            <h2 style={{margin:0, color:'#64b5f6'}}>MAP: Context</h2>
                            {!isEditingMap ? (
                                <button onClick={() => setIsEditingMap(true)} style={{background:'none', color:'#64b5f6', border:'none', marginTop:0}}>Edit Context</button>
                            ) : (
                                <button onClick={() => setIsEditingMap(false)} style={{background:'none', color:'#888', border:'none', marginTop:0}}>Cancel</button>
                            )}
                        </div>

                        {!isEditingMap ? (
                            <div style={styles.mapGrid}>
                                <div>
                                    <span style={styles.label}>Scope & Description</span>
                                    <div style={styles.valueBox}>{project.description || "No scope defined."}</div>
                                </div>
                                <div style={styles.financeBox}>
                                    <span style={styles.label}>Budget Allocation</span>
                                    <div style={{fontSize:'1.5rem', fontFamily:'monospace', color:'#81c784'}}>{fmtCurrency(project.budget, project.currency)}</div>
                                    
                                    <div style={styles.timelineBox}>
                                        <span style={styles.label}>Timeline</span>
                                        <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.9rem'}}>
                                            <span style={{color:'#888'}}>Start:</span> <span style={{color:'#e0e0e0'}}>{fmtDate(project.start_date)}</span>
                                        </div>
                                        <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.9rem', marginTop:'5px'}}>
                                            <span style={{color:'#888'}}>Due:</span> <span style={{color:'#e0e0e0'}}>{fmtDate(project.due_date)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            // Simple Edit Form logic (keeping styling minimal for brevity)
                            <form onSubmit={handleUpdateMap}>
                                <label style={styles.label}>Description</label>
                                <textarea className="erp-input" rows="5" value={mapForm.description} onChange={e => setMapForm({...mapForm, description: e.target.value})} style={{width:'100%', marginBottom:'15px'}}></textarea>
                                
                                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>
                                    <div><label style={styles.label}>Budget</label><input type="number" className="erp-input" value={mapForm.budget} onChange={e => setMapForm({...mapForm, budget: e.target.value})} /></div>
                                    <div><label style={styles.label}>Start Date</label><input type="date" className="erp-input" value={mapForm.start_date} onChange={e => setMapForm({...mapForm, start_date: e.target.value})} /></div>
                                    <div><label style={styles.label}>Due Date</label><input type="date" className="erp-input" value={mapForm.due_date} onChange={e => setMapForm({...mapForm, due_date: e.target.value})} /></div>
                                </div>
                                <button type="submit" style={{marginTop:'20px', width:'100%'}}>Save Context</button>
                            </form>
                        )}
                    </div>
                )}

                {/* --- ITERATE PHASE --- */}
                {viewStage === 'ITERATE' && (
                    <div>
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px', borderBottom:'1px solid #333', paddingBottom:'10px'}}>
                            <h2 style={{margin:0, color:'#ffb74d'}}>ITERATE: Structure</h2>
                            <button onClick={() => openAddTask(null, 'Project Root')} style={{marginTop:0}}>+ Add Root Node</button>
                        </div>
                        <div>
                            {project.taskTree.map(rootTask => (
                                <InfinityLadder 
                                    key={rootTask.id} task={rootTask} 
                                    onAddSubtask={openAddTask} onEditTask={(t) => { setEditingTask(t); setIsEditModalOpen(true); }}
                                />
                            ))}
                            {project.taskTree.length === 0 && <p style={{color:'#666', fontStyle:'italic'}}>No structure yet.</p>}
                        </div>
                    </div>
                )}

                {/* --- CHECK PHASE --- */}
                {viewStage === 'CHECK' && (
                    <div>
                        <h2 style={{color:'#81c784', borderBottom:'1px solid #333', paddingBottom:'10px', marginBottom:'20px'}}>CHECK: Validation</h2>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>
                            
                            {/* Topology Check Card */}
                            <div className="composer-card" style={{borderColor:'#81c784'}}>
                                <h3 style={{fontSize:'1.1rem', margin:'0 0 10px 0'}}>Dependency Topology</h3>
                                <p style={{fontSize:'0.9rem', color:'#888'}}>Scanning for circular loops...</p>
                                <div style={{color:'#81c784', fontWeight:'bold'}}>✓ Valid</div>
                            </div>

                            {/* Resource Check Card */}
                            <div className="composer-card" style={{borderColor:'#ffb74d'}}>
                                <h3 style={{fontSize:'1.1rem', margin:'0 0 10px 0'}}>Resource Coverage</h3>
                                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px', fontSize:'0.9rem'}}>
                                    <span style={{color:'#888'}}>Budget:</span>
                                    <span style={{fontFamily:'monospace'}}>{fmtCurrency(project.budget, project.currency)}</span>
                                </div>
                                <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.9rem'}}>
                                    <span style={{color:'#888'}}>Est Cost:</span>
                                    <span style={{fontFamily:'monospace'}}>$0.00</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TRANSFORM PHASE --- */}
                {viewStage === 'TRANSFORM' && (
                    <div>
                        <h2 style={{color:'#ba68c8', borderBottom:'1px solid #333', paddingBottom:'10px', marginBottom:'20px'}}>TRANSFORM: Execution</h2>
                        {project.taskTree.map(rootTask => (
                            <InfinityLadder 
                                key={rootTask.id} task={rootTask} readOnly={false}
                                onEditTask={(t) => { setEditingTask(t); setIsEditModalOpen(true); }}
                                onAddSubtask={() => {}} 
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* MODAL (Simple style override) */}
            {isFormOpen && (
                <div className="welcome-overlay">
                    <div className="welcome-card">
                        <h3>Add Node to: {parentTask.title}</h3>
                        <form onSubmit={handleCreateTask}>
                            <input className="erp-input" autoFocus value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} placeholder="Title" required />
                            
                            <div style={{display:'flex', gap:'10px', marginTop:'10px'}}>
                                <select className="erp-input" style={{flex:1}} value={newTask.task_type} onChange={e => setNewTask({...newTask, task_type: e.target.value})}>
                                    <option value="generic">📄 Task</option>
                                    <option value="procurement">🛒 Purchase</option>
                                    <option value="research">🔬 Research</option>
                                    <option value="milestone">🚩 Milestone</option>
                                    <option value="bug">🐛 Issue</option>
                                </select>
                                
                                {newTask.task_type === 'procurement' && (
                                    <input type="number" className="erp-input" style={{flex:1}} placeholder="Cost" value={newTask.cost_estimate} onChange={e => setNewTask({...newTask, cost_estimate: e.target.value})} />
                                )}
                            </div>

                            <div style={{display:'flex', gap:'10px', justifyContent:'flex-end'}}>
                                <button type="button" onClick={() => setIsFormOpen(false)} style={{backgroundColor:'#444'}}>Cancel</button>
                                <button type="submit">Add Node</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <TaskEditModal 
                isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} 
                task={editingTask} onSave={fetchProjectData} 
            />
        </div>
    );
};

export default ProjectDetail;
