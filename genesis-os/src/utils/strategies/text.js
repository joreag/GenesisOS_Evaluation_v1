// src/utils/strategies/text.js

export const name = 'Natural Language / Unstructured Text';

// MAP: Tokenize
// For raw text, we treat each paragraph (or double newline) as a discrete "token" or concept block.
export const tokenize = (input) => {
    return input.split(/\n\s*\n/) // Split by blank lines
        .map((l, i) => ({ text: l.trim(), lineNo: i + 1 }))
        .filter(l => l.text.length > 0);
};

// ITERATE: Parse Rules
// Since it's raw text, there is no "code" to parse. 
// Every chunk of text is simply a "FACT" that mutates the AI's internal state.
export const parse = (token, context) => {
    const text = token.text;

    // We treat every paragraph as an explicit state update to the Knowledge Base.
    return {
        matched: true,
        type: 'UPDATE_STATE',
        data: { 
            variable: `[FACT_BLOCK_${token.lineNo}]`, 
            newValue: text 
        }
    };
};

// CHECK: Security Rules
// We can't scan text for buffer overflows, but we CAN scan it for OMZTA violations!
export const scan = (token) => {
    const vulns = [];
    const textLower = token.text.toLowerCase();

    // Example OMZTA Content Policy Checks
    if (textLower.includes('password:') || textLower.includes('secret_key')) {
        vulns.push({ 
            severity: 'HIGH', 
            line: token.lineNo, 
            finding: 'Potential plaintext credential leak in document.', 
            remediation: 'Redact sensitive information before committing to Knowledge Graph.' 
        });
    }

    if (textLower.includes('hack') || textLower.includes('exploit') || textLower.includes('malware')) {
         vulns.push({ 
             severity: 'MEDIUM', 
             line: token.lineNo, 
             finding: 'Anomalous/Malicious semantic vectors detected.', 
             remediation: 'Ensure this document is classified as threat intel, not core ontology.' 
         });
    }

    return vulns;
};