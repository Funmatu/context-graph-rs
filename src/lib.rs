use std::collections::HashMap;
use wasm_bindgen::prelude::*;
use serde::Serialize;

// --- Graph Definitions (Static Configuration) ---

#[derive(Clone, Copy, PartialEq)]
enum NodeType {
    Sensor,
    Feature,
    State,
}

struct NodeDef {
    id: &'static str,
    #[allow(dead_code)]
    label: &'static str,
    node_type: NodeType,
}

struct EdgeDef {
    source: &'static str,
    target: &'static str,
    weight: f32,
}

const NODES: &[NodeDef] = &[
    // Sensors
    NodeDef { id: "IN_VEL", label: "Velocity", node_type: NodeType::Sensor },
    NodeDef { id: "IN_REL_MOV", label: "Rel. Motion", node_type: NodeType::Sensor },
    NodeDef { id: "IN_FIST", label: "Fist", node_type: NodeType::Sensor },
    NodeDef { id: "IN_PINCH", label: "Pinch", node_type: NodeType::Sensor },
    NodeDef { id: "IN_OPEN", label: "Open Hand", node_type: NodeType::Sensor },
    NodeDef { id: "IN_SCISSORS", label: "Scissors Pose", node_type: NodeType::Sensor },
    NodeDef { id: "IN_HANDS_PROX", label: "Hands Touch", node_type: NodeType::Sensor },
    NodeDef { id: "IN_OCCLUSION", label: "Face Lost+Prox", node_type: NodeType::Sensor },
    NodeDef { id: "IN_THUMB_UP", label: "Thumb UP", node_type: NodeType::Sensor },
    NodeDef { id: "IN_THUMB_DOWN", label: "Thumb DOWN", node_type: NodeType::Sensor },
    NodeDef { id: "IN_EYES_ACT", label: "Cover Eyes", node_type: NodeType::Sensor },
    NodeDef { id: "IN_EARS_ACT", label: "Cover Ears", node_type: NodeType::Sensor },
    NodeDef { id: "IN_MOUTH_GUARD", label: "Cover Mouth", node_type: NodeType::Sensor },
    NodeDef { id: "IN_SMILE", label: "Smile", node_type: NodeType::Sensor },
    NodeDef { id: "IN_MOUTH", label: "Mouth Open", node_type: NodeType::Sensor },
    NodeDef { id: "IN_FACE_PROX", label: "Hand-Face Prox", node_type: NodeType::Sensor },

    // Features
    NodeDef { id: "FT_ACTIVE", label: "High Kinetic", node_type: NodeType::Feature },
    NodeDef { id: "FT_HOLDING", label: "Holding", node_type: NodeType::Feature },
    NodeDef { id: "FT_FRICTION", label: "Friction", node_type: NodeType::Feature },
    NodeDef { id: "FT_HIDING", label: "Concealment", node_type: NodeType::Feature },
    NodeDef { id: "FT_RPS_ROCK", label: "Pose: ROCK", node_type: NodeType::Feature },
    NodeDef { id: "FT_RPS_SCI", label: "Pose: SCISSORS", node_type: NodeType::Feature },
    NodeDef { id: "FT_RPS_PAP", label: "Pose: PAPER", node_type: NodeType::Feature },
    NodeDef { id: "FT_APPROVAL", label: "Semantics: YES", node_type: NodeType::Feature },
    NodeDef { id: "FT_DISAPPROVAL", label: "Semantics: NO", node_type: NodeType::Feature },
    NodeDef { id: "FT_HIDDEN_SENSE", label: "Blocking Senses", node_type: NodeType::Feature },
    NodeDef { id: "FT_HAPPY", label: "Emo: Happy", node_type: NodeType::Feature },
    NodeDef { id: "FT_SHOCK", label: "Emo: Shock", node_type: NodeType::Feature },

    // States
    NodeDef { id: "ST_IDLE", label: "IDLE", node_type: NodeType::State },
    NodeDef { id: "ST_GRASP", label: "ACTION: GRASP", node_type: NodeType::State },
    NodeDef { id: "ST_DRAG", label: "ACTION: DRAG", node_type: NodeType::State },
    NodeDef { id: "ST_WASH", label: "ACTION: WASH", node_type: NodeType::State },
    NodeDef { id: "ST_PEEKABOO", label: "CTX: HIDDEN", node_type: NodeType::State },
    NodeDef { id: "ST_ROCK", label: "GAME: ROCK", node_type: NodeType::State },
    NodeDef { id: "ST_SCISSORS", label: "GAME: SCISSORS", node_type: NodeType::State },
    NodeDef { id: "ST_PAPER", label: "GAME: PAPER", node_type: NodeType::State },
    NodeDef { id: "ST_YES", label: "CTX: YES / OK", node_type: NodeType::State },
    NodeDef { id: "ST_NO", label: "CTX: NO / BAD", node_type: NodeType::State },
    NodeDef { id: "ST_MIZARU", label: "🙈 MIZARU", node_type: NodeType::State },
    NodeDef { id: "ST_KIKAZARU", label: "🙉 KIKAZARU", node_type: NodeType::State },
    NodeDef { id: "ST_IWAZARU", label: "🙊 IWAZARU", node_type: NodeType::State },
    NodeDef { id: "ST_SMILE", label: "FACE: SMILE", node_type: NodeType::State },
    NodeDef { id: "ST_SURPRISE", label: "FACE: SURPRISE", node_type: NodeType::State },
];

const EDGES: &[EdgeDef] = &[
    // V5 Physical
    EdgeDef { source: "IN_VEL", target: "FT_ACTIVE", weight: 0.9 },
    EdgeDef { source: "IN_FIST", target: "FT_HOLDING", weight: 0.9 },
    EdgeDef { source: "IN_PINCH", target: "FT_HOLDING", weight: 0.8 },
    EdgeDef { source: "IN_HANDS_PROX", target: "FT_FRICTION", weight: 0.7 },
    EdgeDef { source: "IN_REL_MOV", target: "FT_FRICTION", weight: 0.9 },
    EdgeDef { source: "IN_OCCLUSION", target: "FT_HIDING", weight: 1.0 },
    
    EdgeDef { source: "FT_HOLDING", target: "ST_GRASP", weight: 1.0 },
    EdgeDef { source: "FT_ACTIVE", target: "ST_GRASP", weight: -0.3 },
    EdgeDef { source: "FT_HOLDING", target: "ST_DRAG", weight: 0.8 },
    EdgeDef { source: "FT_ACTIVE", target: "ST_DRAG", weight: 0.9 },
    EdgeDef { source: "FT_FRICTION", target: "ST_WASH", weight: 1.2 },
    EdgeDef { source: "FT_HIDING", target: "ST_PEEKABOO", weight: 1.2 },

    // V4 Semantic
    EdgeDef { source: "IN_FIST", target: "FT_RPS_ROCK", weight: 0.8 },
    EdgeDef { source: "IN_SCISSORS", target: "FT_RPS_SCI", weight: 0.9 },
    EdgeDef { source: "IN_OPEN", target: "FT_RPS_PAP", weight: 0.9 },
    EdgeDef { source: "FT_RPS_ROCK", target: "ST_ROCK", weight: 0.9 },
    EdgeDef { source: "FT_RPS_SCI", target: "ST_SCISSORS", weight: 0.9 },
    EdgeDef { source: "FT_RPS_PAP", target: "ST_PAPER", weight: 0.9 },

    EdgeDef { source: "IN_THUMB_UP", target: "FT_APPROVAL", weight: 1.0 },
    EdgeDef { source: "IN_THUMB_DOWN", target: "FT_DISAPPROVAL", weight: 1.0 },
    EdgeDef { source: "IN_THUMB_UP", target: "FT_RPS_ROCK", weight: -0.5 },
    EdgeDef { source: "IN_THUMB_DOWN", target: "FT_RPS_ROCK", weight: -0.5 },
    EdgeDef { source: "FT_APPROVAL", target: "ST_YES", weight: 1.0 },
    EdgeDef { source: "FT_DISAPPROVAL", target: "ST_NO", weight: 1.0 },

    EdgeDef { source: "IN_EYES_ACT", target: "FT_HIDDEN_SENSE", weight: 0.8 },
    EdgeDef { source: "IN_EYES_ACT", target: "ST_MIZARU", weight: 1.0 },
    EdgeDef { source: "IN_HANDS_PROX", target: "ST_MIZARU", weight: 0.5 },
    EdgeDef { source: "IN_EARS_ACT", target: "FT_HIDDEN_SENSE", weight: 0.8 },
    EdgeDef { source: "IN_EARS_ACT", target: "ST_KIKAZARU", weight: 1.0 },
    EdgeDef { source: "IN_MOUTH_GUARD", target: "FT_HIDDEN_SENSE", weight: 0.8 },
    EdgeDef { source: "IN_MOUTH_GUARD", target: "ST_IWAZARU", weight: 1.0 },
    EdgeDef { source: "IN_HANDS_PROX", target: "ST_IWAZARU", weight: 0.8 },

    EdgeDef { source: "IN_SMILE", target: "FT_HAPPY", weight: 0.9 },
    EdgeDef { source: "IN_MOUTH", target: "FT_SHOCK", weight: 0.6 },
    EdgeDef { source: "IN_FACE_PROX", target: "FT_SHOCK", weight: 0.5 },
    EdgeDef { source: "FT_HAPPY", target: "ST_SMILE", weight: 0.9 },
    EdgeDef { source: "FT_SHOCK", target: "ST_SURPRISE", weight: 0.9 },

    // Inhibition
    EdgeDef { source: "FT_ACTIVE", target: "ST_IDLE", weight: -0.6 },
    EdgeDef { source: "ST_ROCK", target: "ST_SCISSORS", weight: -0.8 },
    EdgeDef { source: "ST_ROCK", target: "ST_PAPER", weight: -0.8 },
    EdgeDef { source: "ST_SCISSORS", target: "ST_PAPER", weight: -0.8 },
    EdgeDef { source: "ST_YES", target: "ST_NO", weight: -2.0 },
    EdgeDef { source: "ST_NO", target: "ST_YES", weight: -2.0 },
    EdgeDef { source: "ST_MIZARU", target: "ST_KIKAZARU", weight: -1.0 },
    EdgeDef { source: "ST_MIZARU", target: "ST_IWAZARU", weight: -1.0 },
    EdgeDef { source: "ST_KIKAZARU", target: "ST_IWAZARU", weight: -1.0 },
    EdgeDef { source: "ST_GRASP", target: "ST_WASH", weight: -0.8 },
    EdgeDef { source: "ST_WASH", target: "ST_GRASP", weight: -0.8 },
    EdgeDef { source: "ST_DRAG", target: "ST_WASH", weight: -0.8 },
];

// --- Engine ---

// Helper struct for sorting states (moved outside impl)
#[derive(Serialize)]
struct RankedState {
    id: String,
    label: String,
    value: f32,
}

#[wasm_bindgen]
pub struct ContextEngine {
    nodes: HashMap<String, f32>,
    node_types: HashMap<String, NodeType>,
    // エッジの検索を高速化するため、TargetをキーにしたMapを持つ
    edges_by_target: HashMap<String, Vec<(&'static str, f32)>>, 
    
    decay: f32,
    stiffness: f32,
}

#[wasm_bindgen]
impl ContextEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        #[cfg(feature = "console_error_panic_hook")]
        console_error_panic_hook::set_once();

        let mut nodes = HashMap::new();
        let mut node_types = HashMap::new();
        let mut edges_by_target: HashMap<String, Vec<(&str, f32)>> = HashMap::new();

        for n in NODES {
            nodes.insert(n.id.to_string(), 0.0);
            node_types.insert(n.id.to_string(), n.node_type);
        }

        for e in EDGES {
            edges_by_target
                .entry(e.target.to_string())
                .or_default()
                .push((e.source, e.weight));
        }

        Self {
            nodes,
            node_types,
            edges_by_target,
            decay: 0.25,
            stiffness: 0.6,
        }
    }

    fn sigmoid(&self, x: f32) -> f32 {
        1.0 / (1.0 + (-6.0 * (x - 0.5)).exp())
    }

    // JSオブジェクト { "IN_VEL": 0.5, ... } を受け取る
    pub fn inject(&mut self, inputs: JsValue) {
        let input_map: HashMap<String, f32> = serde_wasm_bindgen::from_value(inputs).unwrap_or_default();
        
        for (id, val) in input_map {
            if let Some(current) = self.nodes.get_mut(&id) {
                // V5 Logic: Slight blend
                *current = (*current * 0.3) + (val * 0.7);
            }
        }
    }

    pub fn step(&mut self) {
        let mut next_state = self.nodes.clone();

        for (node_id, current_val) in &self.nodes {
            let mut input_sum = 0.0;

            // Gather energy from incoming edges
            if let Some(incoming) = self.edges_by_target.get(node_id) {
                for (source_id, weight) in incoming {
                    if let Some(source_val) = self.nodes.get(*source_id) {
                        input_sum += source_val * weight;
                    }
                }
            }

            let energy = input_sum * self.stiffness;
            let retained = current_val * (1.0 - self.decay);
            let node_type = self.node_types.get(node_id).unwrap();

            match node_type {
                NodeType::Sensor => {
                    // Sensors just retain/decay (values are injected externally)
                    next_state.insert(node_id.clone(), (retained).max(0.0));
                },
                _ => {
                    let raw_activ = retained + energy;
                    let new_val = if raw_activ > 0.1 {
                        self.sigmoid(raw_activ)
                    } else {
                        raw_activ
                    };
                    // Clamp [0, 1]
                    next_state.insert(node_id.clone(), new_val.max(0.0).min(1.0));
                }
            }
        }

        self.nodes = next_state;
    }

    pub fn get_activations(&self) -> JsValue {
        serde_wasm_bindgen::to_value(&self.nodes).unwrap()
    }

    // Stateタイプのノードのみをソートして返す（上位のコンテキスト判定用）
    pub fn get_ranked_states(&self) -> JsValue {
        let mut states = Vec::new();
        for (id, val) in &self.nodes {
            if let Some(NodeType::State) = self.node_types.get(id) {
                // Label検索
                let label = NODES.iter().find(|n| n.id == id).map(|n| n.label).unwrap_or(id);
                
                states.push(RankedState {
                    id: id.clone(),
                    label: label.to_string(),
                    value: *val,
                });
            }
        }
        
        // Sort descending
        states.sort_by(|a, b| {
            b.value.partial_cmp(&a.value).unwrap()
        });

        serde_wasm_bindgen::to_value(&states).unwrap()
    }
}