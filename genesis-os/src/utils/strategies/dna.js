export const name = 'Genomic Sequencer';

    // MAP: Tokenize into Codons
export const tokenize = (input) => {
        const clean = input.replace(/[^ATCG]/gi, '').toUpperCase();
        const codons = [];
        for (let i = 0; i < clean.length; i += 3) {
            codons.push({
                text: clean.substring(i, i + 3),
                lineNo: Math.floor(i / 3) + 1,
                index: i
            });
        }
        return codons;
    }

    // ITERATE: Parse Genes
export const parse = (token) => {
        const codon = token.text;
        
        // Simplified Codon Table
        const aminoMap = {
            'ATG': 'Met (Start)', 
            'TAA': 'STOP', 'TAG': 'STOP', 'TGA': 'STOP',
            'AAA': 'Lys', 'AAC': 'Asn', 'AAG': 'Lys', 'AAT': 'Asn',
            'ACA': 'Thr', 'ACC': 'Thr', 'ACG': 'Thr', 'ACT': 'Thr',
            'CCA': 'Pro', 'CCC': 'Pro', 'CCG': 'Pro', 'CCT': 'Pro',
            'GGA': 'Gly', 'GGC': 'Gly', 'GGG': 'Gly', 'GGT': 'Gly',
            'TTC': 'Phe', 'TTT': 'Phe'
            // (Add full table for production)
        };

        if (aminoMap[codon]) {
            // 1. Start Codon -> Logic Block
            if (aminoMap[codon] === 'Met (Start)') {
                return { 
                    matched: true, 
                    type: 'LOGIC_BLOCK', 
                    data: { condition: `GENE_START (Pos ${token.lineNo})` }
                };
            }
            
            // 2. Stop Codon -> Flow Control
            if (aminoMap[codon] === 'STOP') {
                return { 
                    matched: true, 
                    type: 'CONTROL_FLOW', 
                    data: { command: 'TERMINATE', args: `Sequence at ${token.lineNo}` }
                };
            }
            
            // 3. Amino Acid -> Variable Declaration
            // FIX: Changed from UPDATE_STATE to DECLARATION so it shows in Dict
            return { 
                matched: true, 
                type: 'DECLARATION', 
                data: { 
                    type: 'Amino', 
                    name: `${token.lineNo}_${codon}`, // Unique ID: Pos_Codon
                    value: aminoMap[codon] 
                } 
            };
        }
        
        return { matched: false };
    }

    // CHECK: Mutation Scanning
export const scan = (token) => {
        const vulns = [];
        if (token.text === 'TAG' && token.lineNo < 5) {
             vulns.push({ severity: 'CRITICAL', line: token.lineNo, finding: 'Premature Stop Codon', remediation: 'CRISPR Gene Edit Required' });
        }
        if (token.text.length < 3) {
            vulns.push({ severity: 'HIGH', line: token.lineNo, finding: 'Frameshift Mutation', remediation: 'Realign Sequence' });
        }
        return vulns;
    };
