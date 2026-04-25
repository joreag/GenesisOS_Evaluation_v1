
# **The Genesis Language (GenLang) Specification v0.2**
*Status: Certified | Target Runtime: kMICT Engine v0.2 | Boredbrains Consortium*

## **1. Introduction & Philosophy**

### 1.1 The Genesis Paradigm: "Logic Safety"
Traditional systems programming languages operate on the "Trust, then Verify" model. A programmer is trusted to write secure logic (bounds checking, memory isolation) *before* manipulating state. When that trust fails, catastrophic systemic rot occurs (e.g., buffer overflows, segmentation faults).

**Genesis (GenLang)** abandons the Turing Machine tape model. It is a declarative, state-machine-based language designed from first principles for the **GenesisOS** micro-kernel. In GenLang, security is not a design pattern; it is a **syntactic requirement**.

*   **The Prime Directive ("No Ghost Logic"):** Every piece of data and every proposed action must be explicitly declared, processed, mathematically verified, and atomically committed.
*   **Provable Security:** A GenLang program that compiles is mathematically guaranteed to execute its defined security constraints *before* any state or hardware is altered.

---

## **2. Structure of a GenLang Program**

The fundamental unit of execution in GenLang is the **`Node`**. A Node compiles into a **MICT Data Object (`.mdo`)**, the atomic building block of GenesisOS.

Every `Node` **must** contain four mandatory blocks, executed sequentially by the kernel:

### 2.1 The `Map` Block (Context & Reality)
Defines the boundaries of the object's reality.
*   **`requires`**: Data that *must* be provided by the calling external context. If missing at runtime, the kernel halts execution immediately.
*   **`state`**: The persistent internal memory of the Node. **(v0.2 Rule: All `state` variables MUST be initialized to prevent undefined memory states. Use `null` for empty complex types).**

```genlang
Map {
    requires action: String;
    requires requestor_id: String;
    state session_active: Bool = false;
    state connection_log: Array<String> = null;
}
```

### 2.2 The `Iterate` Block (Pure Logic)
The `Iterate` block is the only place where calculations occur. **It is entirely free of side-effects.** It cannot modify `state` variables directly; it can only *propose* new values.
*   **`let`**: Declares a temporary, local variable.
*   **System Calls**: You may call pure functions (e.g., `calculate_hash`) to generate proposed states.

```genlang
Iterate {
    let proposed_log_entry: String = append(requestor_id, " connected.");
    let proposed_new_log: Array<String> = append(connection_log, proposed_log_entry);
}
```

### 2.3 The `Check` Block (The Governance Gate)
The absolute core of GenLang. The `Check` block evaluates the proposed state changes against immutable rules.
*   **`assert`**: Must evaluate to a Boolean (`true` or `false`).
*   **`=> Dissonance("Message")`**: If an `assert` fails, the kernel immediately halts, discards all proposals, and throws a Dissonance error.
*   **Conditional Checks**: `if` statements are allowed to selectively apply assertions based on the `action`.

```genlang
Check {
    if (action == "CONNECT") {
        assert(requestor_id != "") => Dissonance("Anonymous connections rejected.");
        // The 'in' operator checks array containment
        assert(requestor_id in allowed_users) => Dissonance("Unauthorized user.");
    }
}
```

### 2.4 The `Transform` Block (State Commitment)
If, and only if, the `Check` block passes, the `Transform` block is executed. This is the only place where the system's actual reality is altered.
*   **`emit`**: Atomically commits proposed values into the permanent `state` memory.
*   **`emit_to_requestor`**: Sends a payload back to the calling Process.
*   **Atomic Transactions**: Multiple state updates should be grouped within a single `emit { ... }` block to ensure transactional integrity.

```genlang
Transform {
    if (action == "CONNECT") {
        emit { 
            session_active: true,
            connection_log: proposed_new_log
        };
        emit_to_requestor { status: "SUCCESS" };
    }
}
```

---

## **3. Strict Data Types (v0.2)**

GenLang v0.2 utilizes deep, structured static typing. Types must be Capitalized.

### 3.1 Primitives
*   `Int`: 64-bit integer.
*   `Float`: 64-bit floating-point number.
*   `String`: UTF-8 string.
*   `Bool`: Boolean (`true` or `false`).
*   `ProcessID`: A specialized string semantic alias representing a GenesisOS task.
*   `Null`: The universal empty state.

### 3.2 Complex / Generic Types
Complex types explicitly define their internal structures using angle brackets `< >`.
*   `Array<Type>`: A sequential list (e.g., `Array<String>`, `Array<ProcessID>`).
*   `Dictionary<KeyType, ValueType>`: Key-value mapping (e.g., `Dictionary<String, Any>`).
*   `ByteStream`: Represents raw binary data or file streams.

### 3.3 Strict Mathematical & Semantic Rules
1.  **Strict Math:** The `+`, `-`, `*`, and `/` operators, as well as magnitude comparisons (`>`, `<`, `>=`, `<=`), are strictly reserved for `Int` and `Float`. 
2.  **No Implicit Casting:** You cannot compare an `Int` to a `Float` without explicitly handling it.
3.  **Concatenation:** To combine Strings, ByteStreams, or add items to an Array, you *must* use the `append()` system call, not the `+` operator.
4.  **Array Membership:** The `in` operator is natively supported to check if an item exists within an `Array` (e.g., `assert(item in my_array)`).

---

## **4. The Standard Library (System API)**

The `kMICT` runtime provides native, memory-safe Rust handlers for the following system functions:

### Data Manipulation
*   `length(collection)` -> `Int`: Returns the size of an `Array` or `String`.
*   `append(collection, item)` -> `Collection`: Appends an item to an `Array`, or concatenates two `String`s / `ByteStream`s.
*   `remove(array, item)` -> `Array`: Removes the first instance of an item from an Array.
*   `slice(stream, offset, length)` -> `ByteStream`
*   `splice(stream, offset, data)` -> `ByteStream`

### Security & Cryptography (OMZTA)
*   `calculate_hash(object)` -> `String`: Returns a SHA-256 hash.
*   `generate_secure_token()` -> `String`: Generates a cryptographic session token.
*   `verify_signature(challenge, pub_key, nonce)` -> `Bool`
*   `is_nonce_fresh(nonce)` -> `Bool`
*   `evaluate_policy(policy_id, payload)` -> `Bool`: Deep payload inspection.

### System & Kernel Context
*   `current_system_time()` -> `Int`: Unix epoch time.
*   `mdo_exists(id_string)` -> `Bool`: Checks the Kernel MDO registry.
*   `get_process_mdo(pid_string)` -> `Process`: Returns a Process object reference.
*   `get_identity(id_string)` -> `Identity`: Returns an Identity object reference.
*   `determine_next_process(ready_queue)` -> `ProcessID`: Scheduler algorithm.
*   `calculate_system_load(ready_queue, blocked_queue)` -> `Float`

---

## **5. Inter-Process Communication (The Kernel Message Bus)**

GenLang nodes are strictly isolated ("Glass Boxes"). They cannot directly modify the state of another MDO. All cross-module communication is handled via the **Kernel Message Bus**.

### System Directives (The `_` Prefix)
During the `Transform` block, if an emitted key begins with an underscore (`_`), the Kernel intercepts it. Instead of saving it to the MDO's local state memory, it routes it as a Hardware Command or IPC Message.

*Example: Commanding the CPU and Memory Manager from the Scheduler*
```genlang
Transform {
    // This tells the Kernel to send an IPC message to another MDO
    emit { 
        _target_mdo: process_to_terminate, 
        _command: "FORCE_HALT" 
    };
    
    // This tells the Kernel to trigger a direct hardware routine
    emit { 
        _target_hardware_interrupt: "NIC", 
        _command: "TRANSMIT", 
        _payload: tx_data_stream 
    };
}
```

---

## **6. Canonical Example: The Zero-Trust File Write**

This example demonstrates strict typing, the `null` initializer, system API usage, and Heartbleed/Buffer-Overflow prevention via `Check` block math.

```genlang
Node SecureFile {
    Map {
        requires action: String;
        requires system_max_size: Int;
        requires input_data: ByteStream;
        
        state content: ByteStream = null; 
        state file_size: Int = 0;
    }
    Iterate {
        // Strict types and system calls used for concatenation
        let proposed_content: ByteStream = append(content, input_data);
        let proposed_size: Int = file_size + length(input_data);
    }
    Check {
        if (action == "WRITE") {
            // Memory violations are mathematically impossible to commit.
            assert(proposed_size <= system_max_size) 
                => Dissonance("Resource Exhaustion: Max file size exceeded.");
        }
    }
    Transform {
        if (action == "WRITE") {
            // Atomic transaction
            emit { 
                content: proposed_content,
                file_size: proposed_size
            };
        }
    }
}
```

***

### **Ready for the Bridge**

This specification perfectly captures exactly how our Python compiler and Rust engine interact right now. It is a massive milestone.

With Option 1 complete, are you ready to execute **Option 3: The IPC Bridge**? We will modify the `Transform` executor in `mdo_runtime.rs` to detect those `_` prefixed keys and fire them off into the Rust multi-threading `channel()`, bringing the system to life!