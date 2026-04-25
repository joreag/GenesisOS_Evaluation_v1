import React from 'react';
import './App.css';
import { useGenesisEngine } from './hooks/useGenesisEngine';

// Shells
import StandardDesktop from './components/shells/StandardDesktop';
import MobileDesktop from './components/shells/MobileDesktop';

// Shared Components
import Login from './components/Login';
import FloatingChat from './components/FloatingChat';
import MagicMirror from './components/MagicMirror'; // If you installed it

function App() {
  const { osState, dispatch } = useGenesisEngine();
  const { hardware, user, workspace } = osState;

  // 1. LOCK SCREEN
  if (!user) {
    return (
      <div className="os-container">
        <div className="status-bar"><span>GENESIS OS // LOCKED</span></div>
        <div className="center-stage">
            <Login onLogin={(u) => dispatch('LOGIN', u)} />
        </div>
      </div>
    );
  }

  // 2. POLYMORPHIC RENDER
  // This is where the magic happens. The OS decides its own shape.
  let ActiveShell;
  
  switch (workspace.uiMode) {
      case 'touch-optimized':
          ActiveShell = MobileDesktop;
          break;
      case 'automotive': 
          // Future: ActiveShell = CarDashboard;
          ActiveShell = StandardDesktop; // Fallback for now
          break;
      case 'standard':
      default:
          ActiveShell = StandardDesktop;
          break;
  }

  return (
    <div className="os-root">
        {/* Render the selected Shell, passing all OS state down */}
        <ActiveShell 
            user={user} 
            stats={hardware} 
            workspace={workspace} 
            dispatch={dispatch} 
        />

        {/* Global Overlays (Always on top regardless of Shell) */}
        <FloatingChat user={user} />
        <MagicMirror user={user} /> 
        
        {/* Alert Toasts */}
        <div className="alert-layer">
            {workspace.alerts.map((msg, i) => (
                <div key={i} className="os-alert">⚠️ {msg}</div>
            ))}
        </div>
    </div>
  );
}

export default App;