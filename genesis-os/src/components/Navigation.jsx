import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Navigation = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [userRole, setUserRole] = useState("user"); 
    const navigate = useNavigate();

    // Load role on mount
    useEffect(() => {
        const stored = localStorage.getItem('mice_user');
        if (stored) {
            const u = JSON.parse(stored);
            setUserRole(u.role || "user");
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('mice_user');
        localStorage.removeItem('mice_token');
        // Force full reload to clear memory states
        window.location.href = '/mice'; 
    };

    const handleSearch = (e) => {
        if (e.key === 'Enter' && searchQuery.trim()) {
            setIsOpen(false);
            navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
            setSearchQuery("");
        }
    };

    return (
        <div className="nav-container" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            
            {/* Search Bar */}
            <div className="nav-search" style={{ position: 'relative' }}>
                <input 
                    type="text" 
                    placeholder="Search..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearch}
                    style={{
                        padding: '8px 12px', borderRadius: '20px', border: '1px solid #444',
                        background: '#1a1a1a', color: '#fff', width: '200px', fontSize: '0.9rem', outline: 'none'
                    }}
                />
            </div>

            {/* Menu Icon */}
            <div className="menu-icon" onClick={() => setIsOpen(!isOpen)} style={{cursor: 'pointer'}}>
                <div className="bar"></div>
                <div className="bar"></div>
                <div className="bar"></div>
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="menu-dropdown" onClick={() => setIsOpen(false)}>
                    <Link to="/" className="menu-link"><div className="menu-item">Global Feed</div></Link>
                    <Link to="/profile" className="menu-link"><div className="menu-item">My Sparks</div></Link>
                    
                    {/* --- NEW: WORKPLACE (ERP) --- */}
                    <Link to="/mice/projects" className="menu-link">
                        <div className="menu-item" style={{color: '#80cbc4'}}>Workplace (ERP)</div>
                    </Link>

                    {/* --- NEW: Chat and Train Rambling Grandpa AI --- */}
                    <Link to="/mice/dojo" className="menu-link">
                        <div className="menu-item" style={{color: '#80cbc4'}}>Chat and Train Rambling Grandpa AI</div>
                    </Link>
                    
                    {/* --- ADMIN ONLY LINK --- */}
                    {userRole === 'admin' && (
                        <Link to="/dashboard" className="menu-link">
                            <div className="menu-item" style={{color: '#ffb74d'}}>Consortium View</div>
                        </Link>
                    )}
                    {/* --- THE LAB (RESEARCH) --- */}
                    {userRole === 'admin' && (
                    <Link to="/mice/research" className="menu-link" onClick={() => setIsOpen(false)}>
                        <div className="menu-item" style={{color: '#b388ff'}}>The Lab (R&D)</div>
                    </Link>
                    )}
                    
                    {/* ---LOGOS (SUPPLY CHAIN)--- */}
                    {userRole === 'admin' && (
                    <Link to="/mice/logos" className="menu-link" onClick={() => setIsOpen(false)}>
                        <div className="menu-item" style={{color: '#ffb74d'}}>LOGOS (Supply Chain)</div>
                    </Link>
                    )}

                    <div className="menu-item" onClick={() => alert("Settings coming soon!")}>Settings</div>
                    <hr style={{borderColor: '#444', margin: '5px 0'}}/>
                    <div className="menu-item" style={{color: '#ff5252'}} onClick={handleLogout}>Log Out</div>
                </div>
            )}
        </div>
    );
};

export default Navigation;