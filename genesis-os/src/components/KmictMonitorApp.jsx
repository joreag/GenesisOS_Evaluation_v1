import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// This is the "Glass Box" UI, now encapsulated as a standalone app
const KmictMonitorApp = () => {
  const [logs, setLogs] = useState([]);
  const [worldState, setWorldState] = useState({});
  const [fileContent, setFileContent] = useState("");
  const logEndRef = useRef(null);

  useEffect(() => {
    invoke('boot_kmict').then(msg => addLog(msg)).catch(e => addLog(`[BOOT ERROR] ${e}`));
    refreshState();
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

    // This is the "Heartbeat" listener
  useEffect(() => {
    const unlisten = listen('kmict-state-change', (event) => {
      console.log('Heartbeat received! Refreshing monitor state.');
      refreshState();
    });
    // Cleanup function to unsubscribe when the component unmounts
    return () => {
      unlisten.then(f => f());
    };
  }, []);

  const addLog = (msg) => setLogs(prev => [...prev, msg]);
  
  const refreshState = async () => {
    try {
      const state = await invoke('get_kmict_world_state');
      setWorldState(state);
      if (state.content) {
        setFileContent(state.content);
      }
    } catch (e) { addLog(`[STATE REFRESH ERROR] ${e}`); }
  };

  const handleWipeMemory = async () => {
      await invoke('wipe_kmict_memory'); 
      setLogs(['--- kMICT MEMORY WIPED. ---']); 
      setFileContent('');
      refreshState();
  };

  const handleLoadMdo = async (filename) => {
      try {
        const res = await invoke('cmd_load_mdo', { filepath: filename });
        addLog(res);
      } catch (e) {
        addLog(`[LOAD ERROR] for ${filename}: ${e}`);
      }
    };
  
  const handleCreateFileInstance = async () => {
      try {
        addLog("Populating context for 'mdo_file'...");
        await invoke('cmd_set_state', { key: 'object_id', valType: 'String', valStr: 'my_document.txt'});
        await invoke('cmd_set_state', { key: 'owner_id', valType: 'String', valStr: 'React_UI'});
        await invoke('cmd_set_state', { key: 'system_max_file_size', valType: 'Int', valStr: '1024'});
        await invoke('cmd_set_state', { key: 'mime_type', valType: 'String', valStr: 'text/plain'});
        await invoke('cmd_set_state', { key: 'current_calculated_hash', valType: 'String', valStr: ''});
                // --- ADD THIS LINE: The VIP Pass ---
        await invoke('cmd_set_state', { key: 'requestor_token', valType: 'String', valStr: 'gsk_admin_override'});
        addLog("File context created.");
        refreshState();
      } catch (e) { addLog(`[CONTEXT ERROR] ${e}`); }
  };

  const handleWriteFile = async () => {
      const data = prompt("Data to write:", "Hello, GenesisOS!");
      if (data) {
        try {
          const log = await invoke('cmd_write_to_file', { fileId: 'mdo_file', data });
          log.forEach(l => addLog(l));
          refreshState();
        } catch (e) { addLog(`[WRITE ERROR] ${e}`); }
      }
  };
  const handleLoadLedger = async () => {
      try {
        const res = await invoke('cmd_load_mdo', { filepath: 'Ledger.mdo'});
        addLog(res);
      } catch (e) { addLog(`[ERROR] ${e}`); }
  };

  const handleMintCoins = async () => {
        try {
          // 1. Create the System Account (if it doesn't exist)
          let sysKeys;
          try {
              sysKeys = await invoke('get_user_keys', { userId: 'user_System_Mint' });
              if (!sysKeys.public_key) throw new Error("Keys not found");
          } catch {
              await invoke('create_user_identity', { username: 'System_Mint' });
              sysKeys = await invoke('get_user_keys', { userId: 'user_System_Mint' });
          }


          const genesisBalances = {};
          genesisBalances[sysKeys.public_key] = { "Float": 1000000.0 }; // 1M Coins

          // Send it to Rust, explicitly declaring it as a "Dictionary" type
          await invoke('cmd_set_state', { 
              key: 'balances', 
              valType: 'Dictionary', // <-- NEW TYPE
              valStr: JSON.stringify(genesisBalances) // Just clean JSON
          });
            // ---------------------------------------

                    // 1. Get Alice's public key to use as her address
          const aliceKeys = await invoke('get_user_keys', { userId: 'user_alice' });
          if (!aliceKeys || !aliceKeys.public_key) {
              addLog("Error: Create user 'alice' in Login Test first!");
              return;
          }  

          // 2. Generate the Transaction Record EXACTLY as Rust expects it
          const nonce = `nonce_${Date.now()}`;
          const sender = sysKeys.public_key;
          const receiver = aliceKeys.public_key;
          const task = "GENESIS_BLOCK_MINT";
          // In Ledger.gen: append(tx_sender, append(tx_receiver, append(task_reference, tx_nonce)))
          const tx_record = `${sender}${receiver}${task}${nonce}`;

          // 3. Sign
          const signature = await invoke('sign_challenge', { privateKey: sysKeys.private_key, challenge: tx_record });

          // 4. Send Payload
          const executionLog = await invoke('cmd_exec_mdo', { 
              mdoId: 'mdo_ledger', 
              action: 'PROCESS_TRANSACTION',
              payload: {
                  "tx_sender": { "String": sender },
                  "tx_receiver": { "String": receiver },
                  "tx_amount": { "Float": 100.0 }, 
                  "tx_signature": { "String": signature }, 
                  "tx_nonce": { "String": nonce },
                  "task_reference": { "String": task }
              }
          });
          executionLog.forEach(l => addLog(l));
          refreshState();
        } catch (e) { addLog(`[EXECUTION ERROR] ${e}`); }
    };

  const handleCreateAIContext = async () => {
      try {
        addLog("Initializing AI Agent 'mdo_jarvits' in world_state...");
        await invoke('cmd_set_state', { key: 'mdo_jarvits_object_id', valType: 'String', valStr: 'mdo_jarvits'});
        await invoke('cmd_set_state', { key: 'mdo_jarvits_owner_id', valType: 'String', valStr: 'System_Root'});
        await invoke('cmd_set_state', { key: 'mdo_jarvits_dopamine_level', valType: 'Float', valStr: '0.0'});
        await invoke('cmd_set_state', { key: 'mdo_jarvits_knowledge_base_id', valType: 'String', valStr: 'kb_jarvits.txt'});
        // --- ADD THIS LINE: Give the AI its Zero-Trust passport ---
        await invoke('cmd_set_state', { key: 'mdo_jarvits_session_token', valType: 'String', valStr: 'gsk_admin_override'});
        
        // --- THE DEFINITIVE FIX: Fully Populate the File Context ---
        addLog("Initializing AI Knowledge Base file 'kb_jarvits.txt'...");
        await invoke('cmd_set_state', { key: 'kb_jarvits.txt_object_id', valType: 'String', valStr: 'kb_jarvits.txt'});
        await invoke('cmd_set_state', { key: 'kb_jarvits.txt_owner_id', valType: 'String', valStr: 'mdo_jarvits'});
        await invoke('cmd_set_state', { key: 'kb_jarvits.txt_content', valType: 'String', valStr: 'Genesis Block: The universe is a computable structure.'});
        await invoke('cmd_set_state', { key: 'kb_jarvits.txt_size', valType: 'Int', valStr: '51'});
        
        // ADD THESE THREE LINES:
        await invoke('cmd_set_state', { key: 'kb_jarvits.txt_mime_type', valType: 'String', valStr: 'text/plain'});
        await invoke('cmd_set_state', { key: 'kb_jarvits.txt_current_calculated_hash', valType: 'String', valStr: ''});
        await invoke('cmd_set_state', { key: 'kb_jarvits.txt_system_max_file_size', valType: 'Int', valStr: '1024000'});
        // -----------------------------------------------------------

        addLog("AI Context and Knowledge Base initialized.");
        refreshState();
      } catch (e) { addLog(`[CONTEXT ERROR] ${e}`); }
  };

  const handleRewardAI = async () => {
      try {
        const aliceKeys = await invoke('get_user_keys', { userId: 'user_alice' });
        if (!aliceKeys || !aliceKeys.public_key) {
            addLog("Error: Create user 'alice' in Login Test first!");
            return;
        }

        const nonce = `nonce_${Date.now()}`;
        const sender = aliceKeys.public_key;
        const receiver = "mdo_jarvits"; // The AI's process ID
        const task = "DOJO_FLASHCARD_CORRECT";
        const tx_record = `${sender}${receiver}${task}${nonce}`;

        const signature = await invoke('sign_challenge', { privateKey: aliceKeys.private_key, challenge: tx_record });

        // This command targets the Ledger to process the transaction
        const executionLog = await invoke('cmd_exec_mdo', { 
            mdoId: 'mdo_ledger', 
            action: 'PROCESS_TRANSACTION',
            payload: {
                "tx_sender": { "String": sender }, 
                "tx_receiver": { "String": receiver },
                "tx_amount": { "Float": 5.0 }, 
                "tx_signature": { "String": signature }, 
                "tx_nonce": { "String": nonce },
                "task_reference": { "String": task }
            }
        });
        executionLog.forEach(l => addLog(l));
        refreshState();
      } catch (e) { addLog(`[EXECUTION ERROR] ${e}`); }
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
  const handleLoadSocket = async () => {
      try {
        const res = await invoke('cmd_load_mdo', { filepath: 'NetworkSocket.mdo'});
        addLog(res);
      } catch (e) { addLog(`[ERROR] ${e}`); }
  };

  const handleConnectSocket = async () => {
      try {
        addLog("Populating context for NetworkSocket...");
        await invoke('cmd_set_state', { key: 'owner_id', valType: 'String', valStr: 'user_alice' });
        await invoke('cmd_set_state', { key: 'protocol', valType: 'String', valStr: 'TCP'});
        await invoke('cmd_set_state', { key: 'local_port', valType: 'Int', valStr: '8080'});
        await invoke('cmd_set_state', { key: 'security_policy_id', valType: 'String', valStr: 'policy_block_malware'});
        
        const executionLog = await invoke('cmd_exec_mdo', { 
            mdoId: 'mdo_networksocket', 
            action: 'CONNECT',
            payload: {
                "object_id": { "String": "socket_8080" }, 
                "input_target_ip": { "String": "8.8.8.8" }, // A "trusted" IP
                 // Provide dummy values for unused requires
                "input_payload": { "String": "" },
                "network_hardware_interrupt_payload": { "String": "" }
            }
        });
        executionLog.forEach(l => addLog(l));
        refreshState();
      } catch (e) { addLog(`[CONNECT ERROR] ${e}`); }
  };

  const handleSendSocket = async (isMalicious) => {
        const data = isMalicious ? "this is malware" : "this is a safe message";
        addLog(`Attempting to send: "${data}"`);
        try {
          const executionLog = await invoke('cmd_exec_mdo', { 
              mdoId: 'mdo_networksocket', 
              action: 'SEND',
              // No more sourceId argument
              payload: {
                  "object_id": { "String": "socket_8080" },
                  "requestor_id": { "String": "user_alice" }, // <-- THE CRITICAL FIX
                  "input_payload": { "String": data },
                  "input_target_ip": { "String": "" },
                  "network_hardware_interrupt_payload": { "String": "" }
              }
          });
          executionLog.forEach(l => addLog(l));
          refreshState();
        } catch (e) { addLog(`[SEND ERROR] ${e}`); }
  };
  const handleCreateProcesses = async () => {
    try {
        addLog("Initializing Process A (proc_alpha) in world_state...");
        // This process will just increment a counter
        await invoke('cmd_set_state', { key: 'proc_alpha_object_id', valType: 'String', valStr: 'proc_alpha'});
        await invoke('cmd_set_state', { key: 'proc_alpha_owner_id', valType: 'String', valStr: 'System_Root'});
        await invoke('cmd_set_state', { key: 'proc_alpha_execution_state', valType: 'String', valStr: 'READY'});
        await invoke('cmd_set_state', { key: 'proc_alpha_instruction_cursor', valType: 'Int', valStr: '0'});
        await invoke('cmd_set_state', { key: 'proc_alpha_resource_quota_cycles', valType: 'Int', valStr: '10'});
        // We need to pass a mock instruction set
       const instructionsA = [ { "String": "INCREMENT_A" }, { "String": "INCREMENT_A" }, { "String": "HALT" } ];
        await invoke('cmd_set_state', { 
            key: 'proc_alpha_instruction_set', 
            valType: 'Array', // <-- Use the Array type
            valStr: JSON.stringify(instructionsA) // <-- Send clean JSON
        });


        addLog("Initializing Process B (proc_beta) in world_state...");
        // This process will increment a different counter
        await invoke('cmd_set_state', { key: 'proc_beta_object_id', valType: 'String', valStr: 'proc_beta'});
        await invoke('cmd_set_state', { key: 'proc_beta_owner_id', valType: 'String', valStr: 'System_Root'});
        await invoke('cmd_set_state', { key: 'proc_beta_execution_state', valType: 'String', valStr: 'READY'});
        await invoke('cmd_set_state', { key: 'proc_beta_instruction_cursor', valType: 'Int', valStr: '0'});
        await invoke('cmd_set_state', { key: 'proc_beta_resource_quota_cycles', valType: 'Int', valStr: '10'});
        const instructionsB = [ { "String": "INCREMENT_B" }, { "String": "INCREMENT_B" }, { "String": "HALT" } ];
        await invoke('cmd_set_state', { 
            key: 'proc_beta_instruction_set', 
            valType: 'Array', // <-- Use the Array type
            valStr: JSON.stringify(instructionsB) // <-- Send clean JSON
        });

        addLog("Processes created. Now add them to the Scheduler's ready_queue.");
        // We pass the ready_queue as a JSON string and tell Rust to parse it as an Array
        const readyQueue = [ { "String": "proc_alpha" }, { "String": "proc_beta" } ];
        await invoke('cmd_set_state', { 
            key: 'ready_queue', 
            valType: 'Array', // Use the new Array type
            valStr: JSON.stringify(readyQueue)
        });

        refreshState();
    } catch (e) { addLog(`[PROCESS CREATE ERROR] ${e}`); }
  };

  const handleSchedulerTick = async () => {
    addLog("--- SCHEDULER: Initiating Context Switch Tick ---");
    try {
      // We must provide the 'requires' context for the Scheduler MDO to run
      const executionLog = await invoke('cmd_exec_mdo', { 
          mdoId: 'mdo_scheduler', 
          action: 'SCHEDULE_NEXT',
          payload: {
            "requestor_id": {"String": "System_Root"},
            "default_time_slice": {"Int": 1000},
            "requested_process_memory": {"Int": 0} // Not spawning, so 0 is fine
          }
      });
      executionLog.forEach(l => addLog(l));
      refreshState();
    } catch (e) { addLog(`[SCHEDULER ERROR] ${e}`); }
  };
  const handleHardwareTest = async (isHardwareReady) => {
      // In bare metal, the Rust Kernel reads the physical register (e.g., 0x3F8 + 5)
      // BEFORE it runs the MDO, and injects the value into the payload.
      // We simulate that hardware read here. 
      // 32 (0x20) means the buffer is empty and ready. 0 means it is busy/broken.
      const hardwareStatusRegisterValue = isHardwareReady ? 32 : 0;
      
      const charToWrite = "G"; 
      addLog(`[KERNEL LOGGER] Attempting to write '${charToWrite}' to UART...`);

      try {
        const executionLog = await invoke('cmd_exec_mdo', { 
            mdoId: 'mdo_uartdriver', // Target our new driver blueprint
            action: 'WRITE',
            payload: {
                // The Zero-Trust Credentials
                "requestor_id": { "String": "System_Kernel_Logger" },
                "requestor_token": { "String": "gsk_admin_override" },
                
                // The data to write
                "input_char": { "String": charToWrite },
                
                // The injected hardware telemetry
                "hardware_status_register": { "Int": hardwareStatusRegisterValue }
            }
        });
        executionLog.forEach(l => addLog(l));
        refreshState();
      } catch (e) { addLog(`[HARDWARE ERROR] ${e}`); }
  };

  return (
    <div style={containerStyle}>
      <div style={controlsContainerStyle}>
        <div>
          <h3>System Controls</h3>
          <button onClick={() => setLogs([])} style={btnStyle}>Clear Logs</button>
          <button onClick={handleWipeMemory} style={btnStyle}>Wipe Memory</button>
        </div>
        <div>
            <h3>Load Core Modules</h3>
            <button onClick={() => handleLoadMdo('File.mdo')} style={btnStyle}>Load File</button>
            <button onClick={() => handleLoadMdo('Scheduler.mdo')} style={btnStyle}>Load Scheduler</button>
            <button onClick={() => handleLoadMdo('Identity.mdo')} style={btnStyle}>Load Identity</button>
            <button onClick={() => handleLoadMdo('Ledger.mdo')} style={btnStyle}>Load Ledger</button>
            <button onClick={() => handleLoadMdo('NetworkSocket.mdo')} style={btnStyle}>Load Socket</button>
            <button onClick={() => handleLoadMdo('Process.mdo')} style={btnStyle}>Load Process</button>
            <button onClick={() => handleLoadMdo('Jarvits.mdo')} style={btnStyle}>Load Jarvits</button>
            <button onClick={() => handleLoadMdo('UartDriver.mdo')} style={btnStyle}>Load UartDriver</button>
            <button onClick={() => handleLoadMdo('Terminal.mdo')} style={btnStyle}>Load Terminal</button>
        </div>
        
        {/* --- NEW: The AI Agent Control Section --- */}
        <div>
            <h3>AI Agent Control</h3>
            <button onClick={handleCreateAIContext} style={btnStyle}>1. Initialize AI Context</button>
            <button onClick={handleRewardAI} style={btnStyle}>2. Reward AI (Dopamine Test)</button>
        </div>
        
        {/* --- NEW: The Multi-Process Test Section --- */}
        <div>
            <h3>Multi-Process Scheduler Test</h3>
            <button onClick={handleCreateProcesses} style={btnStyle}>1. Create Proc A & B</button>
            <button onClick={handleSchedulerTick} style={btnStyle}>2. Tick Scheduler</button>
        </div>
          </div>
          <div>
            <h3>The Dojo / Ledger</h3>
            <button onClick={handleLoadLedger} style={btnStyle}>1. Load Ledger.mdo</button>
            <button onClick={handleMintCoins} style={btnStyle}>2. Mint 100 MICT-Coins to Alice</button>
            <button onClick={handleRewardAI} style={btnStyle}>3. Reward AI 5 Coins</button>
        </div>
        <div>
            <h3>Network (OMZTA)</h3>
            <button onClick={handleLoadSocket} style={btnStyle}>1. Load Socket.mdo</button>
            <button onClick={handleConnectSocket} style={btnStyle}>2. Connect to 8.8.8.8</button>
            <button onClick={() => handleSendSocket(false)} style={btnStyle}>3. Send Safe Data</button>
            <button onClick={() => handleSendSocket(true)} style={{...btnStyle, color: '#f00', borderColor: '#f00'}}>4. Send "Malware"</button>
        </div>
                {/* --- NEW: Bare Metal Hardware Test --- */}
        <div>
            <h3>Bare Metal Hardware Tests</h3>
            <button onClick={() => handleHardwareTest(true)} style={btnStyle}>1. Write to UART (Hardware Ready)</button>
            <button onClick={() => handleHardwareTest(false)} style={{...btnStyle, color: '#f00', borderColor: '#f00'}}>2. Write to UART (Hardware Fault)</button>
        </div>
      <div style={fileViewerStyle}>
        <h3>File Content (`world_state.content`)</h3>
        <pre>{String(fileContent).replace(/^String\("(.*)"\)$/, '$1')}</pre> 
      </div>
      <div style={{ display: 'flex', gap: '10px', height: 'calc(100% - 180px)' }}>
        <div style={logBoxStyle}>
          <h4>kMICT Execution Log</h4>
          {logs.map((log, i) => <div key={i}>{log}</div>)}
          <div ref={logEndRef} />
        </div>
        <div style={stateBoxStyle}>
          <h4>Live World State</h4>
          {Object.entries(worldState).map(([key, val]) => (<div key={key}><strong>{key}</strong>: {val}</div>))}
        </div>
      </div>
    </div>
  );
};

// Styles (simplified for brevity)
const containerStyle = { padding: '10px', fontFamily: 'monospace', color: '#ccc', backgroundColor: '#111', height: '100%', boxSizing: 'border-box' };
const controlsContainerStyle = { display: 'flex', gap: '20px', marginBottom: '10px' };
const btnStyle = { padding: '5px', background: '#333', color: '#0f0', border: '1px solid #0f0', cursor: 'pointer' };
const logBoxStyle = { flex: 2, border: '1px solid #333', padding: '5px', overflowY: 'auto' };
const stateBoxStyle = { flex: 1, border: '1px solid #333', padding: '5px', overflowY: 'auto' };
const fileViewerStyle = { border: '1px solid #0ff', padding: '5px', marginBottom: '10px', backgroundColor: '#011', minHeight: '40px' };

export default KmictMonitorApp;
