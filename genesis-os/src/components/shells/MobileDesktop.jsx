import React from 'react';
// Apps
import ResearchLab from '../ResearchLab';
import Dojo from '../Dojo';
import LogosDashboard from '../LogosDashboard';
import ProjectList from '../ProjectList';
import ConsortiumDashboard from '../ConsortiumDashboard';
import Feed from '../Feed';
import LogicArchaeologist from '../LogicArchaeologist';
import TerminalApp from '../TerminalApp';
import CodeForgeApp from '../CodeForgeApp';
import EasyBakeApp from '../EasyBakeApp';
import KmictMonitorApp from '../KmictMonitorApp';
import LoginApp from '../LoginApp'; 

const MobileDesktop = ({ user, stats, workspace, dispatch }) => {
    
    // On Mobile, 'activeApp' is our single source of truth. Default to 'desktop' (home).
    const currentApp = workspace.activeApp || 'desktop'; 

    // Helper to render the active component
    const renderApp = () => {
        switch (currentApp) {
            case 'lab': return <ResearchLab />;
            case 'dojo': return <Dojo />;
            case 'logos': return <LogosDashboard />;
            case 'projects': return <ProjectList />;
            case 'consortium': return <ConsortiumDashboard />;
            case 'feed': return <Feed />;
            case 'logarch': return <LogicArchaeologist />;
            case 'terminal': return <TerminalApp />;
            case 'codeforge': return <CodeForgeApp />;
            case 'sysmon': return <KmictMonitorApp />;
            case 'easybake': return <EasyBakeApp />;
            case 'login': return <LoginApp />;

            // ... add all your other app cases here ...
            default: return null; // Should never happen if logic is correct
        }
    };

    // --- RENDER LOGIC ---
    // If we are NOT on the home screen, render the app with a header.
    if (currentApp !== 'desktop') {
        return (
            <div className="shell-mobile">
                <div className="mobile-app-container">
                    <div className="mobile-app-header">
                        <button className="back-btn" onClick={() => dispatch('OPEN_APP', 'desktop')}>
                            &larr; Home
                        </button>
                        {/* Safe check for the header title */}
                        <span>{currentApp.toUpperCase()}</span>
                    </div>
                    <div className="mobile-app-content">
                        {renderApp()}
                    </div>
                </div>
                {/* We might not need the bottom nav when an app is open */}
            </div>
        );
    }
    
    // --- DEFAULT RENDER ---
    // Otherwise, we ARE on the home screen. Render the icon grid and nav bar.
    return (
        <div className="shell-mobile">
            <div className="mobile-viewport">
                <div className="mobile-grid">
                    {/* Your existing icon grid is perfect */}
                    <div className="mobile-card" onClick={() => dispatch('OPEN_APP', 'lab')}>
                        <div className="big-icon">⚗️</div><h3>The Lab</h3>
                    </div>
                    <div className="mobile-card" onClick={() => dispatch('OPEN_APP', 'dojo')}>
                        <div className="big-icon">🥋</div><h3>The Dojo</h3>
                    </div>
                        <div className="mobile-card" onClick={() => dispatch('OPEN_APP', 'logos')}>
                            <div className="big-icon">📦</div>
                            <h3>Logos</h3>
                        </div>
                        <div className="mobile-card" onClick={() => dispatch('OPEN_APP', 'projects')}>
                            <div className="big-icon">🔨</div>
                            <h3>Work</h3>
                        </div>
                        <div className="mobile-card" onClick={() => dispatch('OPEN_APP', 'feed')}>
                            <div className="big-icon">🌐</div>
                            <h3>Comm</h3>
                        </div>
                        
                        {user.role === 'admin' && (
                            <div className="mobile-card" onClick={() => dispatch('OPEN_APP', 'consortium')}>
                                <div className="big-icon">🏛️</div>
                                <h3>Admin</h3>
                            </div>
                        )}
                    </div>
                    

                {/* B. ACTIVE APP (Full Screen with Back Nav) */}
                {(!currentApp || currentApp === 'desktop') && (
                    <div className="mobile-app-container">
                        <div className="mobile-app-header">
                            <button className="back-btn" onClick={() => dispatch('OPEN_APP', 'desktop')}>
                                &larr; Back
                            </button>
                            <span>{currentApp ? currentApp.toUpperCase() : 'LOADING...'}</span>
                        </div>
                        <div className="mobile-app-content">
                            {renderApp()}
                        </div>
                    </div>
                )}
            </div>

            {/* 2. BOTTOM NAV (Persistent) */}
            <div className="mobile-nav">
                <div className="nav-item">Home</div>
                <div className="nav-item" style={{color: stats.hive === 'CONNECTED' ? '#4caf50' : '#666'}}>HIVE</div>
                <div className="nav-item" onClick={() => dispatch('LOGOUT')}>Lock</div>
            </div>
        </div>
    );
};

export default MobileDesktop;