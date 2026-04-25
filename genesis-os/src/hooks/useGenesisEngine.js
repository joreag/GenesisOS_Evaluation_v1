import { useState, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';

const INITIAL_STATE = {
    // 1. Hardware Context (Body)
    hardware: { 
        cpu: 0, ram: 0, battery: 100, hive: 'OFFLINE',
        isTouch: false, screenW: 1920, deviceType: 'desktop'
    },
    // 2. User Context (Soul)
    user: JSON.parse(localStorage.getItem('mice_user')) || null,
    // 3. UI Context (Face)
    workspace: { 
        uiMode: 'standard', // 'standard', 'touch-optimized'
        windows: [],        // Multi-window support
        nextZ: 100,
        alerts: [] 
    },
    status: 'BOOTING'
};

export const useGenesisEngine = () => {
    const [osState, setOsState] = useState(INITIAL_STATE);
    const stateRef = useRef(INITIAL_STATE);

    const transformRender = (finalState) => {
        setOsState(finalState);
        stateRef.current = finalState; 
    };

    // --- MICT STAGE 1: MAP (Hardware & Kernel) ---
    const mapInput = (payload) => {
        const current = stateRef.current;
        const width = window.innerWidth;
        const touchCapable = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        
        let type = 'desktop';
        if (width < 768) type = 'mobile';
        else if (touchCapable && width < 1200) type = 'tablet';

        return {
            ...current,
            hardware: {
                cpu: Math.round(payload.cpu),
                ram: Math.round((payload.memory_used / payload.memory_total) * 100),
                battery: 100,
                hive: payload.hive_status,
                isTouch: touchCapable,
                screenW: width,
                deviceType: type
            }
        };
    };

    // --- MICT STAGE 2: ITERATE (Adaptation Logic) ---
    const iterateLogic = (mappedState) => {
        let updates = { ...mappedState };
        let ws = { ...updates.workspace };

        // Polymorphic Morphing
        if (updates.hardware.deviceType === 'mobile') {
            ws.uiMode = 'touch-optimized';
        } else {
            ws.uiMode = 'standard';
        }

        // Security Lock
        if (!updates.user) {
            // If locked, ensure no sensitive windows are open (optional security)
            // ws.windows = []; 
        }

        updates.workspace = ws;
        return updates;
    };

    // --- MICT STAGE 3: CHECK (Sentinels) ---
    const checkSystems = (iteratedState) => {
        let checkedState = { ...iteratedState };
        let newAlerts = [];

        if (checkedState.hardware.cpu > 90) newAlerts.push("High CPU Load");
        if (checkedState.hardware.ram > 95) newAlerts.push("Memory Critical");
        
        checkedState.workspace.alerts = newAlerts;
        return checkedState;
    };

    // --- KERNEL LISTENER ---
    useEffect(() => {
        console.log("[GENESIS] Polymorphic Engine Active.");
        const unlisten = listen('system-tick', (event) => {
            const mapped = mapInput(event.payload);
            const iterated = iterateLogic(mapped);
            const checked = checkSystems(iterated);
            transformRender(checked);
        });
        return () => { unlisten.then(f => f()); };
    }, []);

    // --- DISPATCHER (Window Actions) ---
    const dispatch = (action, payload) => {
        const current = stateRef.current;
        let ws = { ...current.workspace };
        let windows = [...ws.windows];

        if (action === 'LOGIN') current.user = payload;
        if (action === 'LOGOUT') {
            current.user = null;
            localStorage.removeItem('mice_user');
            windows = [];
        }

        // WINDOW MANAGER LOGIC
        if (action === 'OPEN') {
            const appType = payload;
            const existing = windows.find(w => w.type === appType);
            if (existing) {
                existing.zIndex = ws.nextZ++;
                existing.isMinimized = false;
            } else {
                windows.push({
                    id: Date.now(),
                    type: appType,
                    title: appType.toUpperCase(),
                    zIndex: ws.nextZ++,
                    isMinimized: false
                });
            }
        }

        if (action === 'CLOSE') windows = windows.filter(w => w.id !== payload);
        if (action === 'FOCUS') {
            const target = windows.find(w => w.id === payload);
            if (target) {
                target.zIndex = ws.nextZ++;
                target.isMinimized = false;
            }
        }
        if (action === 'MINIMIZE') {
            const target = windows.find(w => w.id === payload);
            if (target) target.isMinimized = true;
        }

        if (action === 'TOGGLE_MENU') {
            // Future Start Menu logic
        }

        ws.windows = windows;
        const nextState = { ...current, workspace: ws, user: current.user };
        
        // Re-run Check/Transform to ensure state validity
        transformRender(checkSystems(iterateLogic(nextState)));
    };

    return { osState, dispatch };
};