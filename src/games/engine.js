// Pure game logic (no React) so it is easy to test. Each game: init(), move(state, move, seat) -> new state | null.
export const GAMES = {
  tictactoe: { id: 'tictactoe', name: 'Tic-Tac-Toe', emoji: '❌⭕', seats: 2, blurb: 'Classic 3×3. First to three in a row.' },
  connect4: { id: 'connect4', name: 'Connect Four', emoji: '🔴🟡', seats: 2, blurb: 'Drop discs, line up four.' },
  rps: { id: 'rps', name: 'Rock Paper Scissors', emoji: '✊✋✌️', seats: 2, blurb: 'Best of five. Picks reveal together.' },
};

const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

export function initGame(type) {
  if (type === 'tictactoe') return { type, board: Array(9).fill(''), turn: 0, winner: null, line: null, draw: false };
  if (type === 'connect4') return { type, board: Array.from({ length: 6 }, () => Array(7).fill(null)), turn: 0, winner: null, line: null, draw: false };
  if (type === 'rps') return { type, picks: [null, null], score: [0, 0], round: 1, last: null, winner: null };
  throw new Error('Unknown game ' + type);
}

export function tttWinner(board) {
  for (const l of LINES) { const [a, b, c] = l; if (board[a] && board[a] === board[b] && board[a] === board[c]) return { mark: board[a], line: l }; }
  return null;
}

export function c4Winner(board) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
    const v = board[r][c]; if (v === null) continue;
    for (const [dr, dc] of dirs) {
      const cells = [[r, c]];
      for (let k = 1; k < 4; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr > 5 || cc < 0 || cc > 6 || board[rr][cc] !== v) break; cells.push([rr, cc]); }
      if (cells.length === 4) return { seat: v, line: cells };
    }
  }
  return null;
}

export function rpsBeats(a, b) { return a === b ? 0 : (a === 'rock' && b === 'scissors') || (a === 'paper' && b === 'rock') || (a === 'scissors' && b === 'paper') ? 1 : -1; }

export function applyMove(state, move, seat) {
  if (!state || seat == null) return null;
  if (state.type === 'tictactoe') {
    if (state.winner !== null || state.draw || state.turn !== seat || state.board[move]) return null;
    const board = state.board.slice(); board[move] = seat === 0 ? 'X' : 'O';
    const w = tttWinner(board);
    return { ...state, board, turn: 1 - seat, winner: w ? seat : null, line: w?.line || null, draw: !w && board.every(Boolean) };
  }
  if (state.type === 'connect4') {
    if (state.winner !== null || state.draw || state.turn !== seat || move < 0 || move > 6) return null;
    let row = -1; for (let r = 5; r >= 0; r--) if (state.board[r][move] === null) { row = r; break; }
    if (row < 0) return null;
    const board = state.board.map(r => r.slice()); board[row][move] = seat;
    const w = c4Winner(board);
    return { ...state, board, turn: 1 - seat, winner: w ? seat : null, line: w?.line || null, draw: !w && board[0].every(v => v !== null) };
  }
  if (state.type === 'rps') {
    if (state.winner !== null || state.picks[seat]) return null;
    const picks = state.picks.slice(); picks[seat] = move;
    if (!picks[0] || !picks[1]) return { ...state, picks };
    const res = rpsBeats(picks[0], picks[1]); const score = state.score.slice();
    if (res === 1) score[0]++; else if (res === -1) score[1]++;
    const winner = score[0] >= 3 ? 0 : score[1] >= 3 ? 1 : null;
    return { ...state, picks: [null, null], score, round: state.round + 1, last: { picks, res }, winner };
  }
  return null;
}
