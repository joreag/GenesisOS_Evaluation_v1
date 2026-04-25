import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

function App() {
  const [logs, setLogs] = useState([]);
  const [worldState, setWorldState] = useState({});
  const [fileContent, setFileContent] = useState("");
  const logEndRef = useRef(null);

  // --- Boot & Sync ---
  useEffect(() => {
    invoke('boot_kmict').then(msg => addLog(msg)).catch(e => addLog(`[BOOT ERROR] ${e}`));
    refreshState();
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (msg) => setLogs(prev => [...prev, msg]);
  
  const refreshState = async () => {
    try {
      const state = await invoke('get_kmict_world_state');
      setWorldState(state);
      if (state.content) {
        setFileContent(state.content);
      }
    } catch (e) {
      addLog(`[STATE REFRESH ERROR] ${e}`);
    }
  };

  const handleWipeMemory = async () => {
        await invoke('wipe_kmict_memory'); // <-- CHANGED from 'boot_os'
        setLogs(['--- MEMORY WIPED. DATABASE CLEARED. ---']); 
        setFileContent('');
        refreshState();
    };

  // --- Scheduler Functions (RESTORED!) ---
  const handleLoadScheduler = async () => {
    try {
      const res = await invoke('cmd_load_mdo', { filepath: 'Scheduler.mdo' });
      addLog(res);
    } catch (e) { addLog(`[ERROR] ${e}`); }
  };

  const handleSchedulerTick = async () => {
    try {
      await invoke('cmd_set_state', { key: 'action', valType: 'String', valStr: 'SCHEDULE_NEXT' });
      await invoke('cmd_set_state', { key: 'requestor_id', valType: 'String', valStr: 'System_Root' });
      await invoke('cmd_set_state', { key: 'requested_process_memory', valType: 'Int', valStr: '0' });
      await invoke('cmd_set_state', { key: 'default_time_slice', valType: 'Int', valStr: '1000' });

      const executionLog = await invoke('cmd_exec_mdo', { 
          mdoId: 'mdo_scheduler', 
          action: 'SCHEDULE_NEXT' 
      });
      executionLog.forEach(l => addLog(l));
      refreshState();
    } catch (e) { addLog(`[FATAL ERROR] ${e}`); }
  };
  
  // --- File System Functions ---
  const handleLoadFile = async () => {
      try {
        const res = await invoke('cmd_load_mdo', { filepath: 'File.mdo'});
        addLog(res);
      } catch (e) { addLog(`[ERROR] ${e}`); }
  };
  
  const handleCreateFileInstance = async () => {
      try {
        addLog("Populating world_state with required context for 'mdo_file'...");
        await invoke('cmd_set_state', { key: 'object_id', valType: 'String', valStr: 'my_document.txt'});
        await invoke('cmd_set_state', { key: 'owner_id', valType: 'String', valStr: 'React_UI'});
        await invoke('cmd_set_state', { key: 'system_max_file_size', valType: 'Int', valStr: '1024'});
        await invoke('cmd_set_state', { key: 'mime_type', valType: 'String', valStr: 'text/plain'});
        await invoke('cmd_set_state', { key: 'current_calculated_hash', valType: 'String', valStr: ''});
        addLog("File context created.");
        refreshState();
      } catch (e) { addLog(`[CONTEXT ERROR] ${e}`); }
  };

  const handleWriteFile = async () => {
      const dataToWrite = prompt("Enter data to write to file:", "Hello, GenesisOS!");
      if (dataToWrite) {
        try {
          const executionLog = await invoke('cmd_write_to_file', { 
              fileId: 'mdo_file', 
              data: dataToWrite 
          });
          executionLog.forEach(l => addLog(l));
          refreshState();
        } catch (e) {
            addLog(`[WRITE ERROR] ${e}`);
        }
      }
  };

  const handleReadFile = async () => {
      // SMART READ CALCULATION (Heartbleed Prevention bypass)
      let currentSize = 0;
      if (worldState.size) {
          const match = String(worldState.size).match(/Int\((\d+)\)/);
          if (match) currentSize = parseInt(match[1], 10);
      }

      let currentCursor = 0;
      if (worldState.read_cursor) {
          const match = String(worldState.read_cursor).match(/Int\((\d+)\)/);
          if (match) currentCursor = parseInt(match[1], 10);
      }

      let readLen = currentSize - currentCursor;

      if (readLen <= 0) {
          addLog("[READ] End of File reached. Nothing new to read.");
          return;
      }

      try {
        const executionLog = await invoke('cmd_read_from_file', { 
            fileId: 'mdo_file', 
            length: readLen 
        });
        executionLog.forEach(l => addLog(l));
        refreshState();
      } catch (e) {
          addLog(`[READ ERROR] ${e}`);
      }
  };

  return (
    <div style={containerStyle}>
      <h1>GenesisOS Glass Box Monitor</h1>
      
      <div style={controlsContainerStyle}>
        <div>
          <h3>System Controls</h3>
          <button onClick={() => setLogs([])} style={btnStyle}>Clear Logs</button>
          <button onClick={handleWipeMemory} style={btnStyle}>Wipe Memory (Reboot)</button>
        </div>
        <div>
            <h3>Scheduler</h3>
            <button onClick={handleLoadScheduler} style={btnStyle}>Load Scheduler.mdo</button>
            <button onClick={handleSchedulerTick} style={btnStyle}>Tick Scheduler</button>
        </div>
        <div>
            <h3>File System</h3>
            <button onClick={handleLoadFile} style={btnStyle}>1. Load File.mdo</button>
            <button onClick={handleCreateFileInstance} style={btnStyle}>2. Create File Context</button>
            <button onClick={handleWriteFile} style={btnStyle}>3. Write to File</button>
            <button onClick={handleReadFile} style={btnStyle}>4. Read File</button>
        </div>
      </div>

      <div style={fileViewerStyle}>
        <h3>File Content Viewer (`world_state.content`)</h3>
        <pre>{fileContent.replace(/^String\("(.*)"\)$/, '$1')}</pre> 
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={logBoxStyle}>
          <h3>Kernel Execution Log</h3>
          {logs.map((log, i) => <div key={i}>{log}</div>)}
          <div ref={logEndRef} />
        </div>
        <div style={stateBoxStyle}>
          <h3>Live World State</h3>
          {Object.entries(worldState).map(([key, val]) => (
            <div key={key}><strong>{key}</strong>: {val}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Styles ---
const containerStyle = { padding: '20px', fontFamily: 'monospace', color: '#00ff00', backgroundColor: '#000', minHeight: '100vh' };
const controlsContainerStyle = { display: 'flex', gap: '40px', marginBottom: '20px', flexWrap: 'wrap', borderBottom: '1px solid #333', paddingBottom: '10px' };
const btnStyle = { padding: '10px', marginTop: '5px', background: '#333', color: '#0f0', border: '1px solid #0f0', cursor: 'pointer', display: 'block' };
const logBoxStyle = { flex: 2, border: '1px solid #333', padding: '10px', height: '400px', overflowY: 'auto' };
const stateBoxStyle = { flex: 1, border: '1px solid #333', padding: '10px', height: '400px', overflowY: 'auto' };
const fileViewerStyle = { border: '1px solid #0ff', padding: '10px', marginBottom: '20px', backgroundColor: '#011', minHeight: '50px' };

export default App;
