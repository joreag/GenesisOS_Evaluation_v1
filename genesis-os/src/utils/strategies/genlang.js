// src/utils/strategies/genlang.js

export const name = 'Genesis Logic Language (GenLang)';

export const tokenize = (input) => {
    return input.split('\n')
        .map((l, i) => ({ text: l.trim(), lineNo: i + 1 }))
        .filter(l => l.text.length > 0 && !l.text.startsWith('//'));
};

export const parse = (token, context) => {
    const text = token.text;

    // A. DECLARATIONS (requires, state, let)
    // Matches: requires object_id: String; OR state size: Int = 0;
    const declMatch = text.match(/^(requires|state|let)\s+([a-zA-Z0-9_]+)\s*:\s*([a-zA-Z0-9_<>]+)(?:\s*=\s*(.*))?;/);
    if (declMatch) {
        return {
            matched: true,
            type: 'DECLARATION',
            data: { kind: declMatch[1], name: declMatch[2], type: declMatch[3], value: declMatch[4] ? declMatch[4].replace(/"/g, '') : null }
        };
    }

    // B. THE ZERO-TRUST GATES (assert => Dissonance)
    const assertMatch = text.match(/^assert\s*\((.*)\)\s*=>\s*Dissonance\s*\((.*)\);/);
    if (assertMatch) {
        return {
            matched: true,
            type: 'LOGIC_BLOCK', // We treat this as a logic block because it halts execution
            data: { condition: `ASSERT: ${assertMatch[1]}`, actions: [`THROW DISSONANCE: ${assertMatch[2]}`] }
        };
    }

    // C. STATE MUTATIONS (emit)
    const emitMatch = text.match(/^(emit|emit_to_requestor)\s*{(.*)}/);
    if (emitMatch) {
        return {
            matched: true,
            type: 'UPDATE_STATE',
            data: { variable: `[${emitMatch[1].toUpperCase()}]`, newValue: emitMatch[2].trim() }
        };
    }

    // D. LOGIC BLOCKS (If statements)
    const ifMatch = text.match(/^if\s*\((.+?)\)\s*{/);
    if (ifMatch) {
        return {
            matched: true,
            type: 'LOGIC_BLOCK',
            data: { condition: ifMatch[1] }
        };
    }

    // E. ASSIGNMENTS
    const assignMatch = text.match(/^([a-zA-Z0-9_]+)\s*=\s*(.*);/);
    if (assignMatch && !text.includes('==')) {
        return {
            matched: true,
            type: 'UPDATE_STATE',
            data: { variable: assignMatch[1], newValue: assignMatch[2] }
        };
    }

    // F. CLOSING BRACES
    if (text === '}') {
        return { matched: true, type: 'CLOSE_BLOCK' };
    }

    return { matched: false };
};

// CHECK: Security Rules
export const scan = (token) => {
    const vulns = [];
    const text = token.text;

    // In GenLang, we scan for LACK of security or anti-patterns!
    if (text.match(/^state\s+\w+\s*:\s*\w+\s*;/)) {
        vulns.push({ 
            severity: 'HIGH', 
            line: token.lineNo, 
            finding: 'Uninitialized State Variable', 
            remediation: 'All state variables in GenLang must have a default value (e.g., = null).' 
        });
    }

    if (text.includes('while') || text.includes('for (')) {
        vulns.push({ 
            severity: 'CRITICAL', 
            line: token.lineNo, 
            finding: 'Turing-Complete Loop Detected', 
            remediation: 'GenLang prohibits unbounded loops. Use the Scheduler for cyclic execution.' 
        });
    }

    return vulns;
};