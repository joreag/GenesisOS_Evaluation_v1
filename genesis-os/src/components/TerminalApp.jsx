import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { invoke } from '@tauri-apps/api/core';
import 'xterm/css/xterm.css';

const TerminalApp = () => {
    const terminalRef = useRef(null);
    const xtermRef = useRef(null);
    const commandBufferRef = useRef('');

    useEffect(() => {
        if (xtermRef.current) return; // Prevent re-initialization on hot-reloads

        const term = new Terminal({
            theme: { background: '#0a0a0a', foreground: '#00ffff', cursor: '#00ffff' },
            fontFamily: 'monospace',
            cursorBlink: true
        });
        
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        
        term.open(terminalRef.current);
        fitAddon.fit();
        
        term.writeln('GenesisOS Native Terminal v1.0 (kMICT Governed)');
        term.write('user@genesis:~$ ');

        xtermRef.current = term;

        // --- THE UNIFIED COMMAND EXECUTION LOGIC ---
        const executeCommand = async (command) => {
            const term = xtermRef.current;
            if (!command.trim()) {
                term.write('\r\nuser@genesis:~$ ');
                return;
            }
    
            if (command.trim().toLowerCase() === 'clear') {
                term.clear();
                term.write('user@genesis:~$ ');
                return;
            }

            try {
                // Send the command to the MDO for Zero-Trust validation
                const executionLog = await invoke('cmd_exec_mdo', {
                    mdoId: 'mdo_terminal',
                    action: 'EXECUTE',
                    payload: {
                        "object_id": { "String": "system_terminal_0" },
                        "owner_id": { "String": "user_alice" },
                        "requestor_id": { "String": "user_alice" },
                        "requestor_token": { "String": "gsk_admin_override" },
                        "input_command": { "String": command }
                    }
                });

                // Parse the STDOUT from the log and write it to the terminal
                const outputLine = executionLog.find(l => l.includes("[HOST OS STDOUT]"));
                if (outputLine) {
                    const output = outputLine.split('->')[1]?.trim() || '';
                    term.write('\r\n' + output.replace(/\n/g, '\r\n'));
                }
                
                // Check if the command was rejected and show the Dissonance
                const errorLine = executionLog.find(l => l.includes("HALTED"));
                if (errorLine) {
                    const reason = errorLine.split('DISSONANCE DETECTED:')[1]?.trim() || 'Command rejected by security policy.';
                    term.write(`\r\n\x1b[31mGENESIS OS: ${reason}\x1b[0m`);
                }

            } catch (e) {
                term.write(`\r\n\x1b[31m[IPC FAULT] ${e}\x1b[0m`);
            }
            
            // Finally, write a new prompt line
            term.write('\r\nuser@genesis:~$ ');
        };
        // --- END UNIFIED LOGIC ---

        term.onKey(({ key, domEvent }) => {
            if (domEvent.keyCode === 13) { // Enter
                executeCommand(commandBufferRef.current);
                commandBufferRef.current = ''; 
            } else if (domEvent.keyCode === 8) { // Backspace
                if (commandBufferRef.current.length > 0) {
                    term.write('\b \b');
                    commandBufferRef.current = commandBufferRef.current.slice(0, -1);
                }
            } else if (!domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey) {
                term.write(key);
                commandBufferRef.current += key;
            }
        });

        const handleResize = () => fitAddon.fit();
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            // Don't dispose of the terminal on hot-reload, just detach listener
        };
    }, []); 

    return (
        <div style={{ width: '100%', height: '100%', padding: '10px', background: '#0a0a0a' }}>
            <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
        </div>
    );
};

export default TerminalApp;