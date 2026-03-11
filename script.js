const KANOODLE_PIECES = [
  { id: 'A', color: 'color-A', shape: [[1, 1, 1], [1, 1, 0]] }, // P-pentomino (5)
  { id: 'B', color: 'color-B', shape: [[1, 1, 1], [1, 0, 0], [1, 0, 0]] }, // V-pentomino (5)
  { id: 'C', color: 'color-C', shape: [[1, 1, 1, 1], [1, 0, 0, 0]] }, // L-pentomino (5)
  { id: 'D', color: 'color-D', shape: [[1, 1, 1, 1], [0, 1, 0, 0]] }, // Y-pentomino (5)
  { id: 'E', color: 'color-E', shape: [[1, 1, 0], [0, 1, 1], [0, 0, 1]] }, // W-pentomino (5)
  { id: 'F', color: 'color-F', shape: [[1, 0, 1], [1, 1, 1]] }, // U-pentomino (5)
  { id: 'G', color: 'color-G', shape: [[0, 1, 1], [1, 1, 0], [0, 1, 0]] }, // F-pentomino (5)
  { id: 'H', color: 'color-H', shape: [[1, 1, 1, 0], [0, 0, 1, 1]] }, // N-pentomino (5)
  { id: 'I', color: 'color-I', shape: [[1, 1, 1], [1, 0, 0]] }, // L-tetromino (4)
  { id: 'J', color: 'color-J', shape: [[1, 1, 1], [0, 1, 0]] }, // T-tetromino (4)
  { id: 'K', color: 'color-K', shape: [[1, 1], [1, 1]] }, // O-tetromino (4)
  { id: 'L', color: 'color-L', shape: [[1, 1], [1, 0]] } // V-tromino (3)
];

const BOARD_ROWS = 5;
const BOARD_COLS = 11;
let boardState = Array(BOARD_ROWS).fill(null).map(() => Array(BOARD_COLS).fill(null));

// DOM Elements
const boardContainer = document.getElementById('board-container');
const piecesContainer = document.getElementById('pieces-container');
const winOverlay = document.getElementById('win-overlay');
const gameOverOverlay = document.getElementById('game-over-overlay');
const resetBtn = document.getElementById('reset-btn');
const playAgainBtn = document.getElementById('next-level-btn');
const tryAgainBtn = document.getElementById('try-again-btn');
const quitBtn = document.getElementById('quit-btn');
const headerRetryBtn = document.getElementById('header-retry-btn');
const timerEl = document.getElementById('timer');

// State
let pieces = [];
let draggingPiece = null;
let dragOffset = { x: 0, y: 0 };
let hoverCells = [];

// Timer state
let timeLeft = 60;
let timerInterval = null;
let isGameOver = false;

// Initialize Game
function init() {
  createBoard();
  createPieces();
  bindEvents();
  startTimer(true);
}

function startTimer(isFirstLoad = false) {
  clearInterval(timerInterval);
  isGameOver = false;
  timeLeft = 120; // 2 minutes
  updateTimerDisplay();
  timerEl.classList.remove('warning');
  
  if (!isFirstLoad) {
      playSound('drop');
  }

  timerInterval = setInterval(() => {
      if (isGameOver) {
          clearInterval(timerInterval);
          return;
      }
      
      timeLeft--;
      updateTimerDisplay();
      
      if (timeLeft <= 10) {
          timerEl.classList.add('warning');
      }
      
      if (timeLeft <= 0) {
          endGameLost();
      }
  }, 1000);
}

function updateTimerDisplay() {
  const min = Math.floor(timeLeft / 60);
  const sec = timeLeft % 60;
  timerEl.textContent = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

function endGameLost() {
  isGameOver = true;
  clearInterval(timerInterval);
  gameOverOverlay.classList.remove('hidden');
  
  // Return any dragging piece
  if (draggingPiece) {
      returnToInventory(draggingPiece);
      draggingPiece.el.classList.remove('dragging');
      draggingPiece = null;
      clearHovers();
      
      document.body.removeEventListener('mousemove', handleDragMove);
      document.body.removeEventListener('touchmove', handleDragMove);
      document.body.removeEventListener('mouseup', handleDragEnd);
      document.body.removeEventListener('touchend', handleDragEnd);
  }
}

function createBoard() {
  boardContainer.innerHTML = '';
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const cell = document.createElement('div');
      cell.classList.add('board-cell');
      cell.dataset.r = r;
      cell.dataset.c = c;
      boardContainer.appendChild(cell);
    }
  }
}

function createPieces() {
  piecesContainer.innerHTML = '';
  pieces = [];
  
  KANOODLE_PIECES.forEach((pieceData) => {
    const piece = createPieceElement(pieceData);
    piecesContainer.appendChild(piece);
    pieces.push({
      el: piece,
      data: pieceData,
      currentShape: [...pieceData.shape.map(r => [...r])],
      placedPos: null
    });
  });
}

function createPieceElement(pieceData, layout = pieceData.shape) {
  const piece = document.createElement('div');
  piece.classList.add('piece', pieceData.color);
  piece.dataset.id = pieceData.id;
  
  updatePieceDOM(piece, layout);
  
  // Drag Events
  piece.addEventListener('mousedown', handleDragStart);
  piece.addEventListener('touchstart', handleDragStart, {passive: false});
  
  // Double click to flip
  piece.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (!piece.classList.contains('placed')) rotatePiece(pieceData.id);
  });
  piece.addEventListener('dblclick', (e) => {
    e.preventDefault();
    if (!piece.classList.contains('placed')) flipPiece(pieceData.id);
  });
  
  return piece;
}

function updatePieceDOM(piece, layout) {
  piece.innerHTML = '';
  const rows = layout.length;
  const cols = layout[0].length;
  
  piece.style.gridTemplateColumns = `repeat(${cols}, var(--bead-size))`;
  piece.style.gridTemplateRows = `repeat(${rows}, var(--bead-size))`;
  piece.style.width = `calc(${cols} * var(--bead-size) + ${cols - 1} * var(--grid-gap))`;
  piece.style.height = `calc(${rows} * var(--bead-size) + ${rows - 1} * var(--grid-gap))`;
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const bead = document.createElement('div');
      bead.classList.add('bead');
      if (layout[r][c] === 0) bead.classList.add('empty');
      piece.appendChild(bead);
    }
  }
}

function rotatePiece(id, skipAnimation = false) {
  const p = pieces.find(x => x.data.id === id);
  if (!p) return;
  
  // Rotate 90 degrees clockwise
  const rows = p.currentShape.length;
  const cols = p.currentShape[0].length;
  const newShape = Array(cols).fill(0).map(() => Array(rows).fill(0));
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      newShape[c][rows - 1 - r] = p.currentShape[r][c];
    }
  }
  
  p.currentShape = newShape;
  updatePieceDOM(p.el, newShape);
  
  // Add quick animation
  if (!skipAnimation) {
      p.el.style.transform = 'scale(1.1) rotate(5deg)';
      setTimeout(() => { p.el.style.transform = ''; }, 100);
  }
}

function flipPiece(id, skipAnimation = false) {
  const p = pieces.find(x => x.data.id === id);
  if (!p) return;
  
  // Flip horizontally
  const rows = p.currentShape.length;
  const cols = p.currentShape[0].length;
  const newShape = Array(rows).fill(0).map(() => Array(cols).fill(0));
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      newShape[r][cols - 1 - c] = p.currentShape[r][c];
    }
  }
  
  p.currentShape = newShape;
  updatePieceDOM(p.el, newShape);
  
  // Add quick animation
  if (!skipAnimation) {
      p.el.style.transform = 'scale(1.1) scaleX(-1)';
      setTimeout(() => { p.el.style.transform = ''; }, 100);
  }
}

// Drag functionality
function handleDragStart(e) {
  if (e.button === 2) return; // ignore right click
  if (isGameOver) return;
  
  const pieceEl = e.currentTarget;
  const id = pieceEl.dataset.id;
  const p = pieces.find(x => x.data.id === id);
  
  // If piece was placed, remove it from board
  if (p.placedPos) {
    removeFromBoard(p);
  }
  
  // Get rect BEFORE detaching from container so offsets are perfect
  const rect = p.el.getBoundingClientRect();
  const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
  const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
  
  dragOffset.x = clientX - rect.left;
  dragOffset.y = clientY - rect.top;
  
  draggingPiece = p;
  p.el.classList.add('dragging');
  p.el.classList.remove('placed');
  
  // Lift into body to freely move
  document.body.appendChild(p.el);
  
  movePiece(clientX, clientY);
  
  document.body.addEventListener('mousemove', handleDragMove);
  document.body.addEventListener('touchmove', handleDragMove, {passive: false});
  document.body.addEventListener('mouseup', handleDragEnd);
  document.body.addEventListener('touchend', handleDragEnd);
}

function handleDragMove(e) {
  if (!draggingPiece) return;
  e.preventDefault();
  
  const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
  const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
  
  movePiece(clientX, clientY);
  checkHover(clientX, clientY);
}

function movePiece(x, y) {
  if (!draggingPiece) return;
  draggingPiece.el.style.left = `${x - dragOffset.x}px`;
  draggingPiece.el.style.top = `${y - dragOffset.y}px`;
  draggingPiece.el.style.position = 'absolute';
}

function checkHover(x, y) {
  clearHovers();
  if (!draggingPiece) return;
  
  const slot = getBoardSlotFromPos(x - dragOffset.x, y - dragOffset.y);
  if (slot) {
    const valid = canPlacePiece(draggingPiece, slot.r, slot.c);
    highlightCells(draggingPiece, slot.r, slot.c, valid);
  }
}

function handleDragEnd(e) {
  if (!draggingPiece) return;
  
  const clientX = e.type.includes('touch') ? e.changedTouches[0].clientX : e.clientX;
  const clientY = e.type.includes('touch') ? e.changedTouches[0].clientY : e.clientY;
  
  const p = draggingPiece;
  const slot = getBoardSlotFromPos(clientX - dragOffset.x, clientY - dragOffset.y);
  
  if (slot && canPlacePiece(p, slot.r, slot.c)) {
    placeOnBoard(p, slot.r, slot.c);
  } else {
    // Return to inventory
    returnToInventory(p);
  }
  
  p.el.classList.remove('dragging');
  draggingPiece = null;
  clearHovers();
  
  checkWin();
  
  document.body.removeEventListener('mousemove', handleDragMove);
  document.body.removeEventListener('touchmove', handleDragMove);
  document.body.removeEventListener('mouseup', handleDragEnd);
  document.body.removeEventListener('touchend', handleDragEnd);
}

function getBoardSlotFromPos(px, py) {
  const boardRect = boardContainer.getBoundingClientRect();
  const firstCell = getCellAt(0, 0);
  if (!firstCell) return null;
  const firstCellRect = firstCell.getBoundingClientRect();
  
  const beadW = firstCellRect.width;
  const beadH = firstCellRect.height;
  const gap = 2; // match var(--grid-gap)
  
  // Center of the dragging piece
  const pieceW = draggingPiece.currentShape[0].length * beadW + (draggingPiece.currentShape[0].length - 1) * gap;
  const pieceH = draggingPiece.currentShape.length * beadH + (draggingPiece.currentShape.length - 1) * gap;
  
  const center_px = px + pieceW / 2;
  const center_py = py + pieceH / 2;
  
  // Allow drop if center of piece is within board container
  if (center_px >= boardRect.left - 20 && center_px <= boardRect.right + 20 &&
      center_py >= boardRect.top - 20 && center_py <= boardRect.bottom + 20) {
      
      // Calculate row/col relative to the first actual cell, not the padding edge!
      const relX = px - firstCellRect.left;
      const relY = py - firstCellRect.top;
      
      // Round to nearest slot factoring in gap
      const c = Math.round(relX / (beadW + gap));
      const r = Math.round(relY / (beadH + gap));
      
      return { r, c };
  }
  return null;
}

function canPlacePiece(piece, startR, startC) {
  const shape = piece.currentShape;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[0].length; c++) {
      if (shape[r][c] === 1) {
        const boardR = startR + r;
        const boardC = startC + c;
        if (boardR < 0 || boardR >= BOARD_ROWS || boardC < 0 || boardC >= BOARD_COLS) {
          return false;
        }
        if (boardState[boardR][boardC] !== null) {
          return false;
        }
      }
    }
  }
  return true;
}

function highlightCells(piece, startR, startC, isValid) {
  const shape = piece.currentShape;
  const className = isValid ? 'hover-valid' : 'hover-invalid';
  
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[0].length; c++) {
      if (shape[r][c] === 1) {
        const boardR = startR + r;
        const boardC = startC + c;
        if (boardR >= 0 && boardR < BOARD_ROWS && boardC >= 0 && boardC < BOARD_COLS) {
          const cell = getCellAt(boardR, boardC);
          if (cell) {
            cell.classList.add(className);
            hoverCells.push(cell);
          }
        }
      }
    }
  }
}

function clearHovers() {
  hoverCells.forEach(cell => {
    cell.classList.remove('hover-valid', 'hover-invalid');
  });
  hoverCells = [];
}

function placeOnBoard(piece, r, c, skipSound = false) {
  piece.placedPos = { r, c };
  piece.el.classList.add('placed');
  
  // Snap to grid geometry
  const targetCell = getCellAt(r, c);
  
  // Use relative positioning within the board container if we appending there
  boardContainer.appendChild(piece.el);
  
  piece.el.style.left = `${targetCell.offsetLeft}px`;
  piece.el.style.top = `${targetCell.offsetTop}px`;
  
  // Update state
  const shape = piece.currentShape;
  for (let pr = 0; pr < shape.length; pr++) {
    for (let pc = 0; pc < shape[0].length; pc++) {
      if (shape[pr][pc] === 1) {
        boardState[r + pr][c + pc] = piece.data.id;
      }
    }
  }
  
  if (!skipSound) playSound('drop');
}

function removeFromBoard(piece) {
  if (!piece.placedPos) return;
  const { r, c } = piece.placedPos;
  const shape = piece.currentShape;
  
  for (let pr = 0; pr < shape.length; pr++) {
    for (let pc = 0; pc < shape[0].length; pc++) {
      if (shape[pr][pc] === 1) {
        boardState[r + pr][c + pc] = null;
      }
    }
  }
  piece.placedPos = null;
}

function returnToInventory(piece) {
  piecesContainer.appendChild(piece.el);
  piece.el.style.position = '';
  piece.el.style.left = '';
  piece.el.style.top = '';
  piece.el.style.transform = '';
  piece.el.classList.remove('placed', 'dragging');
}

function getCellAt(r, c) {
  return boardContainer.children[r * BOARD_COLS + c];
}

function checkWin() {
  // Check if every cell is filled
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      if (boardState[r][c] === null) return;
    }
  }
  
  // Win condition met!
  isGameOver = true;
  clearInterval(timerInterval);
  playSound('win');
  setTimeout(() => {
    winOverlay.classList.remove('hidden');
  }, 500);
}

function playSound(type) {
  // We can use Web Audio API for simple synthetic sounds (optional)
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  if (type === 'drop') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } else if (type === 'win') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.setValueAtTime(554, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(659, ctx.currentTime + 0.2);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  }
}

function bindEvents() {
  resetBtn.addEventListener('click', () => {
    pieces.forEach(p => {
      if (p.placedPos) removeFromBoard(p);
      returnToInventory(p);
      // Reset rotation back to default safely
      while(JSON.stringify(p.currentShape) !== JSON.stringify(p.data.shape) && 
            JSON.stringify(p.currentShape) !== JSON.stringify([...p.data.shape].reverse())) {
          rotatePiece(p.data.id, true); // add true param to skip animation if we want
      }
      p.currentShape = [...p.data.shape.map(r => [...r])];
      updatePieceDOM(p.el, p.currentShape);
    });
    startTimer();
    placeRandomStartingPiece();
  });
  
  playAgainBtn.addEventListener('click', () => {
    winOverlay.classList.add('hidden');
    resetBtn.click();
  });

  tryAgainBtn.addEventListener('click', () => {
    gameOverOverlay.classList.add('hidden');
    resetBtn.click();
  });

  headerRetryBtn.addEventListener('click', () => {
    resetBtn.click();
  });
  
  quitBtn.addEventListener('click', () => {
    // Optionally redirect or show a thank you message
    gameOverOverlay.innerHTML = '<div class="win-content"><h2>THANKS FOR PLAYING!</h2></div>';
  });
  
  // Initial starting pieces logic
  placeRandomStartingPiece();
}

function placeRandomStartingPiece() {
  // Give the UI a tiny moment to render the board cells so we can calculate offsets
  setTimeout(() => {
    // Try to place a random piece in a random orientation somewhere
    // Shuffle pieces
    const available = pieces.filter(p => !p.placedPos);
    if (!available.length) return;
    
    // Pick random piece
    const p = available[Math.floor(Math.random() * available.length)];
    
    // Randomly rotate/flip it a few times 
    const randomRotations = Math.floor(Math.random() * 4);
    for(let i=0; i<randomRotations; i++) rotatePiece(p.data.id, true);
    if (Math.random() > 0.5) flipPiece(p.data.id, true);

    // Find a valid spot near the edge or random spot
    const spots = [];
    for(let r=0; r<BOARD_ROWS; r++) {
        for(let c=0; c<BOARD_COLS; c++) {
            if (canPlacePiece(p, r, c)) {
                spots.push({r, c});
            }
        }
    }

    if (spots.length) {
        const spot = spots[Math.floor(Math.random() * spots.length)];
        placeOnBoard(p, spot.r, spot.c, true);
    }
  }, 100);
}

// Start
init();
