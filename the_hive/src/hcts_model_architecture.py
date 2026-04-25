import torch
import torch.nn as nn
import math

# We need a standalone, correct PositionalEncoding class.
# It should not be imported from the now-deprecated model_architecture.py
class PositionalEncoding(nn.Module):
    """
    Standard Positional Encoding. Injects information about the relative
    or absolute position of the tokens in the sequence.
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
        # This ensures the addition operation happens entirely on the GPU
        x = x + self.pe[:, :x.size(1), :].to(x.device)
        return self.dropout(x)

class HCTS_Transformer(nn.Module):
    """
    The definitive JARVITS AI model architecture (v4). This architecture uses
    PyTorch's standard, highly-optimized nn.Transformer module, ensuring
    stability and correctness. It separates the encode and decode steps
    for robust inference.
    """
    def __init__(self, vocab_size: int, d_model: int = 384, nhead: int = 8,
                 num_encoder_layers: int = 6, num_decoder_layers: int = 6,
                 dim_feedforward: int = 1024, dropout: float = 0.1, pad_idx: int = 0, **kwargs):
        super(HCTS_Transformer, self).__init__()

        self.d_model = d_model
        self.embedding = nn.Embedding(vocab_size, d_model, padding_idx=pad_idx)
        self.pos_encoder = PositionalEncoding(d_model, dropout)
        self.pad_idx = pad_idx

        # Using the standard, robust, built-in nn.Transformer module
        self.transformer = nn.Transformer(
            d_model=d_model,
            nhead=nhead,
            num_encoder_layers=num_encoder_layers,
            num_decoder_layers=num_decoder_layers,
            dim_feedforward=dim_feedforward,
            dropout=dropout,
            batch_first=True # This is crucial for our data shape
        )
        self.fc_out = nn.Linear(d_model, vocab_size)

    def encode(self, src: torch.Tensor) -> torch.Tensor:
        """Encodes the source sequence into a memory tensor."""
        src_key_padding_mask = (src == self.pad_idx)
        src_emb = self.pos_encoder(self.embedding(src) * math.sqrt(self.d_model))
        return self.transformer.encoder(src_emb, src_key_padding_mask=src_key_padding_mask)

    def decode(self, tgt: torch.Tensor, memory: torch.Tensor, memory_key_padding_mask: torch.Tensor) -> torch.Tensor:
        """Decodes the memory tensor to generate an output sequence."""
        tgt_key_padding_mask = (tgt == self.pad_idx)
        tgt_mask = nn.Transformer.generate_square_subsequent_mask(tgt.size(1)).to(tgt.device)
        tgt_emb = self.pos_encoder(self.embedding(tgt) * math.sqrt(self.d_model))

        return self.transformer.decoder(tgt_emb, memory, tgt_mask=tgt_mask,
                                       tgt_key_padding_mask=tgt_key_padding_mask,
                                       memory_key_padding_mask=memory_key_padding_mask)

    def forward(self, src: torch.Tensor, tgt: torch.Tensor) -> torch.Tensor:
        """The unified forward pass for training."""
        src_key_padding_mask = (src == self.pad_idx)
        memory = self.encode(src) # Uses the internal encode method
        output = self.decode(tgt, memory, src_key_padding_mask) # Uses the internal decode method
        return self.fc_out(output)

    # THIS IS THE NEW METHOD TO ADD
    @torch.no_grad() # Disable gradient calculation for inference
    def generate(self, src: torch.Tensor, sos_idx: int, eos_idx: int, max_len: int = 100) -> torch.Tensor:
        """
        Performs autoregressive generation of a sequence.
        This is the definitive inference loop.
        """
        self.eval() # Set the model to evaluation mode
        device = src.device

        # 1. Encode the source query once
        memory = self.encode(src)
        src_key_padding_mask = (src == self.pad_idx)

        # 2. Initialize the target sequence with the <SOS> token
        # Shape should be [batch_size, sequence_length], so [1, 1] for a single query
        tgt = torch.tensor([[sos_idx]], dtype=torch.long, device=device)

        # 3. The autoregressive loop
        for _ in range(max_len - 1):
            # Decode the memory and the current target sequence
            output = self.decode(tgt, memory, src_key_padding_mask)

            # Project to vocab size and get the last token's prediction
            prob = self.fc_out(output[:, -1])

            # Get the most likely next token (greedy decoding)
            _, next_word_idx = torch.max(prob, dim=1)
            next_word_idx = next_word_idx.item()

            # Append the predicted token to the target sequence
            tgt = torch.cat([tgt, torch.tensor([[next_word_idx]], device=device)], dim=1)

            # 5. If <EOS> is predicted, stop generating
            if next_word_idx == eos_idx:
                break

        self.train() # Set the model back to training mode
        return tgt

if __name__ == '__main__':
    print("This is a module defining the standard, robust Transformer architecture for JARVITS.")
    # Example instantiation for verification
    VOCAB_SIZE = 250
    PAD_IDX = 0
    model = HCTS_Transformer(
        vocab_size=VOCAB_SIZE, d_model=256, nhead=8,
        num_encoder_layers=6, num_decoder_layers=6, pad_idx=PAD_IDX
    )
    print("\n--- Model Architecture ---")
    print(model)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"\nTotal Trainable Parameters: {total_params:,}")
