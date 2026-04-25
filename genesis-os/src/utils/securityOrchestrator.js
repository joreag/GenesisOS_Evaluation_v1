const { MICT } = require('../utils/mict-framework');

/**
 * SECURITY ORCHESTRATOR
 * The Governance Layer that manages the Red/Blue interaction.
 * ENFORCES: Protocol 2 "Red Reports to Blue" (Exploit Data Suppression)
 */

exports.runSecurityScan = async (req, res) => {
    const scanCycle = new MICT({
        initialState: {
            targetCode: req.body.code || "",
            // Internal High-Security State (Never sent to client)
            redState: {
                vulnerabilities: [],
                activeExploits: [] // <--- RADIOACTIVE DATA
            },
            // Public State (Safe to send)
            blueState: {
                patches: [],
                riskAssessment: null
            }
        },
        stages: ['map_territory', 'iterate_red_attack', 'check_blue_defense', 'transform_sanitized_report'],
        
        stageFunctions: {
            // 1. MAP: Ingest Code
            'map_territory': async (state) => {
                if (!state.targetCode) throw new Error("No target code provided.");
                return state;
            },

            // 2. ITERATE: GUARDIAN RED (The Simulation)
            'iterate_red_attack': async (state) => {
                // In a real system, this calls the Red AI Model.
                // For this architectural demo, we simulate the findings.
                
                const findings = [];
                const exploits = [];

                // Logic: Detect simple buffer issue (Mock)
                if (state.targetCode.includes('strcpy') || state.targetCode.includes('gets')) {
                    findings.push({
                        id: 'VULN-001',
                        type: 'Buffer Overflow',
                        location: 'Line 5: Unsafe strcpy detected'
                    });
                    
                    // GENERATE EXPLOIT (The Dangerous Part)
                    exploits.push({
                        vulnId: 'VULN-001',
                        payload: 'A'.repeat(512) + '\x90\x90\xEB\x04', // Shellcode signature
                        vector: 'Input String > 256 bytes'
                    });
                }

                return {
                    ...state,
                    redState: {
                        vulnerabilities: findings,
                        activeExploits: exploits 
                    }
                };
            },

            // 3. CHECK: GUARDIAN BLUE (The Immunization)
            'check_blue_defense': async (state) => {
                const patches = [];
                
                // Blue analyzes Red's work
                for (const exploit of state.redState.activeExploits) {
                    // Blue AI generates code to stop this specific exploit
                    if (exploit.type === 'Buffer Overflow' || exploit.vulnId === 'VULN-001') {
                        patches.push({
                            vulnId: exploit.vulnId,
                            fix: `// BLUE TEAM PATCH\nif (src_len < dest_len) {\n    strncpy(dest, src, dest_len);\n} else {\n    return ERR_BUFFER_OVERFLOW;\n}`
                        });
                    }
                }

                return {
                    ...state,
                    blueState: {
                        patches: patches,
                        riskAssessment: "HIGH - Remote Code Execution possible without patch."
                    }
                };
            },

            // 4. TRANSFORM: The "Data Diode" (Sanitization)
            'transform_sanitized_report': async (state) => {
                // CRITICAL SAFETY PROTOCOL:
                // We deliberately construct a new object excluding 'redState.activeExploits'.
                // The weaponized payload dies here.
                
                return {
                    ...state,
                    finalReport: {
                        scanTime: new Date(),
                        threatLevel: state.blueState.riskAssessment,
                        findings: state.redState.vulnerabilities.map(v => ({
                            issue: v.type,
                            location: v.location,
                            // We pair the finding with the solution immediately
                            proposedSolution: state.blueState.patches.find(p => p.vulnId === v.id)?.fix || "Manual Review Required"
                        }))
                    }
                };
            }
        }
    });

    try {
        const result = await scanCycle.run();
        
        // Final sanity check before wire transmission
        if (result.redState) {
            // Explicitly nuke it just in case logic leaked it to top level
            delete result.redState; 
        }

        res.json({
            success: true,
            data: result.finalReport // Only the sanitized report goes out
        });

    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};