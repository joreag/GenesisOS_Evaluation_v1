import React, { useState } from 'react';
import { useDraggableResizable } from '/src/hooks/useDraggableResizeable'; // <-- IMPORT OUR NEW HOOK

const WindowFrame = ({ windowData, dispatch, children }) => {
    const { id, title, zIndex, isMinimized } = windowData;
    const [isMaximized, setMaximized] = useState(false);

    // --- USE OUR CUSTOM HOOK ---
    const { windowRef, pos, size, isDragging, isResizing, handleMouseDown } = useDraggableResizable({
        onFocus: () => dispatch('FOCUS', id)
    });

    if (isMinimized) return null;

    const toggleMaximize = () => setMaximized(!isMaximized);

    // Build the style object dynamically
    const windowStyle = {
        zIndex,
        width: isMaximized ? '100%' : `${size.width}px`,
        height: isMaximized ? 'calc(100% - 85px)' : `${size.height}px`,
        top: isMaximized ? '40px' : `${pos.y}px`,
        left: isMaximized ? '0px' : `${pos.x}px`,
    };

    return (
        // This single div is now the window. We attach the mouse down handler to it.
        <div 
            ref={windowRef} 
            className={`os-window-final ${isMaximized ? 'maximized' : ''}`} 
            style={windowStyle}
            onMouseDown={handleMouseDown}
        >
            <div className="window-titlebar" onDoubleClick={toggleMaximize}>
                <span className="window-title">{title}</span>
                <div className="window-controls">
                    <button onClick={() => dispatch('MINIMIZE', id)}>-</button>
                    <button onClick={toggleMaximize}>{isMaximized ? '❐' : '□'}</button>
                    <button onClick={() => dispatch('CLOSE', id)}>✕</button>
                </div>
            </div>
            
            <div className="window-content">
                {children}
            </div>
            
            {/* NEW: A dedicated, visible resize handle div */}
            {!isMaximized && <div className="resize-handle"></div>}
        </div>
    );
};

export default WindowFrame;