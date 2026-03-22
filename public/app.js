const socket = io();
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const viewport = document.getElementById("viewport");

const BOARD_SIZE = parseInt(canvas.getAttribute("data-size"));
const PIXEL_SIZE = canvas.width / BOARD_SIZE;

const colorModal = document.getElementById("colorModal");
const closeModal = document.getElementById("closeModal");
const cooldownText = document.getElementById("cooldownText");
const colorButtons = document.querySelectorAll(".color-btn");
const recenterBtn = document.getElementById("recenterBtn");

let selectedX = null;
let selectedY = null;
let isOnCooldown = false;
const COOLDOWN_SECONDS = 3;

let localBoard = [];
let hoveredX = null;
let hoveredY = null;

let scale = 1;
let targetScale = 1;
let panX = 0;
let targetPanX = 0;
let panY = 0;
let targetPanY = 0;

let isDragging = false;
let isClick = false;
let startDragX, startDragY;

function animateCamera() {
  scale += (targetScale - scale) * 0.15;
  panX += (targetPanX - panX) * 0.15;
  panY += (targetPanY - panY) * 0.15;

  canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  requestAnimationFrame(animateCamera);
}
requestAnimationFrame(animateCamera);

function drawPixel(x, y, color) {
  ctx.fillStyle = color || "#FFFFFF";
  ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
}

function drawHover(x, y) {
  ctx.strokeStyle = isOnCooldown
    ? "rgba(231, 76, 60, 0.8)"
    : "rgba(0, 0, 0, 0.5)";

  // Paneme joone paksuse stabiilseks
  ctx.lineWidth = 2;

  // Nihutame raami 1px võrra SISSEPOOLE. Nii ei voola hoveri raam
  // kunagi pikslist välja ja vana hover kustub perfektselt!
  ctx.strokeRect(
    x * PIXEL_SIZE + 1,
    y * PIXEL_SIZE + 1,
    PIXEL_SIZE - 2,
    PIXEL_SIZE - 2,
  );
}

// ------------------------------------
// SIIN ON PARANDATUD OSA (Binaarne on läinud!)
// ------------------------------------
socket.on("initBoard", (serverBoard) => {
  localBoard = serverBoard;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      drawPixel(x, y, localBoard[y][x]);
    }
  }
});

socket.on("pixelUpdated", ({ x, y, color }) => {
  if (localBoard[y]) {
    localBoard[y][x] = color;
    drawPixel(x, y, color);
    if (hoveredX === x && hoveredY === y) drawHover(x, y);
  }
});
// ------------------------------------

// 1. HIIRE ALLA VAJUTAMINE
viewport.addEventListener("mousedown", (e) => {
  if (e.target !== canvas && e.target !== viewport) return;
  isDragging = true;
  isClick = true;
  startDragX = e.clientX - targetPanX;
  startDragY = e.clientY - targetPanY;
});

// 2. HIIRE LIIGUTAMINE
window.addEventListener("mousemove", (e) => {
  if (isDragging) {
    isClick = false;
    targetPanX = e.clientX - startDragX;
    targetPanY = e.clientY - startDragY;
    return;
  }

  if (!colorModal.classList.contains("hidden") || e.target !== canvas) return;

  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / (PIXEL_SIZE * scale));
  const y = Math.floor((e.clientY - rect.top) / (PIXEL_SIZE * scale));

  if (x !== hoveredX || y !== hoveredY) {
    // A. Kustuta vana hover
    if (hoveredX !== null && hoveredY !== null && localBoard[hoveredY]) {
      drawPixel(hoveredX, hoveredY, localBoard[hoveredY][hoveredX]);
    }

    // B. Määra uued koordinaadid ja joonista uus hover
    hoveredX = x;
    hoveredY = y;
    if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
      drawHover(x, y);
    }
  }
});

// 3. HIIRE LAHTI LASKMINE
window.addEventListener("mouseup", (e) => {
  isDragging = false;

  if (isClick && e.target === canvas) {
    if (isOnCooldown) return;

    const rect = canvas.getBoundingClientRect();
    selectedX = Math.floor((e.clientX - rect.left) / (PIXEL_SIZE * scale));
    selectedY = Math.floor((e.clientY - rect.top) / (PIXEL_SIZE * scale));

    if (hoveredX !== null && hoveredY !== null && localBoard[hoveredY]) {
      drawPixel(hoveredX, hoveredY, localBoard[hoveredY][hoveredX]);
    }
    colorModal.classList.remove("hidden");
  }
});

// 4. SUUMIMINE RULLIKUGA
viewport.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    let oldTargetScale = targetScale;

    if (e.deltaY < 0) {
      targetScale *= 1.25;
    } else {
      targetScale /= 1.25;
    }

    targetScale = Math.max(0.1, Math.min(targetScale, 20));

    targetPanX =
      e.clientX - (e.clientX - targetPanX) * (targetScale / oldTargetScale);
    targetPanY =
      e.clientY - (e.clientY - targetPanY) * (targetScale / oldTargetScale);
  },
  { passive: false },
);

colorButtons.forEach((button) => {
  button.addEventListener("click", (e) => {
    const color = e.target.getAttribute("data-color");
    colorModal.classList.add("hidden");

    if (localBoard[selectedY]) {
      localBoard[selectedY][selectedX] = color;
      drawPixel(selectedX, selectedY, color);
      socket.emit("drawPixel", { x: selectedX, y: selectedY, color });
      startCooldown();
    }

    hoveredX = selectedX;
    hoveredY = selectedY;
    drawHover(hoveredX, hoveredY);
  });
});

closeModal.addEventListener("click", () => {
  colorModal.classList.add("hidden");
  hoveredX = selectedX;
  hoveredY = selectedY;
  drawHover(hoveredX, hoveredY);
});

function startCooldown() {
  isOnCooldown = true;
  let timeLeft = COOLDOWN_SECONDS;
  cooldownText.innerText = `Oota ${timeLeft} s...`;
  cooldownText.style.color = "#e74c3c";

  if (hoveredX !== null && hoveredY !== null) {
    drawHover(hoveredX, hoveredY);
  }

  const timer = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(timer);
      isOnCooldown = false;
      cooldownText.innerText = "Saad värvida!";
      cooldownText.style.color = "#2ecc71";
      if (hoveredX !== null && hoveredY !== null && localBoard[hoveredY]) {
        drawPixel(hoveredX, hoveredY, localBoard[hoveredY][hoveredX]);
        drawHover(hoveredX, hoveredY);
      }
    } else {
      cooldownText.innerText = `Oota ${timeLeft} s...`;
    }
  }, 1000);
}

recenterBtn.addEventListener("click", () => {
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  // 1. Määrame sobiva suumi, et laud mahuks ekraanile (nt 80% ekraani kõrgusest)
  targetScale = (window.innerHeight * 0.8) / canvasHeight;

  // 2. Arvutame koordinaadid nii, et laua keskpunkt jääks ekraani keskele
  // Valem: (Ekraani laius / 2) - (Laua poolik laius suumituna)
  targetPanX = window.innerWidth / 2 - (canvasWidth * targetScale) / 2;
  targetPanY = window.innerHeight / 2 - (canvasHeight * targetScale) / 2;
});

// Kutsume seda funktsiooni kohe ka lehe laadimisel,
// et mäng algaks alati ilusasti keskelt!
window.addEventListener("load", () => {
  recenterBtn.click();
  // See "klikkab" automaatselt nuppu, kui leht on laetud
});