import React from 'react';
import { RotateCcw, X } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';
import { useApp } from '../../context/AppContext';
import { GAMES } from '../../games/engine';
import { burstHearts } from '../../components/HeartCanvas';

const RPS = { rock: '✊', paper: '✋', scissors: '✌️' };

function TicTacToe({ s, canMove, onMove }) {
  return <div className="ttt">{s.board.map((c, i) => <button key={i} disabled={!canMove || Boolean(c)} className={`cell ${c} ${s.line?.includes(i) ? 'win' : ''}`} onClick={() => onMove(i)} aria-label={`Cell ${i + 1}`}>{c}</button>)}</div>;
}
function Connect4({ s, canMove, onMove }) {
  return <div className="c4">{Array.from({ length: 7 }, (_, c) => <button key={c} className="c4-col" disabled={!canMove || s.board[0][c] !== null} onClick={() => onMove(c)} aria-label={`Drop in column ${c + 1}`}>
    {s.board.map((row, r) => <i key={r} className={`disc ${row[c] === null ? '' : row[c] === 0 ? 'p0' : 'p1'} ${s.line?.some(([rr, cc]) => rr === r && cc === c) ? 'win' : ''}`} />)}</button>)}</div>;
}
function Rps({ s, seat, canMove, onMove }) {
  const mine = seat >= 0 ? s.picks[seat] : null;
  return <div className="stack center">
    <div className="rps-score"><span>{s.score[0]}</span><small>Round {Math.min(s.round, 5)}</small><span>{s.score[1]}</span></div>
    {s.last && <p className="muted">Last round: {RPS[s.last.picks[0]]} vs {RPS[s.last.picks[1]]} — {s.last.res === 0 ? 'draw' : s.last.res === 1 ? 'Player 1 wins' : 'Player 2 wins'}</p>}
    <div className="row center">{Object.entries(RPS).map(([k, e]) => <button key={k} className={`rps-btn ${mine === k ? 'picked' : ''}`} disabled={!canMove || Boolean(mine)} onClick={() => onMove(k)} aria-label={k}>{e}</button>)}</div>
    <p className="muted">{mine ? 'Locked in — waiting for the other player…' : 'Pick one. Both picks reveal together.'}</p>
  </div>;
}

function Board({ game }) {
  const { playMove, takeSeat, rematch, closeGame, isHost } = useRoom();
  const { uid } = useApp();
  const { type, seats, state } = game;
  const seat = seats.findIndex(x => x?.id === uid);
  const full = seats.every(Boolean);
  const over = state.winner !== null && state.winner !== undefined || state.draw;
  const myTurn = type === 'rps' ? seat >= 0 : seat >= 0 && state.turn === seat;
  const canMove = full && !over && myTurn;
  const mark = i => type === 'tictactoe' ? (i === 0 ? '❌' : '⭕') : type === 'connect4' ? (i === 0 ? '🔴' : '🟡') : i === 0 ? 'P1' : 'P2';

  let status;
  if (!full) status = 'Waiting for two players to take a seat…';
  else if (over) status = state.draw ? 'It’s a draw!' : `${seats[state.winner].name} wins! 🎉`;
  else if (type === 'rps') status = 'Make your pick';
  else status = state.turn === seat ? 'Your turn' : `${seats[state.turn].name}’s turn`;

  React.useEffect(() => { if (over && !state.draw && seat === state.winner) burstHearts({ n: 80 }); }, [over]); // eslint-disable-line react-hooks/exhaustive-deps

  return <section className="glass panel game-board">
    <div className="section-head tight"><div><span className="eyebrow">{GAMES[type].emoji}</span><h2>{GAMES[type].name}</h2></div>
      <div className="row tight">{(isHost || seat >= 0) && <button className="btn ghost sm" onClick={rematch}><RotateCcw size={14}/> Rematch</button>}{(isHost || seat >= 0) && <button className="btn ghost sm" onClick={closeGame}><X size={14}/> Close</button>}</div></div>
    <div className="seats">{[0, 1].map(i => <div key={i} className={`seat ${state.turn === i && full && !over && type !== 'rps' ? 'active' : ''}`}>
      <span>{mark(i)}</span>{seats[i] ? <b>{seats[i].name}{seats[i].id === uid ? ' (you)' : ''}</b> : <button className="btn primary sm" disabled={seat >= 0} onClick={() => takeSeat(i)}>Sit here</button>}</div>)}</div>
    <p className={`game-status ${over ? 'over' : ''}`}>{status}</p>
    {full && type === 'tictactoe' && <TicTacToe s={state} canMove={canMove} onMove={playMove} />}
    {full && type === 'connect4' && <Connect4 s={state} canMove={canMove} onMove={playMove} />}
    {full && type === 'rps' && <Rps s={state} seat={seat} canMove={canMove} onMove={playMove} />}
    {seat < 0 && full && <p className="muted center-text">You’re watching — rematch to get a seat if one frees up.</p>}
  </section>;
}

export default function GamesPage() {
  const { game, startGame } = useRoom();
  return <div className="stack gap">
    {game && <Board game={game} />}
    <section className="glass panel stack">
      <div><span className="eyebrow">Arcade</span><h2>{game ? 'Switch game' : 'Pick a game'}</h2></div>
      <div className="grid3">{Object.values(GAMES).map(g => <button key={g.id} className={`game-card ${game?.type === g.id ? 'on' : ''}`} onClick={() => (!game || window.confirm('Replace the current game for everyone?')) && startGame(g.id)}>
        <span className="game-emoji">{g.emoji}</span><b>{g.name}</b><span className="muted">{g.blurb}</span></button>)}</div>
      <p className="muted small">Everyone in the room sees the same board live. Music or video keeps playing in the mini player.</p>
    </section>
  </div>;
}
