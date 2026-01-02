import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { LineChart, Line, Tooltip, ResponsiveContainer, CartesianGrid, YAxis } from 'recharts';
import { Camera, Activity, Network, Brain, Zap, ScanFace, Hand, Ghost } from 'lucide-react';

// Import WASM (init function and ContextEngine class)
import init, { ContextEngine } from './pkg/context_graph_rs.js';

// --- Graph Definitions (Visualization Only) ---
// Note: Logic is in Rust, but coordinates/labels are needed for Cytoscape drawing.
const GRAPH_NODES = [
    { id: 'IN_VEL', label: 'Velocity', type: 'SENSOR', x: 0, y: 0 },
    { id: 'IN_REL_MOV', label: 'Rel. Motion', type: 'SENSOR', x: 0, y: 40 },
    { id: 'IN_FIST', label: 'Fist', type: 'SENSOR', x: 0, y: 80 },
    { id: 'IN_PINCH', label: 'Pinch', type: 'SENSOR', x: 0, y: 120 },
    { id: 'IN_OPEN', label: 'Open Hand', type: 'SENSOR', x: 0, y: 160 },
    { id: 'IN_SCISSORS', label: 'Scissors Pose', type: 'SENSOR', x: 0, y: 200 },
    { id: 'IN_HANDS_PROX', label: 'Hands Touch', type: 'SENSOR', x: 0, y: 240 },
    { id: 'IN_OCCLUSION', label: 'Face Lost+Prox', type: 'SENSOR', x: 0, y: 280 },
    { id: 'IN_THUMB_UP', label: 'Thumb UP', type: 'SENSOR', x: 0, y: 340 },
    { id: 'IN_THUMB_DOWN', label: 'Thumb DOWN', type: 'SENSOR', x: 0, y: 380 },
    { id: 'IN_EYES_ACT', label: 'Cover Eyes', type: 'SENSOR', x: 0, y: 440 },
    { id: 'IN_EARS_ACT', label: 'Cover Ears', type: 'SENSOR', x: 0, y: 480 },
    { id: 'IN_MOUTH_GUARD', label: 'Cover Mouth', type: 'SENSOR', x: 0, y: 520 },
    { id: 'IN_SMILE', label: 'Smile', type: 'SENSOR', x: 0, y: 580 },
    { id: 'IN_MOUTH', label: 'Mouth Open', type: 'SENSOR', x: 0, y: 620 },
    { id: 'IN_FACE_PROX', label: 'Hand-Face Prox', type: 'SENSOR', x: 0, y: 660 },

    { id: 'FT_ACTIVE', label: 'High Kinetic', type: 'FEATURE', x: 250, y: 20 },
    { id: 'FT_HOLDING', label: 'Holding', type: 'FEATURE', x: 250, y: 100 },
    { id: 'FT_FRICTION', label: 'Friction', type: 'FEATURE', x: 250, y: 240 },
    { id: 'FT_HIDING', label: 'Concealment', type: 'FEATURE', x: 250, y: 300 },
    { id: 'FT_RPS_ROCK', label: 'Pose: ROCK', type: 'FEATURE', x: 250, y: 160 },
    { id: 'FT_RPS_SCI', label: 'Pose: SCISSORS', type: 'FEATURE', x: 250, y: 200 },
    { id: 'FT_RPS_PAP', label: 'Pose: PAPER', type: 'FEATURE', x: 250, y: 280 },
    { id: 'FT_APPROVAL', label: 'Semantics: YES', type: 'FEATURE', x: 250, y: 340 },
    { id: 'FT_DISAPPROVAL', label: 'Semantics: NO', type: 'FEATURE', x: 250, y: 380 },
    { id: 'FT_HIDDEN_SENSE', label: 'Blocking Senses', type: 'FEATURE', x: 250, y: 480 },
    { id: 'FT_HAPPY', label: 'Emo: Happy', type: 'FEATURE', x: 250, y: 580 },
    { id: 'FT_SHOCK', label: 'Emo: Shock', type: 'FEATURE', x: 250, y: 620 },

    { id: 'ST_IDLE', label: 'IDLE', type: 'STATE', x: 600, y: 0 },
    { id: 'ST_GRASP', label: 'ACTION: GRASP', type: 'STATE', x: 600, y: 80 },
    { id: 'ST_DRAG', label: 'ACTION: DRAG', type: 'STATE', x: 600, y: 120 },
    { id: 'ST_WASH', label: 'ACTION: WASH', type: 'STATE', x: 600, y: 240 },
    { id: 'ST_PEEKABOO', label: 'CTX: HIDDEN', type: 'STATE', x: 600, y: 300 },
    { id: 'ST_ROCK', label: 'GAME: ROCK', type: 'STATE', x: 600, y: 160 },
    { id: 'ST_SCISSORS', label: 'GAME: SCISSORS', type: 'STATE', x: 600, y: 200 },
    { id: 'ST_PAPER', label: 'GAME: PAPER', type: 'STATE', x: 600, y: 280 },
    { id: 'ST_YES', label: 'CTX: YES / OK', type: 'STATE', x: 600, y: 340 },
    { id: 'ST_NO', label: 'CTX: NO / BAD', type: 'STATE', x: 600, y: 380 },
    { id: 'ST_MIZARU', label: '🙈 MIZARU', type: 'STATE', x: 600, y: 440 },
    { id: 'ST_KIKAZARU', label: '🙉 KIKAZARU', type: 'STATE', x: 600, y: 480 },
    { id: 'ST_IWAZARU', label: '🙊 IWAZARU', type: 'STATE', x: 600, y: 520 },
    { id: 'ST_SMILE', label: 'FACE: SMILE', type: 'STATE', x: 600, y: 580 },
    { id: 'ST_SURPRISE', label: 'FACE: SURPRISE', type: 'STATE', x: 600, y: 620 },
];

const GRAPH_EDGES = [
    { source: 'IN_VEL', target: 'FT_ACTIVE', weight: 0.9 },
    { source: 'IN_FIST', target: 'FT_HOLDING', weight: 0.9 },
    { source: 'IN_PINCH', target: 'FT_HOLDING', weight: 0.8 },
    { source: 'IN_HANDS_PROX', target: 'FT_FRICTION', weight: 0.7 },
    { source: 'IN_REL_MOV', target: 'FT_FRICTION', weight: 0.9 },
    { source: 'IN_OCCLUSION', target: 'FT_HIDING', weight: 1.0 },
    { source: 'FT_HOLDING', target: 'ST_GRASP', weight: 1.0 },
    { source: 'FT_ACTIVE', target: 'ST_GRASP', weight: -0.3 },
    { source: 'FT_HOLDING', target: 'ST_DRAG', weight: 0.8 },
    { source: 'FT_ACTIVE', target: 'ST_DRAG', weight: 0.9 },
    { source: 'FT_FRICTION', target: 'ST_WASH', weight: 1.2 },
    { source: 'FT_HIDING', target: 'ST_PEEKABOO', weight: 1.2 },
    { source: 'IN_FIST', target: 'FT_RPS_ROCK', weight: 0.8 },
    { source: 'IN_SCISSORS', target: 'FT_RPS_SCI', weight: 0.9 },
    { source: 'IN_OPEN', target: 'FT_RPS_PAP', weight: 0.9 },
    { source: 'FT_RPS_ROCK', target: 'ST_ROCK', weight: 0.9 },
    { source: 'FT_RPS_SCI', target: 'ST_SCISSORS', weight: 0.9 },
    { source: 'FT_RPS_PAP', target: 'ST_PAPER', weight: 0.9 },
    { source: 'IN_THUMB_UP', target: 'FT_APPROVAL', weight: 1.0 },
    { source: 'IN_THUMB_DOWN', target: 'FT_DISAPPROVAL', weight: 1.0 },
    { source: 'IN_THUMB_UP', target: 'FT_RPS_ROCK', weight: -0.5 },
    { source: 'IN_THUMB_DOWN', target: 'FT_RPS_ROCK', weight: -0.5 },
    { source: 'FT_APPROVAL', target: 'ST_YES', weight: 1.0 },
    { source: 'FT_DISAPPROVAL', target: 'ST_NO', weight: 1.0 },
    { source: 'IN_EYES_ACT', target: 'FT_HIDDEN_SENSE', weight: 0.8 },
    { source: 'IN_EYES_ACT', target: 'ST_MIZARU', weight: 1.0 },
    { source: 'IN_HANDS_PROX', target: 'ST_MIZARU', weight: 0.5 },
    { source: 'IN_EARS_ACT', target: 'FT_HIDDEN_SENSE', weight: 0.8 },
    { source: 'IN_EARS_ACT', target: 'ST_KIKAZARU', weight: 1.0 },
    { source: 'IN_MOUTH_GUARD', target: 'FT_HIDDEN_SENSE', weight: 0.8 },
    { source: 'IN_MOUTH_GUARD', target: 'ST_IWAZARU', weight: 1.0 },
    { source: 'IN_HANDS_PROX', target: 'ST_IWAZARU', weight: 0.8 },
    { source: 'IN_SMILE', target: 'FT_HAPPY', weight: 0.9 },
    { source: 'IN_MOUTH', target: 'FT_SHOCK', weight: 0.6 },
    { source: 'IN_FACE_PROX', target: 'FT_SHOCK', weight: 0.5 },
    { source: 'FT_HAPPY', target: 'ST_SMILE', weight: 0.9 },
    { source: 'FT_SHOCK', target: 'ST_SURPRISE', weight: 0.9 },
    { source: 'FT_ACTIVE', target: 'ST_IDLE', weight: -0.6 },
    { source: 'ST_ROCK', target: 'ST_SCISSORS', weight: -0.8 },
    { source: 'ST_ROCK', target: 'ST_PAPER', weight: -0.8 },
    { source: 'ST_SCISSORS', target: 'ST_PAPER', weight: -0.8 },
    { source: 'ST_YES', target: 'ST_NO', weight: -2.0 },
    { source: 'ST_NO', target: 'ST_YES', weight: -2.0 },
    { source: 'ST_MIZARU', target: 'ST_KIKAZARU', weight: -1.0 },
    { source: 'ST_MIZARU', target: 'ST_IWAZARU', weight: -1.0 },
    { source: 'ST_KIKAZARU', target: 'ST_IWAZARU', weight: -1.0 },
    { source: 'ST_GRASP', target: 'ST_WASH', weight: -0.8 },
    { source: 'ST_WASH', target: 'ST_GRASP', weight: -0.8 },
    { source: 'ST_DRAG', target: 'ST_WASH', weight: -0.8 },
];

// --- JS Utility for SMA Buffer ---
class SensorBuffer {
    constructor(size = 5) {
        this.size = size;
        this.buffer = {};
    }
    add(key, val) {
        if (!this.buffer[key]) this.buffer[key] = [];
        this.buffer[key].push(val);
        if (this.buffer[key].length > this.size) this.buffer[key].shift();
    }
    getAverage(key) {
        if (!this.buffer[key] || this.buffer[key].length === 0) return 0;
        const sum = this.buffer[key].reduce((a, b) => a + b, 0);
        return sum / this.buffer[key].length;
    }
}

const LogicGraphApp = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const graphContainerRef = useRef(null);
    const cyRef = useRef(null);
    
    // Rust Engine Reference
    const engineRef = useRef(null);
    
    const bufferRef = useRef(new SensorBuffer(5));
    const memoryRef = useRef({ faceVisible: false, lastHandFaceDist: 1.0, framesLost: 0 });
    const prevPoseRef = useRef(null);

    const [rankedStates, setRankedStates] = useState([]);
    const [history, setHistory] = useState([]);
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [isWasmReady, setIsWasmReady] = useState(false);

    const drawHandSkeleton = (ctx, landmarks, w, h, color) => {
        const connect = (i, j) => {
            const p1 = landmarks[i]; const p2 = landmarks[j];
            ctx.beginPath(); ctx.moveTo(p1.x * w, p1.y * h); ctx.lineTo(p2.x * w, p2.y * h); ctx.stroke();
        };
        ctx.strokeStyle = color; ctx.lineWidth = 2;
        [[0,1,2,3,4],[0,5,6,7,8],[0,9,10,11,12],[0,13,14,15,16],[0,17,18,19,20]].forEach(chain => {
            for(let k=0; k<chain.length-1; k++) connect(chain[k], chain[k+1]);
        });
        ctx.fillStyle = color;
        [4,8,12,16,20].forEach(i => {
            ctx.beginPath(); ctx.arc(landmarks[i].x * w, landmarks[i].y * h, 3, 0, 2 * Math.PI); ctx.fill();
        });
    };

    // --- Initialization ---
    useEffect(() => {
        const startSystem = async () => {
            // 1. Load WASM
            await init();
            engineRef.current = new ContextEngine();
            setIsWasmReady(true);

            // 2. Setup Cytoscape
            if (graphContainerRef.current) {
                const nodes = GRAPH_NODES.map(n => ({
                    data: { id: n.id, label: n.label, type: n.type },
                    position: { x: n.x, y: n.y },
                    classes: n.type
                }));
                const edges = GRAPH_EDGES.map(e => ({
                    data: { id: `${e.source}-${e.target}`, source: e.source, target: e.target, weight: e.weight }
                }));
                
                cyRef.current = cytoscape({
                    container: graphContainerRef.current,
                    elements: [...nodes, ...edges],
                    style: [
                        { selector: 'node', style: { 'label': 'data(label)', 'color': '#e2e8f0', 'font-size': '8px', 'background-color': '#334155', 'text-valign': 'center', 'text-halign': 'center', 'border-color': '#fff', 'border-width': 1, 'transition-property': 'background-color, width, height, border-width, opacity', 'transition-duration': 100 } },
                        { selector: '.STATE', style: { 'shape': 'rectangle', 'width': 60, 'height': 25, 'background-color': '#475569' } },
                        { selector: '.SENSOR', style: { 'shape': 'diamond', 'width': 25, 'height': 25, 'background-color': '#0ea5e9' } },
                        { selector: '.FEATURE', style: { 'shape': 'ellipse', 'width': 30, 'height': 30, 'background-color': '#8b5cf6' } },
                        { selector: 'edge', style: { 'width': 1, 'line-color': '#334155', 'target-arrow-shape': 'triangle', 'arrow-scale': 0.8 } }
                    ],
                    layout: { name: 'preset' },
                    userZoomingEnabled: true,
                    minZoom: 0.5,
                    maxZoom: 2.0
                });
                cyRef.current.fit(undefined, 30);
            }

            // 3. Setup MediaPipe
            if (videoRef.current && window.Holistic && window.Camera) {
                try {
                    const holistic = new window.Holistic({
                        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
                    });
                    holistic.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6 });
                    holistic.onResults(onResults);
                    const camera = new window.Camera(videoRef.current, {
                        onFrame: async () => { await holistic.send({ image: videoRef.current }); },
                        width: 640, height: 360
                    });
                    camera.start();
                    setIsCameraReady(true);
                } catch (err) {
                    console.error("Camera Init Failed", err);
                }
            }
        };
        startSystem();
    }, []);

    const onResults = (results) => {
        // --- 1. Draw Canvas ---
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.save();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
            if (results.rightHandLandmarks) drawHandSkeleton(ctx, results.rightHandLandmarks, canvas.width, canvas.height, '#34d399');
            if (results.leftHandLandmarks) drawHandSkeleton(ctx, results.leftHandLandmarks, canvas.width, canvas.height, '#34d399');
            // Face points (simplified)
            if (results.faceLandmarks) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                [33, 263, 234, 454, 13, 14].forEach(i => {
                    const lm = results.faceLandmarks[i];
                    ctx.beginPath(); ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 2, 0, 2 * Math.PI); ctx.fill();
                });
            }
            ctx.restore();
        }

        // --- 2. Calculate Sensors (JS Logic) ---
        const sensors = {
            'IN_VEL': 0, 'IN_REL_MOV': 0, 'IN_FIST': 0, 'IN_PINCH': 0, 'IN_OPEN': 0, 
            'IN_SCISSORS': 0, 'IN_HANDS_PROX': 0, 'IN_OCCLUSION': 0,
            'IN_THUMB_UP': 0, 'IN_THUMB_DOWN': 0,
            'IN_EYES_ACT': 0, 'IN_EARS_ACT': 0, 'IN_MOUTH_GUARD': 0,
            'IN_SMILE': 0, 'IN_MOUTH': 0, 'IN_FACE_PROX': 0
        };

        const activeHand = results.rightHandLandmarks || results.leftHandLandmarks;
        const bothHands = results.rightHandLandmarks && results.leftHandLandmarks;
        const mem = memoryRef.current;
        let handCenter = {x:0, y:0};
        let activeHandsCount = 0;

        if (activeHand) {
            const processHand = (lm) => {
                const wrist = lm[0];
                handCenter.x += wrist.x;
                handCenter.y += wrist.y;
                activeHandsCount++;

                let bentCount = 0;
                const bentState = [false, false, false, false];
                const tips = [8, 12, 16, 20];
                const mcps = [5, 9, 13, 17];
                
                tips.forEach((t, i) => {
                    const dTip = Math.hypot(lm[t].x - wrist.x, lm[t].y - wrist.y);
                    const dMcp = Math.hypot(lm[mcps[i]].x - wrist.x, lm[mcps[i]].y - wrist.y);
                    if (dTip < dMcp * 1.1) { bentCount++; bentState[i] = true; }
                });
                
                const thumbTip = lm[4];
                const pinkyMcp = lm[17];
                const isThumbBent = Math.hypot(thumbTip.x - pinkyMcp.x, thumbTip.y - pinkyMcp.y) < 0.15;
                if (isThumbBent) bentCount++;

                if (bentCount >= 5) sensors.IN_FIST = 1.0;
                else if (bentCount <= 1 && !isThumbBent) sensors.IN_OPEN = 1.0;
                
                if (!bentState[0] && !bentState[1] && bentState[2] && bentState[3]) sensors.IN_SCISSORS = 1.0;

                const indexTip = lm[8];
                if (Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y) < 0.05) sensors.IN_PINCH = 1.0;

                if (bentCount >= 4 && !isThumbBent) {
                    const thumbMcp = lm[2];
                    if (thumbTip.y < thumbMcp.y - 0.05) sensors.IN_THUMB_UP = 1.0;
                    else if (thumbTip.y > thumbMcp.y + 0.05) sensors.IN_THUMB_DOWN = 1.0;
                }

                if (results.faceLandmarks) {
                    const nose = results.faceLandmarks[1];
                    const dist = Math.hypot(wrist.x - nose.x, wrist.y - nose.y);
                    sensors.IN_FACE_PROX = Math.max(0, 1 - (dist / 0.25));
                }
            };

            if (results.rightHandLandmarks) processHand(results.rightHandLandmarks);
            if (results.leftHandLandmarks) processHand(results.leftHandLandmarks);

            // Velocity
            handCenter.x /= activeHandsCount;
            handCenter.y /= activeHandsCount;
            if (prevPoseRef.current) {
                const dist = Math.hypot(handCenter.x - prevPoseRef.current.x, handCenter.y - prevPoseRef.current.y);
                const rawVel = dist * 30;
                sensors.IN_VEL = Math.min(1, Math.max(0, (rawVel - 0.05) * 2));
            }
            prevPoseRef.current = { x: handCenter.x, y: handCenter.y };
        } else {
            prevPoseRef.current = null;
        }

        if (bothHands && results.faceLandmarks) {
            const rw = results.rightHandLandmarks[0];
            const lw = results.leftHandLandmarks[0];
            const face = results.faceLandmarks;
            const handDist = Math.hypot(rw.x - lw.x, rw.y - lw.y);
            if (handDist < 0.15) sensors.IN_HANDS_PROX = 1.0;
            
            if (sensors.IN_HANDS_PROX && sensors.IN_VEL > 0.2) sensors.IN_REL_MOV = 1.0;

            const leftEye = face[33]; const rightEye = face[263];
            const dLE = Math.hypot(lw.x - leftEye.x, lw.y - leftEye.y);
            const dRE = Math.hypot(rw.x - rightEye.x, rw.y - rightEye.y);
            const eyesProx = (dLE < 0.15 || Math.hypot(rw.x - leftEye.x, rw.y - leftEye.y) < 0.15) && 
                             (dRE < 0.15 || Math.hypot(lw.x - rightEye.x, lw.y - rightEye.y) < 0.15);
            if (eyesProx && sensors.IN_HANDS_PROX > 0.4) sensors.IN_EYES_ACT = 1.0;

            const leftEar = face[234]; const rightEar = face[454];
            const dEarL = Math.hypot(lw.x - leftEar.x, lw.y - leftEar.y);
            const dEarR = Math.hypot(rw.x - rightEar.x, rw.y - rightEar.y);
            if (dEarL < 0.2 && dEarR < 0.2) sensors.IN_EARS_ACT = 1.0;

            const mouth = face[13];
            const dMouthL = Math.hypot(lw.x - mouth.x, lw.y - mouth.y);
            const dMouthR = Math.hypot(rw.x - mouth.x, rw.y - mouth.y);
            if (dMouthL < 0.15 && dMouthR < 0.15 && sensors.IN_HANDS_PROX > 0.4) sensors.IN_MOUTH_GUARD = 1.0;
        }

        if (results.faceLandmarks) {
            const face = results.faceLandmarks;
            const upper = face[13]; const lower = face[14];
            const mouthH = Math.hypot(upper.x - lower.x, upper.y - lower.y);
            sensors.IN_MOUTH = Math.min(1, Math.max(0, (mouthH - 0.01) * 20));

            const leftC = face[61]; const rightC = face[291];
            const width = Math.hypot(leftC.x - rightC.x, leftC.y - rightC.y);
            if (width > 0.15) sensors.IN_SMILE = Math.min(1, (width - 0.15) * 10);

            const nose = face[1];
            if (activeHandsCount > 0) {
                mem.lastHandFaceDist = Math.hypot(handCenter.x - nose.x, handCenter.y - nose.y);
            }
            mem.faceVisible = true;
            mem.framesLost = 0;
        } else {
            if (mem.faceVisible) {
                 mem.framesLost++;
                 if (mem.framesLost < 30) { 
                    if (mem.lastHandFaceDist < 0.2) sensors.IN_OCCLUSION = 1.0; 
                 } else {
                     mem.faceVisible = false;
                 }
            }
        }

        // Buffer Smoothing
        Object.keys(sensors).forEach(k => {
            bufferRef.current.add(k, sensors[k]);
            sensors[k] = bufferRef.current.getAverage(k);
        });

        // --- 3. Rust Engine Execution ---
        if (engineRef.current) {
            const engine = engineRef.current;
            engine.inject(sensors);
            engine.step();
            
            const activations = engine.get_activations();
            const ranked = engine.get_ranked_states();
            
            setRankedStates(ranked);

            // History Update (Throttled)
            if (Math.random() > 0.85) {
                setHistory(prev => [...prev, { time: Date.now(), ...activations }].slice(-50));
            }

            // Cytoscape Update
            if (cyRef.current) {
                cyRef.current.batch(() => {
                    Object.entries(activations).forEach(([id, val]) => {
                        const el = cyRef.current.$(`#${id}`);
                        if (el && el.length > 0) {
                            const intensity = Math.floor(val * 255);
                            let color = '';
                            if (id.startsWith('ST_')) {
                                if (id.includes('MIZARU') || id.includes('KIKAZARU') || id.includes('IWAZARU')) color = '#a855f7';
                                else if (id.includes('YES')) color = '#4ade80';
                                else if (id.includes('NO')) color = '#f87171';
                                else if (id.includes('GRASP') || id.includes('DRAG') || id.includes('WASH')) color = '#facc15'; 
                                else if (id.includes('PEEKABOO')) color = '#f472b6';
                                else color = val > 0.5 ? '#f59e0b' : '#64748b';
                            } else if (id.startsWith('FT_')) {
                                color = `rgb(${100+intensity/2}, ${50}, ${200+intensity/5})`;
                            } else {
                                color = `rgb(0, ${intensity}, ${255})`;
                            }
                            el.style({
                                'background-color': color,
                                'border-width': 1 + val * 3,
                                'width': (id.startsWith('ST') ? 60 : 25) + (val * 10),
                                'height': (id.startsWith('ST') ? 25 : 25) + (val * 10),
                                'opacity': 0.3 + (val * 0.7),
                                'z-index': val > 0.5 ? 100 : 0
                            });
                        }
                    });
                    
                    GRAPH_EDGES.forEach(edge => {
                        const sourceVal = activations[edge.source] || 0;
                        const edgeEl = cyRef.current.$(`#${edge.source}-${edge.target}`);
                        if (edgeEl && edgeEl.length > 0) {
                            const active = sourceVal > 0.1;
                            edgeEl.style({
                                'width': active ? 0.5 + sourceVal * 3 : 0.2,
                                'line-color': active ? '#a78bfa' : '#1e293b',
                                'target-arrow-color': active ? '#a78bfa' : '#1e293b',
                                'opacity': active ? 0.6 : 0.1
                            });
                        }
                    });
                });
            }
        }
    };

    const winner = rankedStates.length > 0 ? rankedStates[0] : { label: 'INIT', value: 0, id: 'INIT' };
    const isConfident = winner.value > 0.55;

    return (
        <div className="h-screen flex flex-col p-4 gap-4 overflow-hidden bg-slate-950 text-slate-100 font-mono">
            <header className="flex justify-between items-center border-b border-slate-800 pb-2 shrink-0">
                <div className="flex items-center gap-2">
                    <Brain className="text-purple-400" />
                    <h1 className="text-xl font-bold tracking-wider">
                        CONTEXT<span className="text-purple-400">GRAPH</span>.RS <span className="text-xs text-green-400 ml-2">WASM CORE</span>
                    </h1>
                </div>
                <div className="text-xs text-slate-500 flex gap-4 hidden md:flex">
                    <span className="flex items-center gap-1"><ScanFace size={14} /> V4 SEMANTICS</span>
                    <span className="flex items-center gap-1"><Hand size={14} /> V5 PHYSICS</span>
                    <span className="flex items-center gap-1"><Zap size={14} /> RUST ENGINE</span>
                    <span className="flex items-center gap-1"><Ghost size={14} /> PERMANENCE</span>
                </div>
            </header>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden min-h-0">
                <div className="col-span-1 lg:col-span-4 flex flex-col gap-4 min-h-0">
                    <div className="relative aspect-video bg-black rounded border border-slate-800 shrink-0 overflow-hidden shadow-2xl">
                        <div className="absolute top-2 left-2 z-10 bg-black/60 px-2 py-1 rounded text-xs text-purple-300 flex items-center gap-2 backdrop-blur-sm border border-purple-500/30">
                            <Camera size={12} /> SENSOR INPUT
                        </div>
                        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-0" playsInline muted />
                        <canvas ref={canvasRef} className="w-full h-full object-cover transform -scale-x-100" width="640" height="360" />
                        {!isCameraReady && <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs animate-pulse">INITIALIZING SYSTEM...</div>}
                    </div>
                    
                    <div className="bg-slate-900/50 p-4 rounded border border-slate-800 flex-1 flex flex-col overflow-hidden relative">
                        <div className="text-xs text-slate-500 mb-2 tracking-widest uppercase flex justify-between">
                            <span>Dominant Context</span>
                            <span>Confidence: {(winner.value * 100).toFixed(0)}%</span>
                        </div>
                        <div className={`text-3xl font-black mb-6 transition-all duration-300 ${
                            isConfident ? 
                            (winner.id.includes('YES') ? 'text-green-400' : 
                             winner.id.includes('NO') ? 'text-red-400' : 
                             winner.id.includes('MIZARU') || winner.id.includes('KIKAZARU') || winner.id.includes('IWAZARU') ? 'text-purple-400 animate-pulse' :
                             winner.id.includes('PEEKABOO') ? 'text-pink-400' :
                             winner.id.includes('GRASP') || winner.id.includes('DRAG') ? 'text-orange-400' :
                             winner.id.includes('SURPRISE') ? 'text-yellow-400' : 'text-blue-400') 
                             : 'text-slate-600 blur-[1px]'
                        }`}>
                            {isConfident ? winner.label : "ANALYZING..."}
                        </div>
                        <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                            <div className="text-[10px] text-slate-500 uppercase border-b border-slate-800 pb-1 mb-2">Context Candidates</div>
                            {rankedStates.slice(0, 8).map((state, idx) => (
                                <div key={state.id} className="group flex items-center gap-3">
                                    <div className="w-6 text-right text-xs text-slate-500 font-mono">#{idx+1}</div>
                                    <div className="flex-1">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className={idx === 0 ? 'text-white font-bold' : 'text-slate-400'}>{state.label}</span>
                                            <span className="text-slate-500 font-mono">{(state.value).toFixed(2)}</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full transition-all duration-300 ${idx === 0 ? 'bg-purple-500' : 'bg-slate-600'}`} style={{width: `${state.value * 100}%`}}></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="col-span-1 lg:col-span-8 flex flex-col gap-4 min-h-0">
                    <div className="flex-1 bg-slate-900 rounded border border-slate-800 relative min-h-[300px] overflow-hidden">
                        <div className="absolute top-2 right-2 z-10 bg-black/60 px-2 py-1 rounded text-xs text-purple-300 flex items-center gap-2 backdrop-blur-sm border border-purple-500/30">
                            <Network size={12} /> SEMANTIC + PHYSICAL NETWORK
                        </div>
                        <div ref={graphContainerRef} className="cy-container" />
                    </div>
                    
                    <div className="h-32 bg-slate-950 rounded border border-slate-800 p-2 shrink-0 relative">
                        <div className="absolute top-2 left-2 z-10 text-xs text-slate-500 flex items-center gap-1">
                            <Activity size={10} /> MULTI-MODAL HISTORY
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={history}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <YAxis domain={[0, 1]} hide />
                                <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b' }} itemStyle={{ fontSize: '10px' }} labelStyle={{ display: 'none' }} />
                                <Line type="monotone" dataKey="ST_MIZARU" stroke="#d8b4fe" dot={false} strokeWidth={2} />
                                <Line type="monotone" dataKey="ST_YES" stroke="#4ade80" dot={false} strokeWidth={1} />
                                <Line type="monotone" dataKey="ST_GRASP" stroke="#facc15" dot={false} strokeWidth={2} />
                                <Line type="monotone" dataKey="ST_PEEKABOO" stroke="#f472b6" dot={false} strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

const root = createRoot(document.getElementById('root'));
root.render(<LogicGraphApp />);