import React, { useState, useEffect } from 'react';
import { api as axios } from '../utils/api';

// --- STYLES ---
const styles = {
    container: { padding: '20px', maxWidth: '1200px', margin: '0 auto', color: '#e0e0e0' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '15px' },
    title: { margin: 0, color: '#ffb74d' }, // Orange for Supply Chain
    
    grid: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' },
    card: { background: '#1e1e1e', border: '1px solid #333', borderRadius: '8px', padding: '20px' },
    
    table: { width: '100%', borderCollapse: 'collapse', marginTop: '10px' },
    th: { textAlign: 'left', padding: '10px', borderBottom: '1px solid #444', color: '#888', fontSize: '0.8em', textTransform: 'uppercase' },
    td: { padding: '10px', borderBottom: '1px solid #222' },
    
    btn: { background: '#333', color: '#fff', border: '1px solid #555', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8em' },
    addBtn: { background: '#ff9800', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
    
    alert: { color: '#ff5252', fontWeight: 'bold' }
};

const LogosDashboard = () => {
    // FIX 1: Ensure initial state is ALWAYS an empty array
    const [inventory, setInventory] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null); // Added error state

    const loadData = async () => {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('mice_token');
        const headers = { Authorization: `Bearer ${token}` };
        
        try {
            const [invRes, vendRes] = await Promise.all([
                axios.get('https://boredbrains.net/mice/api/logos/inventory', { headers }),
                axios.get('https://boredbrains.net/mice/api/logos/vendors', { headers })
            ]);
            
            // FIX 2: Defensive assignment. If data is undefined, fallback to []
            setInventory(invRes.data?.data || []);
            setVendors(vendRes.data?.data || []);
        } catch (e) {
            console.error("Logos Data Fetch Error:", e);
            setError(e.message || "Failed to load supply chain data.");
            // Ensure state remains safe even on catch
            setInventory([]);
            setVendors([]);
        } finally { 
            setLoading(false); 
        }
    };

    useEffect(() => { loadData(); }, []);

    const handleAddItem = async () => {
        const name = prompt("Item Name:");
        if (!name) return;
        const qty = prompt("Quantity:", "0");
        const location = prompt("Location (Shelf/Bin):", "Unassigned");
        
        try {
            const token = localStorage.getItem('mice_token');
            await axios.post('https://boredbrains.net/mice/api/logos/inventory', {
                name, 
                quantity: parseInt(qty), 
                location,
                category: 'component'
            }, { headers: { Authorization: `Bearer ${token}` } });
            loadData();
        } catch (e) { alert("Failed to add item"); }
    };

    const handleAddVendor = async () => {
        const name = prompt("Vendor Name:");
        if (!name) return;
        try {
            const token = localStorage.getItem('mice_token');
            await axios.post('https://boredbrains.net/mice/api/logos/vendors', { name }, { headers: { Authorization: `Bearer ${token}` } });
            loadData();
        } catch (e) { alert("Failed"); }
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2 style={styles.title}>📦 LOGOS <span style={{fontSize:'0.5em', color:'#666'}}>// Supply Chain</span></h2>
                <div style={{display:'flex', gap:'10px', alignItems: 'center'}}>
                    {/* Display error message if it exists */}
                    {error && <span style={{color: '#ff5252', fontSize: '0.8em'}}>{error}</span>}
                    <button style={styles.addBtn} onClick={handleAddVendor}>+ Vendor</button>
                    <button style={styles.addBtn} onClick={handleAddItem}>+ Item</button>
                </div>
            </div>

            <div style={styles.grid}>
                {/* LEFT: INVENTORY */}
                <div style={styles.card}>
                    <h3 style={{marginTop:0}}>Inventory</h3>
                    {loading ? (
                        <div style={{ color: '#888' }}>Loading inventory data...</div>
                    ) : (
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.th}>Name</th>
                                    <th style={styles.th}>Category</th>
                                    <th style={styles.th}>Qty</th>
                                    <th style={styles.th}>Location</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* FIX 3: Safe mapping */}
                                {inventory?.map(item => (
                                    <tr key={item.id}>
                                        <td style={styles.td}>{item.name}</td>
                                        <td style={styles.td}>{item.category}</td>
                                        <td style={styles.td}>
                                            <span style={item.quantity <= (item.low_stock_threshold || 5) ? styles.alert : {}}>
                                                {item.quantity}
                                            </span>
                                        </td>
                                        <td style={styles.td}>{item.location || '-'}</td>
                                    </tr>
                                ))}
                                {(!inventory || inventory.length === 0) && !error && (
                                    <tr><td colSpan="4" style={{...styles.td, textAlign: 'center', color: '#666'}}>No inventory found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* RIGHT: VENDORS */}
                <div style={styles.card}>
                    <h3 style={{marginTop:0}}>Vendors</h3>
                    {loading ? (
                        <div style={{ color: '#888' }}>Loading vendor data...</div>
                    ) : (
                        <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                            {/* FIX 3: Safe mapping */}
                            {vendors?.map(v => (
                                <div key={v.id} style={{background:'#222', padding:'10px', borderRadius:'4px', display:'flex', justifyContent:'space-between'}}>
                                    <span>{v.name}</span>
                                    <span style={{color: v.status === 'active' ? '#4caf50' : '#666', fontSize:'0.8em'}}>
                                        {v.status}
                                    </span>
                                </div>
                            ))}
                            {(!vendors || vendors.length === 0) && !error && (
                                <div style={{textAlign: 'center', color: '#666'}}>No vendors found.</div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LogosDashboard;