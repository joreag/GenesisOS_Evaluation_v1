import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const EditProfile = () => {
    const navigate = useNavigate();
    const [userId, setUserId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        discipline: '',
        interests: ''
    });

    // Load current local user on mount
    useEffect(() => {
        const stored = localStorage.getItem('mice_user');
        if (stored) {
            const user = JSON.parse(stored);
            setUserId(user.user_id);
            setFormData({
                name: user.name || '',
                discipline: user.discipline || '',
                interests: user.interests || ''
            });
        }
    }, []);

    const handleSave = async () => {
        if (!userId) return;

        const token = localStorage.getItem('mice_token');

        try {
            const response = await fetch(`/mice/api/users/${userId}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` // <--- Security Requirement
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                // 1. Update Local Storage to match Server
                // We merge the existing user object with new form data
                const stored = JSON.parse(localStorage.getItem('mice_user'));
                const updatedUser = { ...stored, ...formData };
                localStorage.setItem('mice_user', JSON.stringify(updatedUser));
                
                alert("Identity Refined.");
                navigate('/profile'); // Redirect back to profile view
            } else {
                const err = await response.json();
                alert(`Update Failed: ${err.error}`);
            }
        } catch (e) {
            alert("Failed to sync with server.");
        }
    };

    return (
        <div className="composer-card">
            <h2 style={{color: '#80cbc4', marginTop: 0}}>Edit Profile</h2>
            <hr style={{borderColor: '#444', marginBottom: '20px'}}/>

            <div className="input-group">
                <label>Handle / Name:</label>
                <input 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                />
            </div>

            <div className="input-group">
                <label>Primary Discipline:</label>
                <input 
                    value={formData.discipline} 
                    onChange={e => setFormData({...formData, discipline: e.target.value})} 
                    placeholder="e.g. AI Ethics, Systems Engineering"
                />
            </div>
            
            <div className="input-group">
                <label>Interests (Comma separated):</label>
                <input 
                    value={formData.interests} 
                    onChange={e => setFormData({...formData, interests: e.target.value})} 
                    placeholder="Python, MICT, Cybernetics..."
                />
            </div>

            <div style={{marginTop: '20px', display: 'flex', gap: '10px'}}>
                <button onClick={handleSave} className="btn-primary">Save Changes</button>
                <button 
                    onClick={() => navigate('/profile')} 
                    style={{
                        padding: '10px 20px', 
                        borderRadius: '4px', 
                        cursor: 'pointer', 
                        background: '#444', 
                        color: '#ddd', 
                        border: '1px solid #555',
                        fontWeight: 'bold'
                    }}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default EditProfile;