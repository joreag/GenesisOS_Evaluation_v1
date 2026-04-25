import { useState, useCallback, useRef, useEffect } from 'react';

export const useDraggableResizable = ({ initialPosition, onFocus }) => {
    const windowRef = useRef(null);

    // State for position and size
    const [pos, setPos] = useState(initialPosition || { x: 100, y: 50 });
    const [size, setSize] = useState({ width: 800, height: 600 });
    
    // State to track what action is happening
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);

    // Store the initial mouse position and window dimensions at the start of a drag/resize
    const initialDragState = useRef({ startX: 0, startY: 0, startWidth: 0, startHeight: 0, startPosX: 0, startPosY: 0 });

    const handleMouseDown = useCallback((e) => {
        if (onFocus) onFocus();

        // Check if the click was on the resize handle
        const handleSize = 15;
        const rect = windowRef.current.getBoundingClientRect();
        const isOnHandle = (e.clientX > rect.right - handleSize && e.clientY > rect.bottom - handleSize);

        if (isOnHandle) {
            setIsResizing(true);
            initialDragState.current = {
                startX: e.clientX,
                startY: e.clientY,
                startWidth: size.width,
                startHeight: size.height,
            };
        } 
        // Check if the click was on the title bar
        else if (e.target.classList.contains('window-titlebar') || e.target.closest('.window-titlebar')) {
            setIsDragging(true);
            initialDragState.current = {
                startX: e.clientX,
                startY: e.clientY,
                startPosX: pos.x,
                startPosY: pos.y,
            };
        }
    }, [pos, size, onFocus]);

    const handleMouseMove = useCallback((e) => {
        if (isDragging) {
            const dx = e.clientX - initialDragState.current.startX;
            const dy = e.clientY - initialDragState.current.startY;
            setPos({
                x: initialDragState.current.startPosX + dx,
                y: initialDragState.current.startPosY + dy,
            });
        }
        if (isResizing) {
            const dw = e.clientX - initialDragState.current.startX;
            const dh = e.clientY - initialDragState.current.startY;
            setSize({
                width: Math.max(350, initialDragState.current.startWidth + dw), // Enforce minWidth
                height: Math.max(250, initialDragState.current.startHeight + dh), // Enforce minHeight
            });
        }
    }, [isDragging, isResizing]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        setIsResizing(false);
    }, []);

    useEffect(() => {
        if (isDragging || isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);
    
    return { windowRef, pos, size, isDragging, isResizing, handleMouseDown };
};