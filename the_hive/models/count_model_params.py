import os
import torch

def measure_saved_model_parameters(model_filepath: str):
    """
    Directly loads a saved PyTorch model state_dict and counts the
    actual number of parameters stored in the file.

    Args:
        model_filepath (str): The path to the .pth model file.
    """
    print(f"--- Measuring Parameters in File: '{model_filepath}' ---")

    if not os.path.exists(model_filepath):
        print(f"FATAL ERROR: Model file not found at '{model_filepath}'")
        return

    try:
        # Load the state_dict from the file. This is just a dictionary.
        # We load it to the CPU to avoid needing a GPU for this simple check.
        state_dict = torch.load(model_filepath, map_location=torch.device('cpu'))

        # If the file is a checkpoint dictionary, get the model's state_dict
        if 'model_state_dict' in state_dict:
            state_dict = state_dict['model_state_dict']

        total_params = 0
        print("\nInspecting layers found in file:")
        print("-" * 40)

        # Iterate through the values (the tensors) in the state dictionary
        for param_tensor in state_dict.values():
            # .numel() returns the total number of elements in the tensor
            num_params_in_tensor = param_tensor.numel()
            total_params += num_params_in_tensor
            # Optional: Print details for each layer
            # print(f"  - Layer shape: {param_tensor.size()}, Parameters: {num_params_in_tensor:,}")

        print("-" * 40)
        print(f"\n--- Results ---")
        print(f"Total number of parameters measured in file: {total_params:,}")
        print("-" * 40)

    except Exception as e:
        print(f"An error occurred while reading the model file: {e}")


if __name__ == '__main__':
    # --- IMPORTANT ---
    # Change this variable to point to the model file you want to measure.
    MODEL_TO_MEASURE = 'guardian_prime_v6.pth' # The standard model
    # MODEL_TO_MEASURE = 'jarvits_qna_medium_ai_v1.0.pth' # The medium model

    measure_saved_model_parameters(MODEL_TO_MEASURE)
