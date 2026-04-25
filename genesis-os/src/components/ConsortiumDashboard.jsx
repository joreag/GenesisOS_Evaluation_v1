import React, { useState, useEffect } from 'react';
import { api as axios } from '../utils/api';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

const ConsortiumDashboard = () => {
    const [metrics, setMetrics] = useState({
        kpi: {
            totalSparks: 0,
            activeProjects: 0,
            openTickets: 0,
            systemHealth: 100,
            revenue: "$0 (Pre-Rev)"
        },
        activity: [] 
    });
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const token = localStorage.getItem('mice_token');
                const res = await axios.get('/mice/api/dashboard/overview', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                if (res.data.success) {
                    setMetrics(res.data.data);
                }
            } catch (err) {
                console.error(err);
                setError("Unable to sync with Mission Control.");
            } finally {
                setLoading(false);
            }
        };
        fetchDashboard();
    }, []);

    if (loading) return <div style={{padding:'40px', textAlign:'center', color:'#888'}}>Connecting to Mission Control...</div>;
    if (error) return <div style={{padding:'40px', textAlign:'center', color:'#ff5252'}}>{error}</div>;

    const { kpi, activity } = metrics;

    // Inline Styles to guarantee layout without Tailwind
    const styles = {
        grid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            marginBottom: '30px'
        },
        cardTitle: {
            fontSize: '0.8rem',
            color: '#888',
            textTransform: 'uppercase',
            fontWeight: 'bold',
            marginBottom: '5px'
        },
        cardValue: {
            fontSize: '2rem',
            fontWeight: 'bold',
            color: '#e0e0e0'
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <h2 style={{ color: '#80cbc4', marginBottom: '20px' }}>
                <span role="img" aria-label="chart">📊</span> Consortium Overview
            </h2>
            
{/* 1. KPI CARDS (Reusing 'composer-card' for Dark Mode look) */}
            <div style={styles.grid}>
                
                <div className="composer-card" style={{textAlign: 'center'}}>
                    <div style={styles.cardTitle}>Community Sparks</div>
                    <div style={styles.cardValue}>{kpi.totalSparks}</div>
                </div>

                <div className="composer-card" style={{textAlign: 'center', borderLeft: '3px solid #42a5f5'}}>
                    <div style={styles.cardTitle}>Active Initiatives</div>
                    <div style={{...styles.cardValue, color: '#42a5f5'}}>{kpi.activeProjects}</div>
                </div>

                <div className="composer-card" style={{textAlign: 'center', borderLeft: '3px solid #ffa726'}}>
                    <div style={styles.cardTitle}>Open Tickets</div>
                    <div style={{...styles.cardValue, color: '#ffa726'}}>{kpi.openTickets}</div>
                </div>

                <div className="composer-card" style={{textAlign: 'center', borderLeft: '3px solid #66bb6a'}}>
                    <div style={styles.cardTitle}>System Health</div>
                    <div style={{...styles.cardValue, color: '#66bb6a', display:'flex', justifyContent:'center', alignItems:'center', gap:'10px'}}>
                        {kpi.systemHealth}%
                        <div style={{width:'10px', height:'10px', borderRadius:'50%', background:'#66bb6a', boxShadow:'0 0 5px #66bb6a'}}></div>
                    </div>
                </div>
            </div>

            {/* 2. VELOCITY CHART */}
            <div className="composer-card" style={{ height: '450px', padding: '20px' }}>
                <h4 style={{ color: '#e0e0e0', marginBottom: '20px' }}>7-Day Velocity</h4>
                
                {activity && activity.length > 0 ? (
                    <ResponsiveContainer width="100%" height="90%">
                        <BarChart data={activity} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#444" />
                            <XAxis 
                                dataKey="name" 
                                stroke="#888" 
                                tick={{fill: '#888', fontSize: 12}}
                                dy={10}
                            />
                            <YAxis 
                                stroke="#888" 
                                tick={{fill: '#888', fontSize: 12}} 
                            />
                            <Tooltip 
                                contentStyle={{
                                    backgroundColor: '#1e1e1e', 
                                    border: '1px solid #444', 
                                    borderRadius: '4px', 
                                    color: '#e0e0e0'
                                }}
                                cursor={{fill: '#333'}}
                            />
                            <Legend wrapperStyle={{paddingTop: '10px'}} />
                            <Bar 
                                dataKey="sparks" 
                                name="New Sparks" 
                                fill="#80cbc4" 
                                radius={[4, 4, 0, 0]} 
                                barSize={40}
                            />
                            <Bar 
                                dataKey="tasks" 
                                name="Tasks Created" 
                                fill="#42a5f5" 
                                radius={[4, 4, 0, 0]} 
                                barSize={40}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontStyle: 'italic'}}>
                        No activity data recorded in the last 7 days.
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConsortiumDashboard;
