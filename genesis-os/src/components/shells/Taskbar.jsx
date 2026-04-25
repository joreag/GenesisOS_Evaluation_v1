import React from 'react';

const Taskbar = ({ windows, dispatch }) => {
    return (
        <div className="os-taskbar">
            <div className="start-btn" onClick={() => dispatch('TOGGLE_MENU')}>
                GENESIS
            </div>
            
            <div className="task-list">
                {windows.map(w => (
                    <div 
                        key={w.id} 
                        className={`task-item ${w.isMinimized ? 'minimized' : 'active'}`}
                        onClick={() => dispatch('FOCUS', w.id)}
                    >
                        {w.title}
                    </div>
                ))}
            </div>
            
            <div className="tray">
                <span>ONLINE</span>
            </div>
        </div>
    );
};

export default Taskbar;