import React, { useState } from 'react';
import Rules from './Rules';

interface LobbyProps {
  connected: boolean;
  onJoinQueue: (name: string) => void;
  onCreatePrivate: (name: string) => void;
  onJoinPrivate: (roomId: string, name: string) => void;
  onPlayLocal: () => void;
  error: string | null;
  onClearError: () => void;
}

const VIDEO_URL = 'https://www.youtube.com/watch?v=pWYt348Ki5g';

export default function Lobby({
  connected,
  onJoinQueue,
  onCreatePrivate,
  onJoinPrivate,
  onPlayLocal,
  error,
  onClearError,
}: LobbyProps) {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [tab, setTab] = useState<'quick' | 'private' | 'local'>('quick');
  const [inQueue, setInQueue] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const playerName = name.trim() || 'Player';

  const tabs = [
    { id: 'quick', label: 'Quick Match' },
    { id: 'private', label: 'Private' },
    { id: 'local', label: 'Local' },
  ] as const;

  return (
    <div className="lobby-root">
      <div className="lobby-stage">
        <header className="lobby-head">
          <div className="lobby-pieces" aria-hidden="true">♜&nbsp;♞&nbsp;♝&nbsp;♛&nbsp;♚&nbsp;♝&nbsp;♞&nbsp;♜</div>
          <h1 className="lobby-title">Spherical Chess</h1>
        </header>

        <div className="lobby-card">
          <div className={`lobby-status ${connected ? 'is-on' : 'is-off'}`}>
            <span className="lobby-dot" />
            {connected ? 'Connected to server' : 'Connecting…'}
          </div>

          <label className="lobby-field-label" htmlFor="lobby-name">Player name</label>
          <input
            id="lobby-name"
            type="text"
            className="lobby-input"
            placeholder="Anonymous"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="lobby-tabs" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className={`lobby-tab ${tab === t.id ? 'is-active' : ''}`}
                onClick={() => { setTab(t.id); setInQueue(false); }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="lobby-panel">
            {tab === 'quick' && (
              !inQueue ? (
                <button
                  className="lobby-btn lobby-btn--primary"
                  onClick={() => { setInQueue(true); onJoinQueue(playerName); }}
                  disabled={!connected}
                >
                  Find Opponent
                </button>
              ) : (
                <div className="lobby-searching">
                  <span className="lobby-spinner" />
                  <p>Searching for an opponent…</p>
                  <button className="lobby-btn lobby-btn--ghost" onClick={() => setInQueue(false)}>
                    Cancel
                  </button>
                </div>
              )
            )}

            {tab === 'private' && (
              <div className="lobby-stack">
                <button
                  className="lobby-btn lobby-btn--primary"
                  onClick={() => onCreatePrivate(playerName)}
                  disabled={!connected}
                >
                  Create Game
                </button>
                <div className="lobby-divider"><span>or join with a code</span></div>
                <div className="lobby-row">
                  <input
                    type="text"
                    className="lobby-input"
                    placeholder="Room code"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                  />
                  <button
                    className="lobby-btn lobby-btn--outline"
                    onClick={() => onJoinPrivate(roomCode.trim(), playerName)}
                    disabled={!connected || !roomCode.trim()}
                  >
                    Join
                  </button>
                </div>
              </div>
            )}

            {tab === 'local' && (
              <button className="lobby-btn lobby-btn--primary" onClick={onPlayLocal}>
                Play Locally · 2 Players
              </button>
            )}
          </div>

          {error && (
            <div className="lobby-error">
              <span>{error}</span>
              <button onClick={onClearError} aria-label="Dismiss">×</button>
            </div>
          )}
        </div>

        <div className="lobby-links">
          <button className="lobby-watch lobby-watch--btn" onClick={() => setShowRules(true)}>
            <span className="lobby-watch-icon">❔</span>
            How to play
          </button>
          <a className="lobby-watch" href={VIDEO_URL} target="_blank" rel="noopener noreferrer">
            <span className="lobby-watch-icon">▶</span>
            Watch the video
          </a>
        </div>
      </div>

      {showRules && <Rules onClose={() => setShowRules(false)} />}

      <style>{`
        .lobby-root {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          color: #ece6d8;
          background-color: #15130f;
          background-image:
            radial-gradient(120% 120% at 50% 0%, rgba(201,167,106,0.06) 0%, transparent 55%),
            repeating-conic-gradient(rgba(236,230,216,0.022) 0% 25%, transparent 0% 50%);
          background-size: auto, 64px 64px;
          overflow-y: auto;
        }
        .lobby-stage {
          width: 100%;
          max-width: 400px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .lobby-head {
          text-align: center;
          margin-bottom: 34px;
        }
        .lobby-pieces {
          font-size: 17px;
          color: rgba(201,167,106,0.55);
          letter-spacing: 2px;
          margin-bottom: 14px;
        }
        .lobby-title {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-weight: 600;
          font-size: clamp(40px, 9vw, 60px);
          line-height: 1;
          letter-spacing: 0.5px;
          color: #f3eee2;
          margin: 0;
        }
        .lobby-card {
          width: 100%;
          background: #1c1813;
          border: 1px solid rgba(236,230,216,0.1);
          border-radius: 4px;
          padding: 26px 24px 24px;
          box-shadow: 0 18px 50px rgba(0,0,0,0.45);
        }
        .lobby-status {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          letter-spacing: 1px;
          text-transform: uppercase;
          margin-bottom: 22px;
        }
        .lobby-status.is-on { color: #8aa06a; }
        .lobby-status.is-off { color: #b5713f; }
        .lobby-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: currentColor;
          box-shadow: 0 0 0 3px rgba(255,255,255,0.04);
        }
        .lobby-field-label {
          display: block;
          font-size: 11px;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: #7e7563;
          margin-bottom: 8px;
        }
        .lobby-input {
          width: 100%;
          padding: 11px 13px;
          border-radius: 3px;
          border: 1px solid rgba(236,230,216,0.14);
          background: #141009;
          color: #ece6d8;
          font-size: 15px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .lobby-input::placeholder { color: #5f5848; }
        .lobby-input:focus { border-color: rgba(201,167,106,0.7); }
        .lobby-tabs {
          display: flex;
          gap: 22px;
          margin: 24px 0 18px;
          border-bottom: 1px solid rgba(236,230,216,0.1);
        }
        .lobby-tab {
          appearance: none;
          background: none;
          border: none;
          padding: 0 0 10px;
          margin-bottom: -1px;
          cursor: pointer;
          font-family: inherit;
          font-size: 13px;
          letter-spacing: 0.4px;
          color: #7e7563;
          border-bottom: 2px solid transparent;
          transition: color 0.15s ease, border-color 0.15s ease;
        }
        .lobby-tab:hover { color: #c4bba6; }
        .lobby-tab.is-active {
          color: #f3eee2;
          border-bottom-color: #c9a76a;
        }
        .lobby-panel { min-height: 52px; }
        .lobby-stack { display: flex; flex-direction: column; gap: 14px; }
        .lobby-row { display: flex; gap: 8px; }
        .lobby-row .lobby-input { flex: 1; }
        .lobby-btn {
          appearance: none;
          font-family: inherit;
          font-size: 14px;
          letter-spacing: 0.5px;
          border-radius: 3px;
          padding: 12px 18px;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, opacity 0.15s ease;
          border: 1px solid transparent;
        }
        .lobby-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .lobby-btn--primary {
          width: 100%;
          background: #c9a76a;
          color: #1a150d;
          font-weight: 600;
          border-color: #c9a76a;
        }
        .lobby-btn--primary:not(:disabled):hover { background: #d8b87e; border-color: #d8b87e; }
        .lobby-btn--outline {
          background: transparent;
          color: #ece6d8;
          border-color: rgba(236,230,216,0.22);
          white-space: nowrap;
        }
        .lobby-btn--outline:not(:disabled):hover { border-color: rgba(201,167,106,0.7); color: #f3eee2; }
        .lobby-btn--ghost {
          background: transparent;
          color: #948a76;
          border-color: rgba(236,230,216,0.16);
          margin-top: 14px;
          padding: 8px 16px;
        }
        .lobby-btn--ghost:hover { color: #ece6d8; border-color: rgba(236,230,216,0.3); }
        .lobby-divider {
          display: flex;
          align-items: center;
          text-align: center;
          color: #6f6655;
          font-size: 11px;
          letter-spacing: 0.6px;
        }
        .lobby-divider::before,
        .lobby-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(236,230,216,0.1);
        }
        .lobby-divider span { padding: 0 12px; }
        .lobby-searching {
          text-align: center;
          padding: 6px 0;
        }
        .lobby-searching p {
          color: #948a76;
          font-size: 14px;
          margin: 0;
        }
        .lobby-spinner {
          display: block;
          width: 26px; height: 26px;
          margin: 0 auto 14px;
          border: 2px solid rgba(201,167,106,0.25);
          border-top-color: #c9a76a;
          border-radius: 50%;
          animation: lobby-spin 0.9s linear infinite;
        }
        .lobby-error {
          margin-top: 16px;
          padding: 10px 14px;
          border-radius: 3px;
          background: rgba(181,113,63,0.12);
          border: 1px solid rgba(181,113,63,0.35);
          color: #d99868;
          font-size: 13px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .lobby-error button {
          background: none; border: none; color: inherit;
          cursor: pointer; font-size: 18px; line-height: 1;
        }
        .lobby-watch {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 26px;
          color: #948a76;
          text-decoration: none;
          font-size: 13px;
          letter-spacing: 0.4px;
          border-bottom: 1px solid transparent;
          padding-bottom: 2px;
          transition: color 0.15s ease, border-color 0.15s ease;
        }
        .lobby-watch:hover { color: #ece6d8; border-bottom-color: rgba(201,167,106,0.6); }
        .lobby-watch-icon { font-size: 10px; color: #c9a76a; }
        .lobby-links { display: flex; gap: 26px; margin-top: 26px; }
        .lobby-links .lobby-watch { margin-top: 0; }
        .lobby-watch--btn {
          appearance: none; background: none; border: none; padding-bottom: 2px;
          cursor: pointer; font-family: inherit;
        }
        @keyframes lobby-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
