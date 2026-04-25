import os
import json
import pickle
import argparse
import sys
import glob

# Ensure the script can find the jarvits_modules package
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.append(SCRIPT_DIR)

# Assuming CognitiveNode is defined as discussed previously
from cognitive_node import CognitiveNode

class KnowledgeGraphBuilder:
    def __init__(self, input_dir: str):
        self.input_dir = input_dir
        self.raw_nodes_data = self._load_all_json_files()
        self.nodes = {}
        print(f"Knowledge Graph Builder initialized. Found {len(self.raw_nodes_data)} files.")

    def _load_all_json_files(self):
        """Loads all .json files from the specified directory."""
        data = {}
        search_pattern = os.path.join(self.input_dir, "*.json")
        for filepath in glob.glob(search_pattern):
            try:
                with open(filepath, 'r') as f:
                    file_data = json.load(f)
                    # Use the file_id from the JSON as the canonical key
                    if 'file_id' in file_data:
                        data[file_data['file_id']] = file_data
                    else:
                        print(f"  -> WARNING: Skipping '{filepath}' - Missing 'file_id'.")
            except Exception as e:
                print(f"FATAL ERROR: Could not load '{filepath}': {e}")
        return data

    def build_and_enrich_nodes(self):
        print("\n===== Building Cognitive Nodes from MICT Summaries =====")
        for file_id, data in self.raw_nodes_data.items():
            try:
                # Extract the core MICT structure
                mict_summary = data.get('mict_summary', {})
                strategy = data.get('strategy', 'unknown')

                # Build a rich semantic label from the MICT data
                label = f"[{strategy.upper()}] {file_id}"
                
                # Combine the MICT blocks into the node's properties for the AI to reason over
                properties = {
                    "strategy": strategy,
                    "map_context": mict_summary.get('MAP', {}),
                    "iterate_logic": mict_summary.get('ITERATE', {}),
                    "check_security": mict_summary.get('CHECK', {}),
                    "transform_mutations": mict_summary.get('TRANSFORM', {}),
                    "raw_content_b64": data.get('raw_content', "")
                }

                self.nodes[file_id] = CognitiveNode(
                    node_id=file_id,
                    label=label,
                    node_type="CODE_MODULE", # Differentiating from concept or rule nodes
                    properties=properties,
                    source_lessons=[data]
                )
                print(f"  -> Node created: {label}")
            except Exception as e:
                 print(f"  -> WARNING: Skipping '{file_id}' due to error during node creation: {e}")
        return self.nodes

    def weave_edges(self):
        """
        Reads the 'dependency_graph' from the MICT JSON and creates semantic edges.
        """
        print(f"\n===== Weaving Edges Between {len(self.nodes)} Nodes =====")
        edges_created = 0
        
        for source_id, source_node in self.nodes.items():
            source_data = source_node.source_lessons[0]
            dep_graph = source_data.get('dependency_graph', {})

            # 1. Weave External Dependencies (e.g., #include <iostream>)
            if 'EXTERNAL_MODULES' in dep_graph:
                for module_name in dep_graph['EXTERNAL_MODULES']:
                    # In a full system, we might have nodes for system libraries.
                    # For now, we create a "stub" node if it doesn't exist so the AI knows about it.
                    target_id = f"sys_lib_{module_name}"
                    if target_id not in self.nodes:
                        self.nodes[target_id] = CognitiveNode(
                            node_id=target_id, label=f"Library: {module_name}", node_type="SYSTEM_LIBRARY", properties={}, source_lessons=[]
                        )
                    
                    source_node.add_edge(self.nodes[target_id], 'IMPORTS')
                    edges_created += 1

            # 2. Weave Internal Data Dependencies (e.g., sum depends on num1)
            # This creates a micro-graph INSIDE the node's semantic representation,
            # which is incredibly powerful for the Pascal-Chimera reasoning layers.
            # (We store these as properties for the Autoencoder, rather than inter-file edges)
            internal_deps = {k: v for k, v in dep_graph.items() if k not in ['EXTERNAL_MODULES', 'ACTIVE_NAMESPACES']}
            if internal_deps:
                source_node.properties['internal_data_flow'] = internal_deps

        print(f"--- Edge weaving complete. {edges_created} external edges created. ---")

    def serialize_graph(self, output_path: str):
        print(f"\nSerializing Knowledge Graph to '{output_path}'...")
        try:
            output_dir = os.path.dirname(output_path)
            if output_dir and not os.path.exists(output_dir):
                os.makedirs(output_dir, exist_ok=True)
            with open(output_path, 'wb') as f:
                pickle.dump(self.nodes, f)
            print("Knowledge Graph build complete.")
            print("\n--- Build Summary ---")
            print(f"Total Cognitive Nodes Created: {len(self.nodes)}")
        except Exception as e:
            print(f"FATAL ERROR: Could not serialize graph to '{output_path}': {e}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Build a Knowledge Graph from a directory of MICT JSON files.")
    # Default to the output directory of our export script!
    parser.add_argument('--input_dir', default='knowledge_base_raw', help="Directory containing the raw kb_*.json files.")
    parser.add_argument('--output', default='knowledge_graph.pkl', help="Path for the output knowledge_graph.pkl file.")
    args = parser.parse_args()

    builder = KnowledgeGraphBuilder(input_dir=args.input_dir)
    if builder.raw_nodes_data:
        builder.build_and_enrich_nodes()
        builder.weave_edges()
        builder.serialize_graph(output_path=args.output)
    else:
         print("No JSON files found to process. Exiting.")
