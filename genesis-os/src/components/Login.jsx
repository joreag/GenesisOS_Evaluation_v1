import React, { useState } from 'react';
import { api } from '../utils/api'; // <--- USE THE SHIM

const Login = ({ onLogin }) => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [formData, setFormData] = useState({ email: '', password: '', name: '', discipline: '' });
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        setError('');
        const endpoint = isRegistering ? '/mice/api/auth/register' : '/mice/api/auth/login';
        
        try {
            // FIX: Use api.post instead of fetch
            // The Shim handles the routing (Cloud vs Local)
            const response = await api.post(endpoint, formData);
            const data = response.data; // Shim returns axios-style object { data: ... }
            
            // Check for success based on Shim structure
            if (data.token || data.success) {
                if (isRegistering) {
                    alert("Registration successful. (Mock Email Sent)");
                    setIsRegistering(false);
                } else {
                    localStorage.setItem('mice_token', data.token);
                    localStorage.setItem('mice_user', JSON.stringify(data.user));
                    onLogin(data.user);
                }
            } else {
                setError(data.error || "Authentication failed");
            }
        } catch (e) {
            console.error(e);
            setError("Login Error: " + (e.response?.data?.error || e.message));
        }
    };

    // ... (Render Logic remains exactly the same) ...
    return (
        <div className="login-container" style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            background: '#000',
            padding: '20px'
        }}>
            <div className="login-wrapper" style={{
                display: 'flex',
                flexWrap: 'wrap',
                maxWidth: '1000px',
                width: '100%',
                background: '#1e1e1e',
                borderRadius: '12px',
                border: '1px solid #333',
                overflow: 'hidden',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
            }}>
                
                {/* --- LEFT SIDE: THE MANIFESTO --- */}
                <div className="info-section" style={{
                    flex: '1 1 400px',
                    padding: '40px',
                    borderRight: '1px solid #333',
                    background: '#1a1a1a'
                }}>
                    <h1 style={{ color: '#80cbc4', marginTop: 0, fontSize: '2.5rem' }}>MICE</h1>
                    <p style={{ color: '#666', fontSize: '1.1rem', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '30px' }}>
                        MICT Collaboration Environment
                    </p>

                    <div style={{ marginBottom: '25px' }}>
                        <h3 style={{ color: '#e0e0e0' }}>The Anti Social-Network</h3>
                        <p style={{ color: '#aaa', lineHeight: '1.6' }}>
                            Social media rewards noise. MICE rewards structure. 
                            We built this platform to facilitate deep, constructive collaboration 
                            between Architects, Engineers, Thinkers, and Anyone looking for a grounded collaborative environment.
                        </p>
                    </div>

                    <div style={{ marginBottom: '25px' }}>
                        <h3 style={{ color: '#e0e0e0' }}>Powered by MICT</h3>
                        <p style={{ color: '#aaa', lineHeight: '1.6' }}>
                            Every interaction is governed by the <strong>Map-Iterate-Check-Transform</strong> engine.  From what you post, to how our architecture and code operate, all runs on the MICT Framework.
                            You do not simply "post." You map context, iterate on an idea, check your evidence, and propose a transformation.
                        </p>
                    </div>

                    <div>
                        <h3 style={{ color: '#e0e0e0' }}>Why Join?</h3>
                        <ul style={{ color: '#aaa', lineHeight: '1.6', paddingLeft: '20px' }}>
                            <li>Collaborate on anything, an idea, a paper, a video, a picture or even just a phrase.</li>
                            <li>Access People you'd never find through the noise.</li>
                            <li>Build a reputation based on logic, not likes.</li>
                        </ul>
                    </div>
                </div>

                {/* --- RIGHT SIDE: THE FORGE GATE --- */}
                <div className="form-section" style={{
                    flex: '1 1 300px',
                    padding: '40px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                }}>
                    <h2 style={{ color: '#fff', marginTop: 0 }}>
                        {isRegistering ? "Join the Forge" : "Access Environment"}
                    </h2>
                    
                    {error && (
                        <div style={{ background: '#b71c1c', color: 'white', padding: '10px', borderRadius: '4px', marginBottom: '15px', fontSize: '0.9em' }}>
                            {error}
                        </div>
                    )}

                    {isRegistering && (
                        <>
                            <div className="input-group" style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', color: '#888', marginBottom: '5px' }}>Handle / Identity</label>
                                <input 
                                    style={{ width: '100%', padding: '12px', background: '#333', border: '1px solid #555', color: 'white', borderRadius: '4px' }}
                                    onChange={e => setFormData({...formData, name: e.target.value})} 
                                />
                            </div>
                            <div className="input-group" style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', color: '#888', marginBottom: '5px' }}>Discipline (e.g. AI, Physics)</label>
                                <input 
                                    style={{ width: '100%', padding: '12px', background: '#333', border: '1px solid #555', color: 'white', borderRadius: '4px' }}
                                    onChange={e => setFormData({...formData, discipline: e.target.value})} 
                                />
                            </div>
                        </>
                    )}
                    
                    <div className="input-group" style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', color: '#888', marginBottom: '5px' }}>Email</label>
                        <input 
                            style={{ width: '100%', padding: '12px', background: '#333', border: '1px solid #555', color: 'white', borderRadius: '4px' }}
                            onChange={e => setFormData({...formData, email: e.target.value})} 
                        />
                    </div>
                    
                    <div className="input-group" style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', color: '#888', marginBottom: '5px' }}>Password</label>
                        <input 
                            type="password"
                            style={{ width: '100%', padding: '12px', background: '#333', border: '1px solid #555', color: 'white', borderRadius: '4px' }}
                            onChange={e => setFormData({...formData, password: e.target.value})} 
                        />
                    </div>

                    <button 
                        onClick={handleSubmit} 
                        style={{ 
                            width: '100%', padding: '12px', background: '#00796b', color: 'white', 
                            border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' 
                        }}
                    >
                        {isRegistering ? "Initialize Identity" : "Login"}
                    </button>
                    
                    <p style={{ marginTop: '20px', textAlign: 'center', color: '#666', cursor: 'pointer' }} 
                       onClick={() => { setIsRegistering(!isRegistering); setError(''); }}>
                        {isRegistering ? "Already have an identity? Login" : "New here? Initialize Identity"}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;