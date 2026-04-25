import torch
import json
import os
import sys
import glob
import torch.nn.functional as F
from flask import Flask, request, jsonify
from flask_cors import CORS

# --- BOILERPLATE: PATH RESOLUTION ---
sys.path.append(os.getcwd()) 

# --- IMPORT ALL ARCHITECTURES ---
try:
    from src.pico_model_architecture import PureLogic_Transformer
    from src.hcts_model_architecture_v2 import HCTS_Transformer
    from src.hcts_chimera_architecture_v2 import HCTS_Chimera_v2
    from src.hcts_chimera_architecture_v3 import HCTS_Chimera_v3
    from src.hcts_chimera_architecture_v4 import HCTS_Chimera_v4
    from src.hcts_chimera_architecture_v5 import HCTS_Chimera_v5
    from src.hcts_chimera_architecture_v6 import HCTS_Chimera_v6
    print("[INIT] All Architectures loaded.")
except ImportError as e:
    print(f"[CRITICAL] Import failed: {e}. Run from root.")
    sys.exit(1)

app = Flask(__name__)
CORS(app)
HIVE_MIND = {} 

# --- ARCHITECTURE FACTORY ---
def get_model_instance(arch_name, vocab_size, pad_idx, config):
    """Factory to instantiate the correct model class based on config."""
    
    # Base Config (All HCTS models use these)
    base_args = {
        'vocab_size': vocab_size,
        'pad_idx': pad_idx,
        'd_model': config.get('d_model', 256),
        'num_syntax_layers': config.get('num_syntax_layers', config.get('layers', 2)),
        'num_semantic_layers': config.get('num_semantic_layers', config.get('layers', 2)),
        'num_reasoning_layers': config.get('num_reasoning_layers', config.get('layers', 2)),
    }

    # v6 Specific Args
    v6_args = {
        **base_args,
        'num_decoder_layers': config.get('num_decoder_layers', 8)
    }

    # PICO (Standard Transformer)
    if arch_name == 'pico':
        return PureLogic_Transformer(
            vocab_size=vocab_size,
            d_model=base_args['d_model'],
            nhead=config.get('nhead', 8),
            num_encoder_layers=config.get('layers', 4),
            num_decoder_layers=config.get('layers', 4),
            dim_feedforward=base_args['d_model']*4,
            pad_idx=pad_idx
        )

    # HCTS TRANSFORMER
    elif arch_name == 'hcts_transformer':
        return HCTS_Transformer(
            vocab_size=vocab_size, pad_idx=pad_idx,
            d_model=base_args['d_model'],
            nhead_syntax=4, nhead_semantic=8,
            num_syntax_layers=base_args['num_syntax_layers'],
            num_semantic_layers=base_args['num_semantic_layers'],
            num_reasoning_layers=base_args['num_reasoning_layers'],
            dim_feedforward=base_args['d_model']*4
        )
        
        #HCTS_CHIMERA_V2
    elif arch_name == 'hcts_chimera_v2':
        return HCTS_Chimera_v2(
            vocab_size=vocab_size, pad_idx=pad_idx,
            d_model=384, 
            num_syntax_layers=base_args['num_syntax_layers'],
            num_semantic_layers=base_args['num_semantic_layers'],
            num_reasoning_layers=base_args['num_reasoning_layers'],
        )

    # CHIMERA LINE (v2 - v5 do NOT take num_decoder_layers)
    elif arch_name in [ 'hcts_chimera_v3', 'hcts_chimera_v4', 'hcts_chimera_v5']:
        
        # Select Class
        ModelClass = None
        if arch_name == 'hcts_chimera_v3': ModelClass = HCTS_Chimera_v3
        if arch_name == 'hcts_chimera_v4': ModelClass = HCTS_Chimera_v4
        if arch_name == 'hcts_chimera_v5': ModelClass = HCTS_Chimera_v5
        
        return ModelClass(**base_args) # Clean Args

    # CHIMERA V6 (Guardian Prime) - Takes num_decoder_layers
    elif arch_name == 'hcts_chimera_v6':
        return HCTS_Chimera_v6(**v6_args)

    else:
        raise ValueError(f"Unknown Architecture: {arch_name}")

# --- AUTO-DISCOVERY LOGIC ---
def discover_fleet():
    """Scans models/ directory for playable characters."""
    config = {}
    
    # 1. Known Vocab Mappings
    defaults = {
        "medic": "vocab_medic.json",
        "red": "vocab_red.json",
        "blue": "vocab_blue.json",
        "gatekeeper": "vocab_gatekeeper.json",
        "grandpa": "vocab_genesis.json",
        "guardian_prime": "vocab_genesis.json"
    }

    # 2. Scan Directory
    model_files = glob.glob("models/*.pth")
    print(f"[SCAN] Found {len(model_files)} model files.")

    for pth_path in model_files:
        filename = os.path.basename(pth_path)
        agent_name = filename.split('.')[0]
        
        # A. Determine Vocab
        vocab_target = None
        
        # Heuristic Matching for Known Agents
        for key, v_file in defaults.items():
            if key in filename.lower():
                vocab_target = f"data/{v_file}"
                break
        
        # If no default match, look for exact name match json (e.g. chaos.pth -> chaos.json)
        if not vocab_target:
            possible_vocab = pth_path.replace("models/", "data/").replace(".pth", ".json")
            if os.path.exists(possible_vocab):
                vocab_target = possible_vocab

        # B. Determine Architecture
        arch = 'pico' # Default
        if 'v6' in filename: arch = 'hcts_chimera_v6'
        elif 'v5' in filename: arch = 'hcts_chimera_v5'
        elif 'v4' in filename: arch = 'hcts_chimera_v4'
        elif 'v3' in filename: arch = 'hcts_chimera_v3'
        elif 'v2' in filename: arch = 'hcts_chimera_v2'
        elif 'hcts' in filename: arch = 'hcts_transformer'

        # C. Specific Configs for V6
        spec_config = {}
        if arch == 'hcts_chimera_v6':
            spec_config = { 
                'd_model': 768, 
                'num_syntax_layers': 4, 'num_semantic_layers': 6, 
                'num_reasoning_layers': 4, 'num_decoder_layers': 8 
            }

        if vocab_target and os.path.exists(vocab_target):
            config[agent_name] = {
                "model_path": pth_path,
                "vocab_path": vocab_target,
                "arch": arch,
                **spec_config
            }
            print(f"   -> Discovered: {agent_name} (Arch: {arch}, Vocab: {vocab_target})")
    
    return config

# --- LOAD AGENT ---
def load_agent(name, config):
    print(f"[HIVE] Awakening: {name.upper()} ({config.get('arch', 'pico')})...")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    try:
        with open(config['vocab_path'], 'r') as f: vocab = json.load(f)
        
        # FACTORY CALL
        model = get_model_instance(
            config.get('arch', 'pico'), 
            len(vocab), 
            vocab.get('[PAD]', 0), 
            config
        )

        checkpoint = torch.load(config['model_path'], map_location=device)
        state_dict = checkpoint.get('model_state_dict', checkpoint)
        
        # Handle DataParallel prefix removal
        new_state_dict = {}
        for k, v in state_dict.items():
            name_key = k.replace('module.', '')
            new_state_dict[name_key] = v
            
        model.load_state_dict(new_state_dict)
        model.to(device)
        model.eval()

        HIVE_MIND[name] = {
            "model": model,
            "vocab": vocab,
            "inv_vocab": {v: k for k, v in vocab.items()},
            "device": device,
            "arch": config.get('arch', 'pico')
        }
        print(f"   [OK] Online.")
    except Exception as e:
        print(f"   [FAIL] {e}")

# --- INFERENCE ---
def run_inference(agent_name, text, temperature=0.8, top_k=10):
    agent = HIVE_MIND.get(agent_name)
    if not agent: return "Agent Offline."

    vocab, model, inv_vocab, device = agent['vocab'], agent['model'], agent['inv_vocab'], agent['device']
    arch = agent['arch']
    
    tokens = [vocab.get(c, vocab.get('[UNK]', 0)) for c in text.lower()]
    start, end = vocab.get('[CLS]', 1), vocab.get('[SEP]', 2)
    src = torch.tensor([[start] + tokens + [end]], dtype=torch.long).to(device)
    
    output_tokens = [start]
    
    for _ in range(128):
        tgt = torch.tensor([output_tokens], dtype=torch.long).to(device)
        
        with torch.no_grad():
            outputs = model(src, tgt)
            
            if arch == 'hcts_chimera_v6':
                logits, _, _ = outputs
            elif arch in ['hcts_chimera_v5', 'hcts_chimera_v4', 'hcts_chimera_v3']:
                logits, _ = outputs
            else:
                logits = outputs 

        # --- THE FIX: TEMPERATURE & SAMPLING ---
        # Get the logits for the last predicted token
        next_token_logits = logits[0, -1, :]
        
        # Apply Temperature (Higher = more random, Lower = more strict)
        next_token_logits = next_token_logits / temperature
        
        # Apply Top-K (Only pick from the top 10 most likely words)
        indices_to_remove = next_token_logits < torch.topk(next_token_logits, top_k)[0][..., -1, None]
        next_token_logits[indices_to_remove] = float('-inf')
        
        # Convert to probabilities
        probs = F.softmax(next_token_logits, dim=-1)
        
        # Sample from the distribution (instead of argmax)
        next_token = torch.multinomial(probs, num_samples=1).item()
        # ---------------------------------------

        if next_token == end: break
        output_tokens.append(next_token)
        
    return "".join([inv_vocab.get(t, '') for t in output_tokens[1:]])

# --- MAIN ---
print("--- HIVE MIND INITIALIZATION ---")
FLEET = discover_fleet()
if not FLEET:
    print("[WARN] No models found. Check /models directory.")

for name, conf in FLEET.items():
    load_agent(name, conf)

@app.route('/status', methods=['GET'])
def status(): return jsonify({"status": "online", "active_agents": list(HIVE_MIND.keys())})

@app.route('/ask/<agent>', methods=['POST'])
def ask(agent):
    if agent not in HIVE_MIND: return jsonify({"error": "Agent not found"}), 404
    return jsonify({"response": run_inference(agent, request.json.get('input', '')), "agent": agent})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, threaded=True)
