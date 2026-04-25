import torch
import torch.nn as nn
import math
from typing import List, Dict

# We can re-use the same PositionalEncoding class from the v1 architecture.
class PositionalEncoding(nn.Module):
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

# --- The New Building Blocks ---

class TransformerStackBlock(nn.Module):
    """A single, self-contained block in our hierarchical stack.
    This is a 'headless' transformer, containing only the encoder/decoder layers.
    """
    def __init__(self, d_model: int, nhead: int, num_encoder_layers: int, num_decoder_layers: int, dim_feedforward: int, dropout: float):
        super().__init__()
        # This is the core engine of each block
        self.transformer = nn.Transformer(
            d_model=d_model, nhead=nhead,
            num_encoder_layers=num_encoder_layers, num_decoder_layers=num_decoder_layers,
            dim_feedforward=dim_feedforward, dropout=dropout, batch_first=True
        )
    
    def forward(self, src, tgt, src_mask, tgt_mask, src_key_padding_mask, tgt_key_padding_mask, memory_key_padding_mask):
        # This just passes data through the standard transformer logic
        return self.transformer(src, tgt, 
                                src_mask=src_mask, tgt_mask=tgt_mask, 
                                src_key_padding_mask=src_key_padding_mask,
                                tgt_key_padding_mask=tgt_key_padding_mask,
                                memory_key_padding_mask=memory_key_padding_mask)

class TwistMatrix(nn.Module):
    """The learnable, dynamic 'joint' between our TransformerStackBlocks.
    It performs a linear transformation on the representation space.
    """
    def __init__(self, d_model: int):
        super().__init__()
        self.transform = nn.Linear(d_model, d_model)
        # Optional: Add layer normalization for stability
        self.norm = nn.LayerNorm(d_model)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.norm(self.transform(x))

# --- The New Top-Level Architecture ---

class PascalGuidedTransformer(nn.Module):
    """
    The "Model Z": A hierarchical stack of Transformer blocks connected
    by learnable "Twist" matrices, implementing our Pascal Triangle concept.
    """
    def __init__(self, vocab_size: int, d_model: int, stack_config: List[Dict], nhead: int, dim_feedforward: int, dropout: float, pad_idx: int):
        super().__init__()
        self.d_model = d_model
        self.pad_idx = pad_idx

        # --- Shared Components (Input and Output) ---
        self.embedding = nn.Embedding(vocab_size, d_model, padding_idx=pad_idx)
        self.pos_encoder = PositionalEncoding(d_model, dropout)
        
        # --- Build the Hierarchical Stack ---
        self.transformer_blocks = nn.ModuleList()
        for config in stack_config:
            self.transformer_blocks.append(
                TransformerStackBlock(
                    d_model=d_model, nhead=nhead,
                    num_encoder_layers=config['encoder_layers'],
                    num_decoder_layers=config['decoder_layers'],
                    dim_feedforward=dim_feedforward, dropout=dropout
                )
            )
        
        # --- Build the Twist Matrices between blocks ---
        # There will be one less twist than there are blocks
        self.twist_matrices = nn.ModuleList([TwistMatrix(d_model) for _ in range(len(self.transformer_blocks) - 1)])

        # --- Shared Final Output Layer ---
        self.fc_out = nn.Linear(d_model, vocab_size)

    def forward(self, src: torch.Tensor, tgt: torch.Tensor) -> torch.Tensor:
        # --- Standard Masking and Initial Embedding ---
        src_key_padding_mask = (src == self.pad_idx)
        tgt_key_padding_mask = (tgt == self.pad_idx)
        tgt_mask = nn.Transformer.generate_square_subsequent_mask(tgt.size(1)).to(src.device)
        
        src_emb = self.pos_encoder(self.embedding(src) * math.sqrt(self.d_model))
        tgt_emb = self.pos_encoder(self.embedding(tgt) * math.sqrt(self.d_model))

        # --- The Hierarchical Forward Pass ---
        current_src_representation = src_emb
        current_tgt_representation = tgt_emb
        
        for i, block in enumerate(self.transformer_blocks):
            # Process the current representations through the block
            # Note: A standard transformer's output is just the decoder output
            output = block(current_src_representation, current_tgt_representation,
                           src_mask=None, tgt_mask=tgt_mask,
                           src_key_padding_mask=src_key_padding_mask,
                           tgt_key_padding_mask=tgt_key_padding_mask,
                           memory_key_padding_mask=src_key_padding_mask)
            
            # If this is not the last block, apply the "twist"
            if i < len(self.transformer_blocks) - 1:
                twist = self.twist_matrices[i]
                
                # The output becomes the input for the next target sequence
                current_tgt_representation = twist(output)
                
                # We also need to get the encoder's output and twist it for the next block's memory
                # We do this by running the encoder part of the block separately
                memory = block.transformer.encoder(current_src_representation, src_key_padding_mask=src_key_padding_mask)
                current_src_representation = twist(memory)
            else:
                # This is the final output from the last block
                final_output = output

        return self.fc_out(final_output)

if __name__ == '__main__':
    print("This module defines the Pascal-Guided Transformer ('Model Z').")
    
    # --- Example Instantiation (Your 30-10-10 idea as a smaller example) ---
    VOCAB_SIZE = 500
    D_MODEL = 512
    PAD_IDX = 0

    # Define the hierarchical structure: 3 Syntax, 2 Semantic, 2 Reasoning
    EXAMPLE_STACK_CONFIG = [
        {'name': 'SyntaxStack', 'encoder_layers': 3, 'decoder_layers': 3},
        {'name': 'SemanticStack', 'encoder_layers': 2, 'decoder_layers': 2},
        {'name': 'ReasoningStack', 'encoder_layers': 2, 'decoder_layers': 2},
    ]

    model = PascalGuidedTransformer(
        vocab_size=VOCAB_SIZE,
        d_model=D_MODEL,
        stack_config=EXAMPLE_STACK_CONFIG,
        nhead=8,
        dim_feedforward=2048,
        dropout=0.1,
        pad_idx=PAD_IDX
    )
    
    print("\n--- Model Architecture ---")
    print(model)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"\nTotal Trainable Parameters for this example config: {total_params:,}")