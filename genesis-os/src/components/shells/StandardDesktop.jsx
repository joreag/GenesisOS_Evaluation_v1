import React from 'react';
import WindowFrame from './WindowFrame';
import Taskbar from './Taskbar';
import { invoke } from '@tauri-apps/api/core'; // For opening Terminal

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

const StandardDesktop = ({ user, stats, workspace, dispatch }) => {
    
    // Helper to open external tools
    const launchTerminal = async () => {
        // This requires Rust command or shell plugin configuration
        // For now, we simulate opening a window that acts as a shell
        dispatch('OPEN', 'terminal');
    };

    const launchEasyBake = () => {
        dispatch('OPEN', 'easybake');
    };

    return (
        <div className="shell-desktop">
            
            {/* 1. TOP BAR */}
            <div className="status-bar">
                <div className="start-menu">
                    GENESIS <span style={{color:'#666'}}>// {user.name}</span>
                </div>
                <div className="metrics">
                    <span style={{color: stats.hive === 'CONNECTED' ? '#4caf50' : '#666'}}>
                        HIVE: {stats.hive}
                    </span>
                    <span>CPU: {stats.cpu}%</span>
                    <span>RAM: {stats.ram}%</span>
                    <span className="logout-btn" onClick={() => dispatch('LOGOUT')}>[LOGOUT]</span>
                </div>
            </div>

            {/* 2. DESKTOP SURFACE (Grid Layout) */}
            <div className="desktop-surface">
                {/* Core MICE Apps */}
                <div className="desktop-icon" onClick={() => dispatch('OPEN', 'lab')}>
                    <div className="icon-img">⚗️</div><span>The Lab</span>
                </div>
                <div className="desktop-icon" onClick={() => dispatch('OPEN', 'dojo')}>
                    <div className="icon-img">🥋</div><span>The Dojo</span>
                </div>
                <div className="desktop-icon" onClick={() => dispatch('OPEN', 'logos')}>
                    <div className="icon-img">📦</div><span>LOGOS</span>
                </div>
                <div className="desktop-icon" onClick={() => dispatch('OPEN', 'projects')}>
                    <div className="icon-img">🔨</div><span>Projects</span>
                </div>
                <div className="desktop-icon" onClick={() => dispatch('OPEN', 'feed')}>
                    <div className="icon-img">🌐</div><span>Community</span>
                </div>

                <div className="desktop-icon" onClick={() => dispatch('OPEN', 'codeforge')}>
                    <div className="icon-img">📝</div><span>Code Forge</span>
                </div>


                {/* Admin Only */}
                {user.role === 'admin' && (
                    <div className="desktop-icon" onClick={() => dispatch('OPEN', 'consortium')}>
                        <div className="icon-img">🏛️</div><span>Consortium</span>
                    </div>
                )}

                {/* System Tools */}
                <div className="desktop-icon" onClick={launchTerminal}>
                    <div className="icon-img">💻</div><span>Terminal</span>
                </div>
                <div className="desktop-icon" onClick={launchEasyBake}>
                    <div className="icon-img">🧠</div><span>Easy Bake</span>
                </div>
                <div className="desktop-icon" onClick={() => dispatch('OPEN', 'kmict_monitor')}>
                    <div className="icon-img">🔬</div><span>Kernel Monitor</span>
                </div>
                <div className="desktop-icon" onClick={() => dispatch('OPEN', 'login_test')}>
                    <div className="icon-img">🔬</div><span>Login Test</span>
                </div>
            

            <div className="desktop-icon" onClick={() => dispatch('OPEN', 'logic_arch')}>
                <div className="icon-img">
                        {/* INLINE SVG: Logic Chip */}
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2 12C2 12 5 5 12 5C19 5 22 12 22 12C22 12 19 19 12 19C5 19 2 12 2 12Z" stroke="#80cbc4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <circle cx="12" cy="12" r="3" stroke="#80cbc4" strokeWidth="2"/>
                            <path d="M9 21V23" stroke="#80cbc4" strokeWidth="2" strokeLinecap="round"/>
                            <path d="M15 21V23" stroke="#80cbc4" strokeWidth="2" strokeLinecap="round"/>
                            <path d="M12 21V23" stroke="#80cbc4" strokeWidth="2" strokeLinecap="round"/>
                            <path d="M2 9L2 15" stroke="#80cbc4" strokeWidth="2" strokeLinecap="round"/>
                            <path d="M22 9L22 15" stroke="#80cbc4" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                    </div>
                    <span>Logic Arch</span>
                    </div>
                </div>    
            {/* 3. WINDOW MANAGER */}
            {workspace.windows.map(win => (
                <WindowFrame key={win.id} windowData={win} dispatch={dispatch}>
                    {/* App Routing */}
                    {win.type === 'lab' && <ResearchLab />}
                    {win.type === 'dojo' && <Dojo />}
                    {win.type === 'logos' && <LogosDashboard />}
                    {win.type === 'projects' && <ProjectList />}
                    {win.type === 'feed' && <Feed />}
                    {win.type === 'consortium' && <ConsortiumDashboard />}
                    {win.type === 'logic_arch' && <LogicArchaeologist />}
                    {win.type === 'terminal' && <TerminalApp />}
                    {win.type === 'codeforge' && <CodeForgeApp />}
                    {win.type === 'easybake' && <EasyBakeApp/>}
                    {win.type === 'kmict_monitor' && <KmictMonitorApp />}
                    {win.type === 'login_test' && <LoginApp />}
                    
                    
                </WindowFrame>
            ))}

            {/* 4. TASKBAR */}
            <Taskbar windows={workspace.windows} dispatch={dispatch} />
            
        </div>
    );
};

export default StandardDesktop;
