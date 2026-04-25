export const name = 'Legacy C++ / Polyglot';

// MAP: Tokenize
export const tokenize = (input) => {
    return input.split('\n')
        .map((l, i) => ({ text: l.trim().replace(';', ''), lineNo: i + 1 }))
        .filter(l => l.text.length > 0 && !l.text.startsWith('//'));
};

// ITERATE: Parse Rules
export const parse = (token, context) => {
    const text = token.text;
        
    // --- NEW A. IMPORTS & DEPENDENCIES ---
    // Matches #include <iostream> or #include "my_header.h"
    const importMatch = text.match(/^#include\s*[<"]([^>"]+)[>"]/);
    if (importMatch) {
        return {
            matched: true,
            type: 'IMPORT',
            data: { 
                module: importMatch[1], 
                isSystem: text.includes('<') // True if <lib>, False if "file.h"
            }
        };
    }

    // Matches 'using namespace std;'
    const namespaceMatch = text.match(/^using\s+namespace\s+([^;]+)/);
    if (namespaceMatch) {
        return {
            matched: true,
            type: 'NAMESPACE',
            data: { namespace: namespaceMatch[1] }
        };
    }
    // --- A. DECLARATIONS ---
    
    // 1. Standard initialized declaration (e.g., int x = 5)
    const initVarMatch = text.match(/^(int|string|bool|float|double|char\*|void\*)\s+(\w+)\s*=\s*(.*)/);
    if (initVarMatch) {
        return {
            matched: true,
            type: 'DECLARATION',
            data: { type: initVarMatch[1], name: initVarMatch[2], value: initVarMatch[3].replace(/"/g, '') }
        };
    }

    // 2. Uninitialized or Multi-variable declarations (e.g., int num1, num2, sum;)
    const multiVarMatch = text.match(/^(int|string|bool|float|double|char\*|void\*)\s+([^=;]+)/);
    if (multiVarMatch) {
        const type = multiVarMatch[1];
        // Split by commas, trim whitespace, and clean up pointers/references
        const vars = multiVarMatch[2].split(',').map(v => v.trim().replace(/[*&]/g, ''));
        
        // The DiscoveryEngine's current logic assumes one variable per matched token.
        // To handle multiples cleanly without rewriting the core engine, we return the FIRST one
        // as the primary data, but we flag it so the engine knows it missed some.
        // In a future upgrade to DiscoveryEngine, this should return an Array of data objects.
        if (vars.length > 0) {
            return {
                matched: true,
                type: 'DECLARATION',
                data: { type: type, name: vars[0], value: null, _additional_vars: vars.slice(1) }
            };
        }
    }
    
    const pyVarMatch = text.match(/^\s*(self\.\w+|\w+)\s*=\s*(.*)/);
    if (pyVarMatch && !text.startsWith('if') && !text.startsWith('return') && !text.includes('==')) {
        return {
            matched: true,
            type: 'DECLARATION',
            data: { type: 'dynamic', name: pyVarMatch[1], value: pyVarMatch[2] }
        };
    }

    // --- B. LOGIC BLOCKS ---
    const ifMatch = text.match(/^if\s*\(?(.+?)\)?(:|\s*{)/);
    if (ifMatch) {
        return {
            matched: true,
            type: 'LOGIC_BLOCK',
            data: { condition: ifMatch[1] }
        };
    }

    // --- C. I/O STREAMS (C++ Specific) ---
    if (text.startsWith("cout") || text.startsWith("std::cout")) {
        return {
            matched: true,
            type: 'EXECUTE',
            data: { command: "PRINT", args: text.replace(/^(std::)?cout\s*<<\s*/, '') }
        };
    }
    if (text.startsWith("cin") || text.startsWith("std::cin")) {
        return {
            matched: true,
            type: 'EXECUTE',
            data: { command: "INPUT", args: text.replace(/^(std::)?cin\s*>>\s*/, '') }
        };
    }

    // --- D. ASSIGNMENTS (Updates) ---
    const assignMatch = text.match(/^(\w+)\s*=\s*(.*)/);
    if (assignMatch) {
        return {
            matched: true,
            type: 'UPDATE_STATE',
            data: { variable: assignMatch[1], newValue: assignMatch[2] }
        };
    }

    // --- E. EXECUTION (Function Calls) ---
    const funcMatch = text.match(/^(\w+)\((.*)\)/);
    if (funcMatch) {
        return {
            matched: true,
            type: 'EXECUTE',
            data: { command: funcMatch[1], args: funcMatch[2] }
        };
    }

    // --- F. CONTROL FLOW ---
    const ctrlMatch = text.match(/^(return|goto|break|continue|throw|raise)\s*(.*)/);
    if (ctrlMatch) {
        return {
            matched: true,
            type: 'CONTROL_FLOW',
            data: { command: ctrlMatch[1], args: ctrlMatch[2] }
        };
    }

    // --- G. CLOSING ---
    if (text.includes('}')) {
        return { matched: true, type: 'CLOSE_BLOCK' };
    }

    return { matched: false };
};

// CHECK: Security Rules
export const scan = (token) => {
    const vulns = [];
    const text = token.text;

    if (text.includes('strcpy') || text.includes('gets') || text.includes('sprintf') || text.includes('memcpy')) {
        vulns.push({ 
            severity: 'CRITICAL', 
            line: token.lineNo, 
            finding: `Unsafe memory function: '${text.split('(')[0]}'`, 
            remediation: 'Use strncpy, snprintf, or Rust types.' 
        });
    }

    if (text.match(/password\s*=\s*".+"/i) || text.match(/key\s*=\s*".+"/i) || text.match(/secret\s*=\s*".+"/i)) {
        vulns.push({ 
            severity: 'HIGH', 
            line: token.lineNo, 
            finding: 'Hardcoded Credential', 
            remediation: 'Move secrets to environment variables.' 
        });
    }

    if (text.match(/SELECT.*"\s*\+\s*\w+/i) || text.match(/INSERT.*"\s*\+\s*\w+/i)) {
        vulns.push({ 
            severity: 'CRITICAL', 
            line: token.lineNo, 
            finding: 'SQL Injection Risk', 
            remediation: 'Use parameterized queries.' 
        });
    }

    if (text.includes('auth_bypass') || text.includes('debug_mode')) {
         vulns.push({ 
             severity: 'MEDIUM', 
             line: token.lineNo, 
             finding: 'Potential Logic Backdoor', 
             remediation: 'Review debug flags in production logic.' 
         });
    }

    return vulns;
};