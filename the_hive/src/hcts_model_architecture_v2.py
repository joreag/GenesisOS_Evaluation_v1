import torch
import torch.nn as nn
import math

class PositionalEncoding(nn.Module):
    """
    Standard Positional Encoding. Injects information about the relative
    or absolute position of the tokens in the sequence. This is a stable
    and required component.
    """
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
        """Applies positional encoding and moves it to the correct device."""
        x = x + self.pe[:, :x.size(1), :].to(x.device)
        return self.dropout(x)

class HCTS_Transformer(nn.Module):
    """
    The definitive HCTS-Transformer (v2). This architecture features a fully
    hierarchical encoder for comprehension (syntax -> semantic -> reasoning) and
    a mirrored hierarchical decoder for expression (reasoning -> semantic -> syntax),
    embodying the full HCTS philosophy.
    """
    def __init__(self, vocab_size: int, d_model: int = 384, nhead_syntax: int = 4,
                 nhead_semantic: int = 8, num_syntax_layers: int = 2,
                 num_semantic_layers: int = 2, num_reasoning_layers: int = 2,
                 dim_feedforward: int = 1024, dropout: float = 0.1, pad_idx: int = 0):
        super(HCTS_Transformer, self).__init__()

        self.d_model = d_model
        self.embedding = nn.Embedding(vocab_size, d_model, padding_idx=pad_idx)
        self.pos_encoder = PositionalEncoding(d_model, dropout)
        self.pad_idx = pad_idx

        # --- HCTS ENCODER STACK ---
        # Layer 1: Syntax (low-level patterns)
        syntax_encoder_layer = nn.TransformerEncoderLayer(d_model=d_model, nhead=nhead_syntax, dim_feedforward=dim_feedforward, dropout=dropout, activation='gelu', batch_first=True, norm_first=True)
        self.syntax_encoder = nn.TransformerEncoder(syntax_encoder_layer, num_layers=num_syntax_layers)

        # Layer 2: Semantics (meaning and context)
        semantic_encoder_layer = nn.TransformerEncoderLayer(d_model=d_model, nhead=nhead_semantic, dim_feedforward=dim_feedforward, dropout=dropout, activation='gelu', batch_first=True, norm_first=True)
        self.semantic_encoder = nn.TransformerEncoder(semantic_encoder_layer, num_layers=num_semantic_layers)

        # Layer 3: Reasoning (abstract connections)
        reasoning_encoder_layer = nn.TransformerEncoderLayer(d_model=d_model, nhead=nhead_semantic, dim_feedforward=dim_feedforward, dropout=dropout, activation='gelu', batch_first=True, norm_first=True)
        self.reasoning_encoder = nn.TransformerEncoder(reasoning_encoder_layer, num_layers=num_reasoning_layers)

        # --- HCTS DECODER STACK (Mirrored) ---
        # Layer 1: Reasoning (formulate abstract thought)
        reasoning_decoder_layer = nn.TransformerDecoderLayer(d_model=d_model, nhead=nhead_semantic, dim_feedforward=dim_feedforward, dropout=dropout, activation='gelu', batch_first=True, norm_first=True)
        self.reasoning_decoder = nn.TransformerDecoder(reasoning_decoder_layer, num_layers=num_reasoning_layers)

        # Layer 2: Semantics (refine into meaningful concepts)
        semantic_decoder_layer = nn.TransformerDecoderLayer(d_model=d_model, nhead=nhead_semantic, dim_feedforward=dim_feedforward, dropout=dropout, activation='gelu', batch_first=True, norm_first=True)
        self.semantic_decoder = nn.TransformerDecoder(semantic_decoder_layer, num_layers=num_semantic_layers)

        # Layer 3: Syntax (construct final grammatical sequence)
        syntax_decoder_layer = nn.TransformerDecoderLayer(d_model=d_model, nhead=nhead_syntax, dim_feedforward=dim_feedforward, dropout=dropout, activation='gelu', batch_first=True, norm_first=True)
        self.syntax_decoder = nn.TransformerDecoder(syntax_decoder_layer, num_layers=num_syntax_layers)

        self.fc_out = nn.Linear(d_model, vocab_size)

    def encode(self, src: torch.Tensor) -> torch.Tensor:
        """Runs the source sequence through the full HCTS encoder stack."""
        src_pad_mask = (src == self.pad_idx)
        src_emb = self.pos_encoder(self.embedding(src) * math.sqrt(self.d_model))

        syntax_memory = self.syntax_encoder(src_emb, src_key_padding_mask=src_pad_mask)
        semantic_memory = self.semantic_encoder(syntax_memory, src_key_padding_mask=src_pad_mask)
        final_memory = self.reasoning_encoder(semantic_memory, src_key_padding_mask=src_pad_mask)
        return final_memory

    def decode(self, tgt: torch.Tensor, memory: torch.Tensor, memory_key_padding_mask: torch.Tensor) -> torch.Tensor:
        """Runs the target sequence through the full HCTS decoder stack."""
        tgt_pad_mask = (tgt == self.pad_idx)
        tgt_mask = nn.Transformer.generate_square_subsequent_mask(sz=tgt.size(1)).to(tgt.device)
        tgt_emb = self.pos_encoder(self.embedding(tgt) * math.sqrt(self.d_model))

        # The "thought" flows backwards from abstract to concrete
        reasoning_out = self.reasoning_decoder(tgt_emb, memory, tgt_mask=tgt_mask, memory_key_padding_mask=memory_key_padding_mask)
        semantic_out = self.semantic_decoder(reasoning_out, memory, tgt_mask=tgt_mask, memory_key_padding_mask=memory_key_padding_mask)
        final_output = self.syntax_decoder(semantic_out, memory, tgt_mask=tgt_mask, memory_key_padding_mask=memory_key_padding_mask)

        return final_output

    def forward(self, src: torch.Tensor, tgt: torch.Tensor) -> torch.Tensor:
        """The unified forward pass for training."""
        memory = self.encode(src)
        output = self.decode(tgt, memory, (src == self.pad_idx))
        return self.fc_out(output)

    @torch.no_grad()
    def generate(self, src: torch.Tensor, sos_idx: int, eos_idx: int, max_len: int = 150) -> torch.Tensor:
        """Performs autoregressive generation using the full HCTS stack."""
        self.eval()
        device = src.device
        memory = self.encode(src)
        memory_key_padding_mask = (src == self.pad_idx)

        tgt = torch.tensor([[sos_idx]], dtype=torch.long, device=device)

        for _ in range(max_len - 1):
            output = self.decode(tgt, memory, memory_key_padding_mask)
            prob = self.fc_out(output[:, -1])
            _, next_word_idx = torch.max(prob, dim=1)

            tgt = torch.cat([tgt, next_word_idx.unsqueeze(0)], dim=1)

            if next_word_idx.item() == eos_idx:
                break

        self.train() # Set back to training mode for consistency
        return tgt

if __name__ == '__main__':
    print("This is a module defining the definitive HCTS-Transformer (v2) architecture.")
    # Example instantiation for verification
    VOCAB_SIZE = 150
    PAD_IDX = 0
    model = HCTS_Transformer(
        vocab_size=VOCAB_SIZE, d_model=384, nhead_syntax=4,
        nhead_semantic=8, num_syntax_layers=2,
        num_semantic_layers=2, num_reasoning_layers=2,
        dim_feedforward=1024, pad_idx=PAD_IDX
    )
    print("\n--- HCTS-Transformer v2 Architecture ---")
    print(model)

    total_params = sum(p.numel() for p in model.parameters())
    print(f"\nTotal Trainable Parameters: {total_params:,}")
