// src-tauri/src/crypto.rs

use ed25519_dalek::{Signer, Verifier, SigningKey, VerifyingKey, Signature};
use rand::rngs::OsRng;
use base64::{Engine as _, engine::general_purpose};

// A struct to hold a keypair, with keys stored as URL-safe base64 strings
#[derive(Debug, Clone)]
pub struct Keypair {
    pub public_key: String,
    pub private_key: String,
}

/// Generates a new Ed25519 keypair.
pub fn generate_keypair() -> Keypair {
    let mut csprng = OsRng;
    let signing_key: SigningKey = SigningKey::generate(&mut csprng);
    
    // We store and transmit keys as base64 strings for convenience
    Keypair {
        public_key: general_purpose::URL_SAFE_NO_PAD.encode(signing_key.verifying_key().as_bytes()),
        private_key: general_purpose::URL_SAFE_NO_PAD.encode(signing_key.to_bytes()),
    }
}

/// Signs a message (challenge) with a private key.
pub fn sign_message(private_key_b64: &str, message: &str) -> Result<String, String> {
    let pkey_bytes = general_purpose::URL_SAFE_NO_PAD.decode(private_key_b64)
        .map_err(|e| format!("Invalid private key format: {}", e))?;
    
    let signing_key = SigningKey::from_bytes(&pkey_bytes.try_into()
        .map_err(|_| "Private key has incorrect length".to_string())?);

    let signature = signing_key.sign(message.as_bytes());
    
    Ok(general_purpose::URL_SAFE_NO_PAD.encode(signature.to_bytes()))
}

/// Verifies a signature against a message and public key.
pub fn verify_signature(
    public_key_b64: &str, 
    message: &str, 
    signature_b64: &str
) -> bool {
    // 1. Decode base64 inputs. If they fail, the signature is invalid.
    let Ok(pub_key_bytes) = general_purpose::URL_SAFE_NO_PAD.decode(public_key_b64) else { return false };
    let Ok(signature_bytes) = general_purpose::URL_SAFE_NO_PAD.decode(signature_b64) else { return false };

    // 2. Try to convert the byte vectors into fixed-size arrays.
    //    This is the critical step that ensures correct length before calling the crypto library.
    let Ok(pub_key_array): Result<[u8; 32], _> = pub_key_bytes.try_into() else { return false };
    let Ok(signature_array): Result<[u8; 64], _> = signature_bytes.try_into() else { return false };

    // 3. Construct the cryptographic types. These calls will now succeed because the types are correct.
    let Ok(verifying_key) = VerifyingKey::from_bytes(&pub_key_array) else { return false };
    // This call now receives a `&[u8; 64]` as it expects, and returns a `Signature` directly.
    let signature = Signature::from_bytes(&signature_array);

    // 4. Perform the actual verification.
    verifying_key.verify(message.as_bytes(), &signature).is_ok()
}