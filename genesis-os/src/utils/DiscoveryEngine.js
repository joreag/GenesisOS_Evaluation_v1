import { MICT } from './mict-framework-client';

// 1. Statically import your strategies
// (Ensure these files exist in src/utils/strategies/ and use 'export' syntax)
import * as cppStrategy from './strategies/cpp';
import * as dnaStrategy from './strategies/dna';
import * as genlangStrategy from './strategies/genlang';
import * as textStrategy from './strategies/text'; 

// 2. Map them for the UI selector
const STRATEGIES = {
    'cpp': cppStrategy,
    'dna': dnaStrategy,
    'genlang': genlangStrategy,
    'text': textStrategy
};

export const discoverLogic = async (inputData, type = 'cpp') => {
    // Fallback to CPP if strategy isn't found
    const strategy = STRATEGIES[type] || STRATEGIES['cpp'];
    
    const cycle = new MICT({
        initialState: {
            rawInput: inputData,
            strategy: strategy,
            tokens: [],
            logicTree: [], 
            variables: {}, 
            dependencies: {},
            anomalies: [],
            vulnerabilities: [],
            stats: { lines: 0 },
            mictBins: { map: [], iterate: [], check: [], transform: [] }
        },
        stages: ['map_tokenize', 'iterate_parser', 'check_vulnerability_scan', 'transform_mict_scaffold', 'transform_palm'],
        
        stageFunctions: {
            'map_tokenize': async (state) => {
                if (!state.strategy.tokenize) throw new Error("Strategy missing tokenize method");
                const tokens = state.strategy.tokenize(state.rawInput);
                return { ...state, tokens: tokens, stats: { lines: tokens.length } };
            },

            'iterate_parser': async (state) => {
                const logicStack = [];
                const variables = {};
                const dependencies = {}; 
                const extracted = [];
                const anomalies = [];

                const isDocumentStrategy = state.strategy.name && (state.strategy.name.includes('CMS') || state.strategy.name.includes('Document'));

                const addDep = (target, source) => {
                    if (!dependencies[target]) dependencies[target] = new Set();
                    dependencies[target].add(source);
                };

                state.tokens.forEach(token => {
                    const result = state.strategy.parse(token, variables);
                    
                    if (result.matched) {
                        const item = result.data; 

                         // --- NEW: Handle Imports and Namespaces ---
                        if (result.type === 'IMPORT') {
                            // We treat the current file (represented generically here) as depending on the imported module
                            // In a real multi-file parse, 'target' would be the current file's ID.
                            // For a single-file parse, we use a special key 'EXTERNAL_MODULES'.
                            addDep('EXTERNAL_MODULES', item.module);
                        }
                        else if (result.type === 'NAMESPACE') {
                            addDep('ACTIVE_NAMESPACES', item.namespace);
                        }
                        // ------------------------------------------

                        else if (result.type === 'DECLARATION') {
                            // 1. Process the primary variable
                            variables[item.name] = { type: item.type, name: item.name, initialValue: item.value };
                            if (item.value) {
                                Object.keys(variables).forEach(v => { if (item.value.includes(v)) addDep(item.name, v); });
                            }
                            
                            // 2. Process any additional comma-separated variables (e.g., int x, y, z;)
                            if (item._additional_vars) {
                                item._additional_vars.forEach(extraVar => {
                                    variables[extraVar] = { type: item.type, name: extraVar, initialValue: null };
                                });
                            }
                        }
                        else if (result.type === 'LOGIC_BLOCK') {
                            const block = { type: 'LOGIC_BLOCK', condition: item.condition, actions: item.actions || [] };
                            if (isDocumentStrategy) {
                                extracted.push(block);
                            } else {
                                extracted.push(block);
                                logicStack.push(block);
                                block.controlVars = [];
                                Object.keys(variables).forEach(v => { if (item.condition.includes(v)) block.controlVars.push(v); });
                            }
                        }
                        else if (result.type === 'UPDATE_STATE') {
                            const action = { type: 'UPDATE_STATE', variable: item.variable, newValue: item.newValue };
                            if (logicStack.length > 0 && !isDocumentStrategy) {
                                logicStack[logicStack.length - 1].actions.push(action);
                                logicStack[logicStack.length - 1].controlVars.forEach(cv => addDep(item.variable, cv));
                            } else {
                                extracted.push(action);
                            }
                            Object.keys(variables).forEach(v => { if (item.newValue.includes(v)) addDep(item.variable, v); });
                        }
                        else if (result.type === 'EXECUTE') {
                            const action = { type: 'EXECUTE', command: item.command, args: item.args };
                            if (logicStack.length > 0 && !isDocumentStrategy) logicStack[logicStack.length - 1].actions.push(action);
                            else extracted.push(action);
                        }
                        else if (result.type === 'CONTROL_FLOW') {
                            const action = { type: 'CONTROL_FLOW', command: item.command, args: item.args };
                            if (logicStack.length > 0 && !isDocumentStrategy) logicStack[logicStack.length - 1].actions.push(action);
                            else extracted.push(action);
                        }
                        else if (result.type === 'CLOSE_BLOCK') {
                            logicStack.pop();
                        }
                    } else {
                        if (token.text && token.text.length > 1) {
                            anomalies.push({ line: token.lineNo, text: token.text, reason: "Unknown Syntax" });
                        }
                    }
                });

                const depGraph = {};
                for (const [k, v] of Object.entries(dependencies)) depGraph[k] = Array.from(v);

                return { ...state, logicTree: extracted, variables, dependencies: depGraph, anomalies };
            },

            'check_vulnerability_scan': async (state) => {
                let vulns = [];
                if (state.strategy.scan) {
                    state.tokens.forEach(token => {
                        const findings = state.strategy.scan(token);
                        if (findings && findings.length > 0) vulns = vulns.concat(findings);
                    });
                }
                return { ...state, vulnerabilities: vulns };
            },

            'transform_mict_scaffold': async (state) => {
                // (Keeping your exact markdown generation logic here for brevity)
                let md = `## MICT FUNCTIONAL SPECIFICATION\n\n`;
                // ... (Logic omitted for space, keep your original string building logic) ...
                return { ...state, mictCode: md };
            },

            'transform_palm': async (state) => {
                return {
                    ...state,
                    finalOutput: {
                        summary: `Extracted ${Object.keys(state.variables).length} vars using Strategy: ${state.strategy.name}`,
                        data_dictionary: state.variables,
                        dependency_graph: state.dependencies,
                        business_logic: state.logicTree,
                        migration_issues: state.anomalies,
                        security_findings: state.vulnerabilities,
                        generated_code: state.mictCode
                    }
                };
            }
        }
    });

    return await cycle.run();
};