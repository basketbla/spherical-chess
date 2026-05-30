import React from 'react';
import ReactDOM from 'react-dom/client';
import './ui/ui.css';
import App from './App';
import PieceDebug from './three/PieceDebug';
import BoardDebug from './three/BoardDebug';

// Tuners: ?debug=piece (piece material/light) or ?debug=board (board surface/light)
const debug = new URLSearchParams(window.location.search).get('debug');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {debug === 'piece' ? <PieceDebug /> : debug === 'board' ? <BoardDebug /> : <App />}
  </React.StrictMode>
);
