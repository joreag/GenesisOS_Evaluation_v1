use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// --- 1. CORE MDO STRUCTURE ---
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MdoObject {
    pub id: String,
    pub meta: MdoMeta,
    #[serde(rename = "MAP")]
    pub map_block: MapBlock,
    #[serde(rename = "ITERATE")]
    pub iterate_block: Vec<AstNode>,
    #[serde(rename = "CHECK")]
    pub check_block: Vec<CheckStatement>, // UPGRADED to handle Ifs and Assertions
    #[serde(rename = "TRANSFORM")]
    pub transform_block: Vec<TransformStatement>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MdoMeta {
    pub language: String,
    pub version: String,
}

// --- 2. MAP BLOCK ---
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MapBlock {
    pub variables: HashMap<String, VariableDeclaration>,
    pub requires: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VariableDeclaration {
    pub name: String,
    pub kind: String, 
    #[serde(rename = "type")]
    pub data_type: String, 
    pub initial_value: Option<AstNode>, 
}

// --- 3. AST NODES (The Logic Engine) ---
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")] 
pub enum AstNode {
    Assignment {
        target: String,
        expression: Box<AstNode>,
    },
    LocalDeclaration {
        name: String,
        #[serde(rename = "dataType")]
        data_type: String,
        expression: Box<AstNode>,
    },
    BinaryOp {
        op: String,
        left: Box<AstNode>,
        right: Box<AstNode>,
    },
    FunctionCall {
        #[serde(rename = "function_name")]
        function_name: String,
        arguments: Vec<AstNode>,
    },
    ArrayAccess {
        array: String,
        index: Box<AstNode>,
    },
    PropertyAccess {
        object: String,
        property: String,
    },
    Variable {
        name: String,
    },
    Literal {
        value: serde_json::Value, 
        #[serde(rename = "dataType")]
        data_type: String,
    },
    If {
        condition: Box<AstNode>,
        body: Vec<AstNode>,
    },
    GroupedExpression { // RESTORED
        expr: Box<AstNode>,
    }
}

// --- 4. CHECK & TRANSFORM BLOCKS ---

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DissonanceAction {
    pub action: String, 
    pub message: AstNode, 
}

// NEW: Handles the polymorphism of Check blocks
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(untagged)] 
pub enum CheckStatement {
    Assertion {
        #[serde(rename = "type")]
        stmt_type: String, // "Assertion"
        condition: AstNode, 
        on_fail: DissonanceAction,
    },
    If {
        #[serde(rename = "type")]
        stmt_type: String, // "If"
        condition: AstNode,
        body: Vec<CheckStatement>, // Recursive body
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")] // Tells Serde to look at the "type" field in the JSON
pub enum TransformStatement {
    #[serde(rename = "Emit")] // Exact match for the python output
    Emit {
        payload: HashMap<String, AstNode>,
    },
    #[serde(rename = "EmitToRequestor")] // Exact match for the python output
    EmitToRequestor {
        payload: HashMap<String, AstNode>,
    },
    #[serde(rename = "If")] // Exact match for the python output
    If {
        condition: AstNode,
        body: Vec<TransformStatement>,
    }
}