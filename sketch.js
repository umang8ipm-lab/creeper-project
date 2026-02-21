// ============================================================
//  CREEPER MACHINE — P5.js + Teachable Machine
//  Drop this sketch.js into a p5 project folder with index.html
//  that loads p5, tfjs, and teachablemachine-image.
//
//  index.html needs these scripts BEFORE sketch.js:
//  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
//  <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.21.0/dist/tf.min.js"></script>
//  <script src="https://cdn.jsdelivr.net/npm/@teachablemachine/image@0.8/dist/teachablemachine-image.min.js"></script>
// ============================================================

const MODEL_URL = "https://teachablemachine.withgoogle.com/models/WfvQYYeUn/";

// ─── Teachable Machine State ────────────────────────────────
let tmModel, tmWebcam;
let currentGesture = "none"; // "thumbsup" | "thumbsdown" | "none"
let labelText = "Loading model...";

async function initTM() {
  tmModel = await tmImage.load(MODEL_URL + "model.json", MODEL_URL + "metadata.json");
  tmWebcam = new tmImage.Webcam(200, 150, true);
  await tmWebcam.setup();
  await tmWebcam.play();
  labelText = "Model ready!";
  tmLoop();
}

async function tmLoop() {
  tmWebcam.update();
  const preds = await tmModel.predict(tmWebcam.canvas);
  const best = preds.reduce((a, b) => a.probability > b.probability ? a : b);
  const label = best.className.toLowerCase();
  const conf = best.probability;
  labelText = `${best.className}  ${(conf * 100).toFixed(0)}%`;

  if (conf > 0.75) {
    if (label.includes("thumbs up") || label.includes("thumb up")) {
      currentGesture = "thumbsup";
    } else if (label.includes("thumbs down") || label.includes("thumb down")) {
      currentGesture = "thumbsdown";
    } else {
      currentGesture = "none";
    }
  } else {
    currentGesture = "none";
  }
  requestAnimationFrame(tmLoop);
}

// ─── Creeper Setup ──────────────────────────────────────────
const S = 16; // pixel block size

const HEAD_MAP = [
  [0,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,1],
  [1,1,3,3,1,3,3,1],
  [1,1,3,3,1,3,3,1],
  [1,1,1,1,1,1,1,1],
  [1,1,1,3,3,3,1,1],
  [1,1,3,3,3,3,1,1],
  [0,1,1,1,1,1,1,0],
];

const BODY_MAP = [
  [0,0,1,1,1,1,0,0],
  [0,1,1,2,2,1,1,0],
  [0,1,2,2,2,2,1,0],
  [0,1,2,2,2,2,1,0],
  [0,0,1,1,1,1,0,0],
  [0,1,1,0,0,1,1,0],
  [1,1,0,0,0,0,1,1],
  [1,1,0,0,0,0,1,1],
];

const FULL_MAP = [...HEAD_MAP, ...BODY_MAP];

// Creeper state machine
const STATES = { IDLE: 0, WALK: 1, EXPLODE: 2, REFORM: 3 };
let state = STATES.IDLE;

// Walk
let cx = 220, cy = 280;
let walkDir = 1;

// Pieces for explosion/reform
let pieces = [];
let reformTimer = 0;

// Gesture hold counter
let lastGesture = "none";
let gestureHold = 0;
let statusText = "Show 👍 or 👎";

function getColor(v) {
  if (v === 1) return color(50, 168, 82);
  if (v === 2) return color(30, 130, 50);
  if (v === 3) return color(0, 0, 0);
  return null;
}

function buildPieces(x, y) {
  pieces = [];
  for (let r = 0; r < FULL_MAP.length; r++) {
    for (let c = 0; c < 8; c++) {
      const v = FULL_MAP[r][c];
      if (v === 0) continue;
      pieces.push({
        tx: x - 4 * S + c * S,   // target x
        ty: y - 8 * S + r * S,   // target y
        px: x - 4 * S + c * S,   // current x
        py: y - 8 * S + r * S,   // current y
        vx: 0,
        vy: 0,
        v: v,
      });
    }
  }
}

function scatterPieces() {
  for (const pc of pieces) {
    pc.vx = random(-13, 13);
    pc.vy = random(-15, -4);
  }
}

function drawCreeper(x, y, alpha) {
  push();
  noStroke();
  translate(x - 4 * S, y - 8 * S);
  for (let r = 0; r < FULL_MAP.length; r++) {
    for (let c = 0; c < 8; c++) {
      const v = FULL_MAP[r][c];
      if (v === 0) continue;
      const col = getColor(v);
      col.setAlpha(alpha !== undefined ? alpha : 255);
      fill(col);
      rect(c * S, r * S, S, S);
    }
  }
  pop();
}

// ─── P5 Core ────────────────────────────────────────────────
function setup() {
  createCanvas(440, 420);
  pixelDensity(1);
  buildPieces(cx, cy);
  initTM().catch(e => { labelText = "Webcam error: " + e.message; });
}

function draw() {
  background(26, 26, 46);

  // Ground
  noStroke();
  fill(20, 100, 40);
  rect(0, 360, width, 60);
  fill(15, 80, 30);
  rect(0, 360, width, 8);

  // ── Gesture → state transitions ──
  const g = currentGesture;
  if (g !== lastGesture) { gestureHold = 0; lastGesture = g; }
  else gestureHold++;

  if (g === "thumbsdown" && gestureHold > 20 && state !== STATES.EXPLODE) {
    state = STATES.EXPLODE;
    buildPieces(cx, cy);
    scatterPieces();
    statusText = "💥 BOOM!";
  }

  if (g === "thumbsup" && gestureHold > 20 && state !== STATES.WALK && state !== STATES.REFORM) {
    state = STATES.REFORM;
    reformTimer = 0;
    // Scatter pieces to random locations so they fly IN
    for (const pc of pieces) {
      pc.px = random(0, width);
      pc.py = random(0, height);
    }
    statusText = "✨ REFORMING...";
  }

  // ── IDLE ──
  if (state === STATES.IDLE) {
    drawCreeper(cx, cy);
  }

  // ── WALK ──
  if (state === STATES.WALK) {
    cx += walkDir * 1.5;
    if (cx > 410) walkDir = -1;
    if (cx < 30)  walkDir =  1;
    const bob = sin(frameCount * 0.15) * 4;
    push(); translate(0, bob); drawCreeper(cx, cy); pop();
    statusText = "👍 Walking!";
  }

  // ── EXPLODE ──
  if (state === STATES.EXPLODE) {
    for (const pc of pieces) {
      pc.vy += 0.55; // gravity
      pc.px += pc.vx;
      pc.py += pc.vy;
      if (pc.py > 352) { pc.py = 352; pc.vy *= -0.3; pc.vx *= 0.8; }
      if (pc.px < 0 || pc.px > width - S) pc.vx *= -0.6;
      const col = getColor(pc.v);
      noStroke();
      fill(col);
      rect(pc.px, pc.py, S, S);
    }

    // Orange flash ring
    if (frameCount % 6 < 3) {
      noFill();
      stroke(255, 160, 0, 80);
      strokeWeight(6);
      ellipse(cx, cy - 4 * S, 160 + sin(frameCount * 0.5) * 20, 160);
    }
  }

  // ── REFORM ──
  if (state === STATES.REFORM) {
    reformTimer++;
    const t = constrain(reformTimer / 90, 0, 1);
    let done = true;

    for (const pc of pieces) {
      pc.px = lerp(pc.px, pc.tx, 0.07);
      pc.py = lerp(pc.py, pc.ty, 0.07);
      if (dist(pc.px, pc.py, pc.tx, pc.ty) > 2) done = false;
      const col = getColor(pc.v);
      col.setAlpha(map(t, 0, 1, 60, 255));
      noStroke();
      fill(col);
      rect(pc.px, pc.py, S, S);
    }

    // Sparkle particles on reform
    if (random() < 0.4) {
      const rp = random(pieces);
      noStroke();
      fill(255, 255, 100, 180);
      ellipse(rp.px + S/2, rp.py + S/2, 6, 6);
    }

    if (done) {
      buildPieces(cx, cy);
      state = STATES.WALK;
    }
  }

  // ── Webcam thumbnail ──
  if (tmWebcam && tmWebcam.canvas) {
    // Border using p5
    noStroke();
    fill(0, 255, 136, 40);
    rect(width - 214, 6, 208, 162, 4);
    // Draw raw HTML canvas directly via 2D context
    drawingContext.drawImage(tmWebcam.canvas, width - 212, 8, 204, 158);
  }

  // ── Pixel grid overlay ──
  stroke(255, 255, 255, 6);
  strokeWeight(0.5);
  for (let x = 0; x < width; x += S)  line(x, 0, x, height);
  for (let y = 0; y < height; y += S) line(0, y, width, y);

  // ── HUD ──
  noStroke();
  fill(0, 255, 136);
  textFont('Courier New');
  textSize(12);
  text(labelText, 8, 18);
  textSize(14);
  fill(255, 220, 0);
  text(statusText, 8, height - 10);
}