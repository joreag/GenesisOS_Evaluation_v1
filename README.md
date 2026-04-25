# GenesisOS - The Sovereign Kernel
A mathematically secure, AI-native operating system built from first principles.

---

### The Philosophy: Logic Safety

Modern operating systems are built on a "Trust, then Verify" model. GenesisOS is built on a "Mathematically Prove, then Execute" architecture. It combines a custom language (`GenLang`), a native Rust micro-kernel (`kMICT`), and a Zero-Trust message bus to create an environment where entire classes of vulnerabilities like buffer overflows, race conditions, and unauthorized memory access are made impossible at the architectural level.

This repository contains the **Alpha v0.2 Evaluation Release** of the complete GenesisOS ecosystem.

### What's in this Repository?

The project is divided into three core tiers, all included here:

1.  **`genesis-os/`**: The OS itself. A Tauri/React application powered by the native Rust `kMICT` micro-kernel. This is the "Glass Box" that runs the secure environment.
2.  **`the_hive/`**: The AI backend server. A Python/Flask application that hosts the Sentinel and Guardian AI models. This acts as the "Surrogate Brain" for the OS's native AI agent, JARVITS.

    **Included AI Models (Alpha v0.1)**

    This evaluation package includes 5 pre-trained models for immediate testing within the GenesisOS Dojo environment, representing our multi-agent "Council" architecture:

    *   **Security Sentinels:** A council of four specialized `pico` models designed for adversarial debate and analysis.
        *   `guardian_blue`: The Architect/Logic model.
        *   `guardian_red`: The Critic/Adversary model.
        *   `sentinel_l2_medic`: The Health/Optimization model.
        *   `sentinel_l3_gatekeeper`: The Security Policy model.
    *   **HCTS Chimera v6 (Recovery Model):** The first public debut of our advanced, multi-layered cognitive architecture.

    *Disclaimer: These models are provided for architectural demonstration and testing purposes. They are not fully trained or fine-tuned and are intended as a base for further training with the included `ulshe_ai_forge` pipeline.*
3.  **`ulshe_ai_forge/`**: The AI Training Pipeline. A suite of Python scripts (`build_engine.py`) that orchestrate the complete process of ingesting data, building knowledge graphs, and training new models for The Hive.

### Current Status: Alpha v0.2 ("The Glass Box") - HONESTY FIRST

This is a developer-focused, architectural prototype. It is **not** a production-ready daily driver... yet.

**✅ What Works (Battle-Tested & Stable):**

*   **The `kMICT` Engine:** The Rust kernel successfully boots, loads MDOs, and processes IPC messages.
*   **MDO Execution:** All 7 Primordial MDOs (`File`, `Identity`, `Ledger`, etc.) compile and execute their `Check` block logic perfectly.
*   **Zero-Trust Gates:** The OS will mathematically reject file writes without a valid token (`File.mdo`) and terminal commands that violate policy (`Terminal.mdo`).
*   **MICT-Elastic Memory & Persistence:** The custom memory allocator is functional, and the OS state correctly persists to SQLite and survives reboots.
*   **AI Agent IPC:** The `Jarvits.mdo` can be successfully triggered by the `Ledger.mdo` and can fire its own independent IPC messages.
*   **Hybrid AI Bridge:** The `think()` syscall successfully routes prompts from the Rust kernel to the external Python Hive server and gets a response.

**⚠️ What's a Prototype or Simulation:**

*   **The UI is a Diagnostic Tool:** The current UI is a "Glass Box" designed for developers to watch the kernel work. It is not the final `StandardDesktop.jsx`.
*   **The AI "Brain" is a Placeholder:** The `think()` and `thinkify()` syscalls are hardwired to specific Python models. The full `Pascal-Chimera v9` is not yet integrated.
*   **The Bare-Metal Kernel is Separate:** The work on the `genesis-core` bootable kernel is a separate, ongoing project and is not integrated into this Tauri build.
*   **The Logic Archaeologist is JS-based:** The crucial code-to-MICT translation engine runs in the React frontend. A long-term goal is to port this to a native Rust MDO.

**🚀 The Roadmap (What We're Building Next):**

1.  **The Brain:** Integrate the `knowledge_graph_builder.py` and `trainer_hcts_v5.py` to begin the formal, phased training of the `Pascal-Chimera v9` JARVITS model.
2.  **The Body:** Replace the "Glass Box" UI with the full, feature-rich `StandardDesktop.jsx` and wire its applications (`CodeForge`, `Dojo`) to the `kMICT` backend.
3.  **The Sovereignty:** Continue the Bare-Metal Descent by extracting hardware driver logic using the Archaeologist and building a fully independent `genesis-core` kernel.

### Getting Started

*(This section is taken directly from the `SetupINFO.md` we created for Steve).*

1.  **Install Prerequisites:** (Node.js, Rust, Python 3.10+, Ubuntu Build Dependencies).
2.  **Boot The Hive:** `cd the_hive`, create `venv`, `pip install`, and run `python3 sentinel_server_v2.py`.
3.  **Setup The Forge:** `cd ulshe_ai_forge`, create `venv`, `pip install`.
4.  **Boot GenesisOS:** `cd genesis-os`, run `npm install`, then run `npm run tauri dev`.

We believe the future of computing must be secure, transparent, and built to empower AI from the ground up. We invite you to join us.