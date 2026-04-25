import React from 'react';
import { useNavigate } from 'react-router-dom';

const ProfileCard = ({ user }) => {
    const navigate = useNavigate();

    return (
        <div className="profile-card riff-node">
            <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                <div className="avatar-placeholder">{user.name ? user.name[0].toUpperCase() : "?"}</div>
                <h3 style={{ margin: '10px 0 5px 0', color: '#e0e0e0' }}>{user.name}</h3>
                <span className="discipline-tag">{user.discipline || "Explorer"}</span>
            </div>
            
            <div className="stats-grid">
                <div className="stat">
                    <strong>0</strong>
                    <span>Sparks</span>
                </div>
                <div className="stat">
                    <strong>0</strong>
                    <span>Riffs</span>
                </div>
                <div className="stat">
                    <strong>0</strong>
                    <span>Rep</span>
                </div>
            </div>
            
            <hr style={{borderColor: '#333', margin: '15px 0'}}/>
            
            <button 
                style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: '#333',
                    border: '1px solid #555',
                    color: '#e0e0e0',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    transition: 'background 0.2s'
                }}
                onClick={() => navigate('/profile/edit')}
            >
                Edit Profile
            </button>
        </div>
    );
};

export default ProfileCard;