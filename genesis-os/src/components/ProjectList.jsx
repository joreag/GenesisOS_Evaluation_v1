import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api as axios } from '../utils/api';

const styles = {
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px'
    },
    title: {
        color: '#e0e0e0',
        fontSize: '1.8rem',
        margin: 0
    },
    actions: {
        display: 'flex',
        gap: '15px'
    },
    tabGroup: {
        display: 'flex',
        backgroundColor: '#1e1e1e',
        borderRadius: '6px',
        padding: '4px',
        border: '1px solid #333'
    },
    tabBtn: {
        background: 'transparent',
        border: 'none',
        color: '#888',
        padding: '6px 15px',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '0.9rem',
        borderRadius: '4px',
        marginTop: 0
    },
    tabBtnActive: {
        background: '#333',
        color: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
    },
    createBtn: {
        backgroundColor: '#00796b',
        color: 'white',
        border: 'none',
        padding: '8px 20px',
        borderRadius: '6px',
        fontWeight: 'bold',
        cursor: 'pointer',
        marginTop: 0
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '20px'
    },
    // Card Styles
    cardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '10px'
    },
    cardTitle: {
        fontSize: '1.2rem',
        color: '#e0e0e0',
        fontWeight: 'bold',
        margin: 0,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
    },
    cardDesc: {
        color: '#888',
        fontSize: '0.9rem',
        marginBottom: '15px',
        height: '40px',
        overflow: 'hidden',
        lineHeight: '1.4'
    },
    cardFooter: {
        borderTop: '1px solid #333',
        paddingTop: '10px',
        marginTop: '10px',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.8rem',
        color: '#666'
    }
};

const ProjectList = () => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('standard');

    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newProject, setNewProject] = useState({
        title: '', description: '', budget: '', currency: 'USD'
    });

    const fetchProjects = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('mice_token');
            const res = await axios.get('/mice/api/projects', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setProjects(res.data.data);
            }
        } catch (err) {
            console.error("Fetch error:", err);
            setError("Failed to load projects.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProjects(); }, []);

    const handleCreate = async (payload) => {
        try {
            const token = localStorage.getItem('mice_token');
            const res = await axios.post('/mice/api/projects', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setNewProject({ title: '', description: '', budget: '', currency: 'USD' });
                setShowCreateForm(false);
                fetchProjects(); 
            }
        } catch (err) {
            alert(err.response?.data?.message || "Error creating project");
        }
    };

    const displayedProjects = projects.filter(p => 
        activeTab === 'support' ? p.category === 'support_ticket' : (p.category === 'standard' || !p.category)
    );

    if (loading) return <div style={{padding:'40px', textAlign:'center', color:'#888'}}>Loading Workplace...</div>;
    if (error) return <div style={{padding:'40px', textAlign:'center', color:'#ff5252'}}>{error}</div>;

    return (
        <div className="erp-container" style={{padding: '20px'}}>
            <div style={styles.header}>
                <h1 style={styles.title}>
                    {activeTab === 'standard' ? 'Strategic Initiatives' : 'Support Queue'}
                </h1>
                
                <div style={styles.actions}>
                    <div style={styles.tabGroup}>
                        <button 
                            onClick={() => setActiveTab('standard')}
                            style={{...styles.tabBtn, ...(activeTab === 'standard' ? styles.tabBtnActive : {})}}
                        >
                            Projects
                        </button>
                        <button 
                            onClick={() => setActiveTab('support')}
                            style={{...styles.tabBtn, ...(activeTab === 'support' ? styles.tabBtnActive : {})}}
                        >
                            Tickets
                        </button>
                    </div>

                    <button 
                        onClick={() => setShowCreateForm(!showCreateForm)}
                        style={styles.createBtn}
                    >
                        {showCreateForm ? 'Cancel' : (activeTab === 'standard' ? '+ Project' : '+ Ticket')}
                    </button>
                </div>
            </div>

            {/* CREATE FORM */}
            {showCreateForm && (
                <div className="composer-card">
                    <h3 style={{color:'#80cbc4', marginTop:0, marginBottom:'20px'}}>
                        {activeTab === 'standard' ? 'Initialize New Initiative' : 'Submit Support Request'}
                    </h3>
                    
                    <div style={{display:'grid', gap:'15px'}}>
                        <div>
                            <label style={{display:'block', color:'#888', fontSize:'0.8rem', marginBottom:'5px'}}>Title</label>
                            <input className="erp-input" value={newProject.title} onChange={e => setNewProject({...newProject, title: e.target.value})} placeholder={activeTab === 'standard' ? "e.g. Operation Nomad" : "e.g. Server Latency"} />
                        </div>
                        <div>
                            <label style={{display:'block', color:'#888', fontSize:'0.8rem', marginBottom:'5px'}}>Description</label>
                            <textarea className="erp-input" rows="3" value={newProject.description} onChange={e => setNewProject({...newProject, description: e.target.value})}></textarea>
                        </div>
                        
                        {activeTab === 'standard' && (
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>
                                <div>
                                    <label style={{display:'block', color:'#888', fontSize:'0.8rem', marginBottom:'5px'}}>Budget</label>
                                    <input type="number" className="erp-input" value={newProject.budget} onChange={e => setNewProject({...newProject, budget: e.target.value})} placeholder="0.00" />
                                </div>
                                <div>
                                    <label style={{display:'block', color:'#888', fontSize:'0.8rem', marginBottom:'5px'}}>Currency</label>
                                    <select className="erp-input" value={newProject.currency} onChange={e => setNewProject({...newProject, currency: e.target.value})}>
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                        <option value="BTC">BTC</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        <div style={{display:'flex', justifyContent:'flex-end'}}>
                            <button 
                                onClick={() => handleCreate({ ...newProject, category: activeTab === 'support' ? 'support_ticket' : 'standard' })}
                                style={{marginTop:'10px'}}
                            >
                                {activeTab === 'standard' ? 'Launch' : 'Submit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* LIST */}
            {displayedProjects.length === 0 ? (
                <div style={{textAlign:'center', padding:'40px', border:'1px dashed #444', borderRadius:'8px', color:'#666'}}>
                    <p>No active items in this queue.</p>
                </div>
            ) : (
                <div style={styles.grid}>
                    {displayedProjects.map(project => (
                        <Link 
                            to={`/mice/projects/${project.id}`} 
                            key={project.id}
                            style={{textDecoration:'none'}}
                        >
                            <div className="composer-card" style={{height:'100%', marginBottom:0, transition:'transform 0.2s', cursor:'pointer'}}>
                                <div style={styles.cardHeader}>
                                    <h3 style={styles.cardTitle}>{project.title}</h3>
                                    <StatusBadge status={project.status} />
                                </div>
                                <p style={styles.cardDesc}>
                                    {project.description || "No description provided."}
                                </p>
                                <div style={styles.cardFooter}>
                                    <span>{activeTab === 'standard' ? `Budget: ${project.currency} ${project.budget}` : 'Priority: Normal'}</span>
                                    <span>{new Date(project.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
};

const StatusBadge = ({ status }) => {
    const colors = {
        active: '#2e7d32', // Green
        triage: '#ef6c00', // Orange
        completed: '#1565c0', // Blue
        archived: '#424242' // Gray
    };
    return (
        <span style={{
            backgroundColor: colors[status] || '#444',
            color: '#fff',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            fontWeight: 'bold'
        }}>
            {status ? status.replace('_', ' ') : 'Draft'}
        </span>
    );
};

export default ProjectList;
