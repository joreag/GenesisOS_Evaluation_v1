
# **GenesisOS & HCTS Ecosystem - Deployment Guide v1.0**
**Prepared for:** Public Review
**Architecture:** MICT (Map, Iterate, Check, Transform) / OMZTA (Open MICT Zero Trust Architecture)

## **Executive Summary**
Welcome to GenesisOS. This package contains a working prototype of a mathematically secure, AI-native operating system kernel (`kMICT`), its multi-model AI backend ("The Hive"), and its edge-node interface ("Scout"). 

**Key Architectural Innovations for Evaluation:**
1.  **Logic Safety (GenLang):** The OS kernel does not use standard Linux syscalls for its core operations. It executes `.mdo` blueprints where hardware state mutations are blocked by absolute mathematical assertions (The `Check` gate) before execution.
2.  **MICT-Elastic Memory:** GenesisOS bypasses standard hash maps to use a custom, deterministic, O(K)-bounded allocator. It natively prevents clustering and garbage-collection stuttering, providing the zero-latency environment required for real-time AI and Quantum operations.
3.  **Pascal-Chimera Quantum Readiness:** The ecosystem is designed to route "Concept Vectors" (Base-60 dimensional embeddings) rather than raw text. This architecture enables the drop-in replacement of our classical "Twist Matrix" with a Qiskit Parameterized Quantum Circuit (PQC) to resolve polysemantic ambiguity.

---

## **Part 1: System Prerequisites**
This environment is optimized for Ubuntu/Linux. Ensure the host machine has the following installed:

*   **Node.js** (v18+ recommended) & **NPM**
*   **Rust & Cargo** (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
*   **Python 3.10+** (with `python3-venv`)
*   **Ubuntu Build Dependencies** (Required for Tauri WebKit rendering):
    ```bash
    sudo apt update
    sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
    ```

---

## **Part 2: "The Hive" (AI Backend Server)**
The Hive is the neural backend containing the Sentinel and Guardian models.

1.  **Extract the Hive directory** to your desired location (e.g., `~/the_hive`).
2.  **Initialize the Python Virtual Environment:**
    ```bash
    cd ~/the_hive
    python3 -m venv venv
    source venv/bin/activate
    pip install torch flask flask-cors transformers
    ```
3.  **Model Placement:** Ensure the provided `.pth` model weights are placed in `~/the_hive/models/` and their respective `.json` vocabularies are in `~/the_hive/data/`.
4.  **Boot the Server:**
    ```bash
    python3 sentinel_server_v2.py
    ```
    *Note: Verify the server outputs `[OK] Online.` for the loaded models and binds to `0.0.0.0:3000`.*

---

## **Part 3: The EasyBake Forge Environment**
`EasyBakeApp` is a native GenesisOS tool for orchestrating deep-learning training pipelines. It requires an isolated Python environment to run its sub-processes.

1.  **Create the Forge Directory:**
    ```bash
    mkdir -p ~/ulshe_ai_forge
    cd ~/ulshe_ai_forge
    ```
2.  **Initialize the Environment:**
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    pip install torch tqdm
    ```
3.  **Pipeline Placement:** Ensure the `pipelines/` folder (containing `trainer_hcts_v4.py` or `v5.py`) and the `curriculum/` folders are placed inside `~/ulshe_ai_forge/`.

---

## **Part 4: Booting GenesisOS**
This is the core operating system and graphical environment.

1.  **Navigate to the GenesisOS directory:**
    ```bash
    cd ~/genesis-os
    ```
2.  **Install Frontend Dependencies:**
    ```bash
    npm install
    ```
3.  **Compile and Boot the Kernel:**
    ```bash
    npm run tauri dev
    ```
    *(Note: The first boot will take a few minutes as Cargo compiles the Rust micro-kernel and SQLite database bindings).*

### **GenesisOS First-Boot Sequence**
Because GenesisOS uses persistent SQLite memory (`genesis.db`), it is highly recommended to wipe the state on a new machine before testing the AI modules.
1.  Open the **Kernel Monitor** app (microscope icon).
2.  Click **Wipe Memory**.
3.  Click **Boot System (Load MDOs)** to load the core physical laws of the OS into RAM.

---

## **Part 5: Testing the Ecosystem (The Tour)**

**1. The Dojo (AI Inference & OMZTA Routing)**
*   Open the Dojo app (karate uniform icon).
*   Type a prompt. The OS will securely intercept the prompt, wrap it in an MDO payload, apply Zero-Trust validations, and route the IPC message to the Python Hive server running in Part 2. The response will be natively rendered.

**2. CodeForge & The Logic Archaeologist**
*   Open CodeForge (notepad icon).
*   Paste C++ or GenLang code. Click **Analyze Logic**.
*   The system will extract the mathematical AST and compile a `MICT Pre-Graph` JSON payload.
*   Click **Commit to Brain**. The OS will invoke `File.mdo` to safely write this JSON directly to the `MICT-Elastic` database, ready for training ingestion.

**3. EasyBake AI (Sub-process Orchestration)**
*   Open EasyBake (brain icon).
*   Ensure the Forge Path matches the directory created in Part 3 (e.g., `/home/YOUR_USER/ulshe_ai_forge`).
*   Click **Forge AI**. GenesisOS will spawn an asynchronous, isolated Rust thread, execute the Python training script, and stream the `STDOUT` telemetry back to the React UI gauges in real-time.

---
**[END OF DOCUMENT]**

***

