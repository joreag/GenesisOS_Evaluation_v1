import torch
import torch.nn as nn
import numpy as np
import matplotlib.pyplot as plt
import time
import os

from qiskit import QuantumCircuit
from qiskit.circuit.library import zz_feature_map, real_amplitudes
from qiskit.quantum_info import SparsePauliOp # <-- NEW IMPORT
from qiskit_machine_learning.neural_networks import EstimatorQNN
from qiskit_machine_learning.connectors import TorchConnector

# --- CONFIGURATION ---
USE_HARDWARE = False 
IBM_TOKEN = os.getenv("IBM_QUANTUM_TOKEN", "YOUR_API_TOKEN_HERE")
BACKEND_NAME = "ibm_brisbane"

QUANTUM_DIM = 4 
D_MODEL = 64

# =====================================================================
# 1. THE ARCHITECTURAL COMPONENTS
# =====================================================================

class ClassicalTwistMatrix(nn.Module):
    def __init__(self, d_model):
        super().__init__()
        self.transform = nn.Linear(d_model, d_model)
        self.norm = nn.LayerNorm(d_model)
    def forward(self, x):
        return self.norm(self.transform(x))

class QuantumTwistMatrix(nn.Module):
    def __init__(self, d_model, q_dim):
        super().__init__()
        self.d_model = d_model
        self.q_dim = q_dim
        
        # 1. PQC Setup
        fmap_circ = zz_feature_map(feature_dimension=q_dim, reps=1, entanglement='linear')
        ansatz_circ = real_amplitudes(num_qubits=q_dim, reps=1, entanglement='linear')
        
        self.qc = QuantumCircuit(q_dim)
        self.qc.compose(fmap_circ, inplace=True)
        self.qc.compose(ansatz_circ, inplace=True)
        
        # 2. Estimator Setup
        if USE_HARDWARE:
            from qiskit_ibm_runtime import QiskitRuntimeService, EstimatorV2
            print(f"[IBM] Connecting to Quantum Hardware: {BACKEND_NAME}...")
            service = QiskitRuntimeService(channel="ibm_quantum", token=IBM_TOKEN)
            backend = service.backend(BACKEND_NAME)
            estimator = EstimatorV2(backend=backend)
        else:
            from qiskit.primitives import StatevectorEstimator
            from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
            print("[IBM] Using Local StatevectorEstimator...")
            pm = generate_preset_pass_manager(optimization_level=1)
            self.qc = pm.run(self.qc)
            estimator = StatevectorEstimator()

        input_params = self.qc.parameters[:fmap_circ.num_parameters]
        weight_params = self.qc.parameters[fmap_circ.num_parameters:]

        # --- THE FIX: MULTI-DIMENSIONAL OBSERVABLES ---
        # We want to measure the Z operator on each qubit independently.
        # This gives us an output vector of size [q_dim] instead of [1].
        observables = []
        for i in range(q_dim):
            pauli_string = ['I'] * q_dim
            pauli_string[i] = 'Z'
            pauli_string = "".join(pauli_string)[::-1] # Qiskit endianness
            observables.append(SparsePauliOp(pauli_string))

        self.qnn = EstimatorQNN(
            circuit=self.qc,
            estimator=estimator,
            observables=observables, # Pass the list of observables
            input_params=input_params,
            weight_params=weight_params
        )
        self.qml_layer = TorchConnector(self.qnn)
        
        self.compress = nn.Linear(d_model, q_dim)
        self.expand = nn.Linear(q_dim, d_model)

    def forward(self, x):
        batch_size, seq_len, _ = x.shape
        x_flat = x.view(-1, self.d_model) 
        x_comp = torch.tanh(self.compress(x_flat)) 
        
        # The QNN now returns shape (batch*seq, q_dim)
        x_qml = self.qml_layer(x_comp) 
        
        x_exp = self.expand(x_qml)
        return x_exp.view(batch_size, seq_len, self.d_model)

class DiagnosticSentinel(nn.Module):
    def __init__(self, d_model, use_quantum=False):
        super().__init__()
        self.d_model = d_model
        self.embed = nn.Embedding(100, d_model) 
        
        if use_quantum:
            self.twist = QuantumTwistMatrix(d_model, QUANTUM_DIM)
        else:
            self.twist = ClassicalTwistMatrix(d_model)
            
        self.reasoning = nn.Linear(d_model, d_model)
        self.anxiety_head = nn.Sequential(nn.Linear(d_model, 32), nn.GELU(), nn.Linear(32, 1))

    def forward(self, tokens):
        x = self.embed(tokens) * torch.sqrt(torch.tensor(self.d_model, dtype=torch.float32))
        x_twisted = self.twist(x)
        
        z1 = self.reasoning(x_twisted)
        z2 = self.reasoning(z1)
        
        raw_diss = torch.mean((z2 - z1).pow(2), dim=[1, 2])
        learned_diss = self.anxiety_head(z2.mean(dim=1)).squeeze(-1)
        total_anxiety = raw_diss + torch.sigmoid(learned_diss)
        
        return total_anxiety

def run_polysemantic_stress_test():
    print("\n" + "="*60)
    print("   HCTS-CHIMERA QML DISSONANCE EVALUATOR (Qiskit 2.1+)")
    print(f"   Target: {'IBM QPU' if USE_HARDWARE else 'Local Simulator'} | Qubits: {QUANTUM_DIM}")
    print("="*60 + "\n")

    print("[SETUP] Initializing Classical Baseline...")
    model_classical = DiagnosticSentinel(D_MODEL, use_quantum=False)
    opt_c = torch.optim.Adam(model_classical.parameters(), lr=0.01)
    
    print("[SETUP] Initializing Quantum Competitor...")
    model_quantum = DiagnosticSentinel(D_MODEL, use_quantum=True)
    opt_q = torch.optim.Adam(model_quantum.parameters(), lr=0.01)

    seq_len = 4
    torch.manual_seed(42)
    ambiguous_tokens = torch.randint(0, 100, (1, seq_len))
    
    epochs = 15
    history_c = []
    history_q = []

    print("\n[TEST] Commencing Stress Test (Minimizing Cognitive Dissonance)...")
    start_time = time.time()

    for epoch in range(epochs):
        # Classical Pass
        opt_c.zero_grad()
        anxiety_c = model_classical(ambiguous_tokens)
        loss_c = anxiety_c.mean()
        loss_c.backward()
        opt_c.step()
        history_c.append(loss_c.item())

        # Quantum Pass
        opt_q.zero_grad()
        anxiety_q = model_quantum(ambiguous_tokens)
        loss_q = anxiety_q.mean()
        loss_q.backward()
        opt_q.step()
        history_q.append(loss_q.item())

        print(f"   Epoch {epoch+1:02d} | Classical Anxiety: {loss_c.item():.4f} | Quantum Anxiety: {loss_q.item():.4f}")

    print(f"\n[COMPLETE] Test finished in {time.time() - start_time:.2f} seconds.")

    plt.figure(figsize=(10, 6))
    plt.plot(history_c, label='Classical Twist Matrix', color='red', linestyle='--')
    plt.plot(history_q, label='Quantum Twist Matrix', color='blue', linewidth=2)
    plt.title('Cognitive Dissonance Resolution: Classical vs Quantum')
    plt.xlabel('Optimization Epochs')
    plt.ylabel('Anxiety Score (Lower is better)')
    plt.legend()
    plt.grid(True, alpha=0.3)
    
    output_file = "qml_dissonance_report.png"
    plt.savefig(output_file)
    print(f"[REPORT] Graph saved to {output_file}")

if __name__ == "__main__":
    run_polysemantic_stress_test()