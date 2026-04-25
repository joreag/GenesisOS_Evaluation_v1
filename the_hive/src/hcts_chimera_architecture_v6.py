import torch
import torch.nn as nn
import torch.nn.functional as F
import math
from typing import Tuple

# --- Foundational Components (Cognitive Modules) ---

class PositionalEncoding(nn.Module):
    # (Unchanged)
    def __init__(self, d_model: int, dropout: float = 0.1, max_len: int = 5000):
        super().__init__()
        self.dropout = nn.Dropout(p=dropout)
        position = torch.arange(max_len).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2) * (-math.log(10000.0) / d_model))
        pe = torch.zeros(max_len, d_model)
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        self.register_buffer('pe', pe.unsqueeze(0))
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.pe[:, :x.size(1), :].to(x.device)
        return self.dropout(x)

class TRM_Block(nn.Module):
    # (Unchanged - The Fast Parser)
    def __init__(self, d_model: int, expansion_factor: int = 4):
        super().__init__()
        self.channel_mlp = nn.Sequential(nn.LayerNorm(d_model), nn.Linear(d_model, d_model * expansion_factor), nn.GELU(), nn.Linear(d_model * expansion_factor, d_model))
        self.norm_seq = nn.LayerNorm(d_model)
        self.linear_seq1 = nn.Linear(1, expansion_factor)
        self.gelu = nn.GELU()
        self.linear_seq2 = nn.Linear(expansion_factor, 1)
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.channel_mlp(x)
        residual = x
        x = self.norm_seq(x).transpose(1, 2)
        x = self.linear_seq2(self.gelu(self.linear_seq1(x.unsqueeze(-1))))
        x = x.squeeze(-1).transpose(1, 2)
        return residual + x

class Hebbian_Block(nn.Module):
    # (Unchanged - The Adaptive Associator)
    def __init__(self, d_model: int, num_heads: int = 4):
        super().__init__()
        self.d_model, self.num_heads = d_model, num_heads
        self.head_dim = d_model // num_heads
        self.w_q, self.w_k, self.w_v = nn.Linear(d_model, d_model), nn.Linear(d_model, d_model), nn.Linear(d_model, d_model)
        self.w_out = nn.Linear(d_model, d_model)
        self.norm = nn.LayerNorm(d_model)
        self.beta = nn.Parameter(torch.tensor([0.1]))
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        batch_size, seq_len, _ = x.size()
        residual, x = x, self.norm(x)
        q, k, v = self.w_q(x).view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2), self.w_k(x).view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2), self.w_v(x).view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2)
        affinity = torch.matmul(q, k.transpose(-2, -1)) * self.beta
        mask = torch.triu(torch.ones(seq_len, seq_len, device=x.device) * float('-inf'), diagonal=1)
        affinity = F.relu(affinity + mask.unsqueeze(0).unsqueeze(0))
        out = torch.matmul(affinity, v).transpose(1, 2).contiguous().view(batch_size, seq_len, self.d_model)
        return residual + self.w_out(out)

class Curious_Hebbian_Block(nn.Module):
    # (Unchanged - The Self-Aware Reasoner)
    def __init__(self, d_model: int, num_heads: int = 4):
        super().__init__()
        self.reasoning_engine = Hebbian_Block(d_model, num_heads)
        self.anxiety_head = nn.Sequential(nn.Linear(d_model, d_model // 4), nn.GELU(), nn.Linear(d_model // 4, 1))
    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        z_pass1 = self.reasoning_engine(x)
        z_pass2 = self.reasoning_engine(z_pass1)
        raw_dissonance = torch.mean((z_pass2 - z_pass1).pow(2), dim=[1, 2])
        learned_dissonance = self.anxiety_head(z_pass2.mean(dim=1)).squeeze(-1)
        dissonance_score = raw_dissonance + torch.sigmoid(learned_dissonance)
        return z_pass2, dissonance_score

# <<< --- THE NEW UNIVERSAL COGNITIVE ENGINE --- >>>
class UnifiedEngineBlock(nn.Module):
    """
    The "Universal Instrument" of the v5 architecture. A tunable, hybrid
    block containing both a TRM and a Hebbian engine in parallel.
    """
    def __init__(self, d_model: int, initial_alpha: float = 0.5):
        super().__init__()
        self.trm_engine = TRM_Block(d_model)
        self.hebbian_engine = Hebbian_Block(d_model)
        
        # The "Cognitive Knob": a learnable parameter to balance the two engines.
        # We use sigmoid to keep the value between 0 and 1.
        self.alpha = nn.Parameter(torch.tensor(initial_alpha))
        
        self.norm = nn.LayerNorm(d_model)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Process the input through both engines in parallel
        trm_out = self.trm_engine(x)
        hebbian_out = self.hebbian_engine(x)
        
        # Get the current balance from the cognitive knob
        balance_weight = torch.sigmoid(self.alpha)
        
        # Combine the outputs using the learned balance
        # output = (balance_weight * trm_out) + ((1 - balance_weight) * hebbian_out)
        # A residual connection is crucial for stable training
        output = x + (balance_weight * trm_out) + ((1 - balance_weight) * hebbian_out)
        
        return self.norm(output)
# <<< --- END OF NEW ENGINE --- >>>

# <<< --- NEW: THE UNIFIED DECODER ENGINE --- >>>
class UnifiedDecoderBlock(nn.Module):
    """
    The "Universal Instrument" for the decoder side. A symmetric, tunable,
    hybrid block that learns its own cognitive strategy for generation.
    """
    def __init__(self, d_model: int, initial_alpha: float = 0.5):
        super().__init__()
        # Self-Processing Engines (processes the decoder's own input)
        self.self_trm_engine = TRM_Block(d_model)
        self.self_hebbian_engine = Hebbian_Block(d_model) # Hebbian for self-association/context

        # Cross-Processing Engines (attends to the encoder's memory)
        # We'll use a standard MHA here for the "TRM-like" part, as it's a proven solution.
        self.cross_attn_engine = nn.MultiheadAttention(d_model, num_heads=8, batch_first=True)
        # We can also add a "cross-Hebbian" in the future for more experimental designs.

        # The "Generative Knob": A learnable parameter to balance self-processing engines.
        self.alpha = nn.Parameter(torch.tensor(initial_alpha))
        
        # Standard FFN and normalization layers
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.norm3 = nn.LayerNorm(d_model)
        self.ffn = nn.Sequential(
            nn.Linear(d_model, d_model * 4),
            nn.GELU(),
            nn.Linear(d_model * 4, d_model)
        )
        self.dropout = nn.Dropout(0.1)

    def forward(self, tgt: torch.Tensor, memory: torch.Tensor, 
                tgt_mask: torch.Tensor, memory_key_padding_mask: torch.Tensor) -> torch.Tensor:
        
        # 1. Self-Processing: The decoder processes its own input so far.
        # This is where the model "thinks about what it has already said."
        trm_out = self.self_trm_engine(tgt)
        hebbian_out = self.self_hebbian_engine(tgt)
        balance_weight = torch.sigmoid(self.alpha)
        
        # Combine the self-processing outputs
        self_processed = (balance_weight * trm_out) + ((1 - balance_weight) * hebbian_out)
        tgt = self.norm1(tgt + self.dropout(self_processed))
        
        # 2. Cross-Attention: The decoder looks at the encoder's memory.
        # This is where the model "consults the original question."
        cross_out, _ = self.cross_attn_engine(query=tgt, key=memory, value=memory, 
                                              key_padding_mask=memory_key_padding_mask)
        tgt = self.norm2(tgt + self.dropout(cross_out))

        # 3. Feed-Forward Network
        ffn_out = self.ffn(tgt)
        tgt = self.norm3(tgt + self.dropout(ffn_out))
        
        return tgt


# --- THE SELF-AWARE GENERATIVE ARCHITECTURE: HCTS-CHIMERA V6 ---

class HCTS_Chimera_v6(nn.Module):
    """
    The "Self-Correcting Speaker" Architecture.
    Introduces a Curious_Hebbian_Block in the decoder for self-aware generation.
    """
    def __init__(self, vocab_size: int, d_model: int = 384, 
                 num_syntax_layers: int = 2, num_semantic_layers: int = 2,
                 num_reasoning_layers: int = 2, 
                 num_decoder_layers: int = 5, # The number of BASE decoder layers
                 dropout: float = 0.1, pad_idx: int = 0):
        super().__init__()
        self.d_model, self.pad_idx = d_model, pad_idx
        self.embedding = nn.Embedding(vocab_size, d_model, padding_idx=pad_idx)
        self.pos_encoder = PositionalEncoding(d_model, dropout)

        # --- Encoder (Unchanged from v4/v5) ---
        self.syntax_encoder = nn.Sequential(*[UnifiedEngineBlock(d_model, initial_alpha=0.9) for _ in range(num_syntax_layers)])
        self.semantic_encoder = nn.Sequential(*[UnifiedEngineBlock(d_model, initial_alpha=0.5) for _ in range(num_semantic_layers)])
        self.reasoning_layers = nn.ModuleList([Curious_Hebbian_Block(d_model) for _ in range(num_reasoning_layers)])

        # --- v6 Asymmetric Decoder ---
        self.decoder_base_layers = nn.ModuleList([UnifiedDecoderBlock(d_model, initial_alpha=0.5) for _ in range(num_decoder_layers)])
        self.decoder_reasoning_layer = Curious_Hebbian_Block(d_model)
        
        self.fc_out = nn.Linear(d_model, vocab_size)

    # <<< --- THE FIX: The complete and correct encode method --- >>>
    def encode(self, src: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        x = self.pos_encoder(self.embedding(src) * math.sqrt(self.d_model))
        
        x = self.syntax_encoder(x)
        x = self.semantic_encoder(x)
            
        total_dissonance = 0
        for layer in self.reasoning_layers:
            x, score = layer(x)
            total_dissonance += score
        
        final_memory = x
        # Handle cases where reasoning_layers might be empty
        avg_dissonance = (total_dissonance / len(self.reasoning_layers)) if self.reasoning_layers else torch.tensor(0.0, device=x.device)
        
        return final_memory, avg_dissonance

    # <<< --- THE FIX: The single, correct decode method --- >>>
    def decode(self, tgt: torch.Tensor, memory: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        # This assumes memory_key_padding_mask is handled by the caller or is None
        tgt_mask = nn.Transformer.generate_square_subsequent_mask(sz=tgt.size(1)).to(tgt.device)
        
        x = self.pos_encoder(self.embedding(tgt) * math.sqrt(self.d_model))
        
        for layer in self.decoder_base_layers:
            # Note: The UnifiedDecoderBlock expects a memory_key_padding_mask argument.
            # We will pass None for now. This might need refinement if you use padding.
            x = layer(x, memory, tgt_mask=tgt_mask, memory_key_padding_mask=None)
            
        x, generative_dissonance = self.decoder_reasoning_layer(x)
            
        return self.fc_out(x), generative_dissonance

    # <<< --- THE FIX: The single, correct forward method --- >>>
    def forward(self, src: torch.Tensor, tgt: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        memory, encoder_dissonance = self.encode(src)
        output_logits, generative_dissonance = self.decode(tgt, memory)
        return output_logits, encoder_dissonance, generative_dissonance

if __name__ == '__main__':
    print("--- Defining HCTS-Chimera v5 'Universal Instrument' Architecture ---")
    VOCAB_SIZE = 150
    D_MODEL = 384
    model = HCTS_Chimera_v6(vocab_size=VOCAB_SIZE, d_model=D_MODEL)
    print(model)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"\nTotal Trainable Parameters (HCTS-Chimera v5): {total_params:,}")