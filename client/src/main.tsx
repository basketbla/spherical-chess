import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import PieceDebug from './three/PieceDebug';

// Lighting/material tuner: open with ?debug=piece
const isPieceDebug = new URLSearchParams(window.location.search).get('debug') === 'piece';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isPieceDebug ? <PieceDebug /> : <App />}
  </React.StrictMode>
);
