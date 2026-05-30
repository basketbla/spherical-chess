import React from 'react';

const VIDEO_EMBED = 'https://www.youtube.com/embed/pWYt348Ki5g';

/** Full-screen, scrollable rules page. Content mirrors docs/rules.md (which is
 *  authoritative for this implementation), with the explainer video embedded. */
export default function Rules({ onClose }: { onClose: () => void }) {
  return (
    <div className="rules-root">
      <div className="rules-stage">
        <div className="rules-topbar">
          <button className="btn btn--outline btn--sm" onClick={onClose}>← Back</button>
          <h1 className="rules-title">How to Play</h1>
          <span style={{ width: 64 }} />
        </div>

        <p className="rules-lead">
          Spherical Chess is ordinary chess on a board wrapped onto a sphere. Every
          standard rule applies — the twist is how the edges connect.
        </p>

        <div className="rules-video">
          <iframe
            src={VIDEO_EMBED}
            title="How to play Spherical Chess"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        <section className="rules-section">
          <h2>The board wraps</h2>
          <h3>Files (left–right)</h3>
          <p>
            The a-file and h-file are joined into a cylinder. Move right off the
            h-file and you arrive on the a-file; move left off a and you reach h.
            This applies to every piece and every path.
          </p>
          <h3>Poles (top–bottom)</h3>
          <p>
            The top and bottom edges connect through <em>poles</em>, with a half-turn
            twist: stepping off the board shifts you <strong>4 files over</strong> and
            reverses your direction of travel.
          </p>
          <ul>
            <li>North pole (past rank 8): a8↔e8, b8↔f8, c8↔g8, d8↔h8</li>
            <li>South pole (past rank 1): a1↔e1, b1↔f1, c1↔g1, d1↔h1</li>
          </ul>
          <p className="rules-note">
            Example: a rook on a8 sliding “north” crosses the pole and continues
            south down the e-file — e8, e7, e6…
          </p>
        </section>

        <section className="rules-section">
          <h2>How the pieces move</h2>
          <ul>
            <li><strong>Rook / Bishop / Queen</strong> — slide as normal, but their lines run through the file seam and across the poles.</li>
            <li><strong>Knight</strong> — its L-jump lands on the wrapped square, so it keeps full mobility everywhere (no edge or corner penalty).</li>
            <li><strong>King</strong> — one square in any direction, with wrapping. Castling is normal and stays on the back rank (no pole wrap).</li>
            <li><strong>Pawn</strong> — moves forward with file wrapping and captures across the seam. Pawns do <em>not</em> wrap through the poles: reaching the far rank promotes as usual.</li>
          </ul>
        </section>

        <section className="rules-section">
          <h2>Special rules</h2>
          <ul>
            <li><strong>Castling</strong> — standard: king and rook unmoved, squares between empty, and the king may not start in, pass through, or land in check.</li>
            <li><strong>En passant</strong> — works as normal, including across the file seam (a pawn on the h-file can be captured by one on the a-file, and vice versa).</li>
            <li><strong>Promotion</strong> — a pawn reaching the opponent’s back rank promotes.</li>
            <li><strong>Check &amp; checkmate</strong> — standard, but checks can arrive through the seam and the poles, so watch your back rank.</li>
            <li><strong>Draws</strong> — stalemate and the 50-move rule. (Threefold repetition isn’t enforced yet.)</li>
          </ul>
        </section>

        <section className="rules-section">
          <h2>What changes strategically</h2>
          <ul>
            <li><strong>No safe edges.</strong> Every square has a full set of neighbors — there are no corners to hide in.</li>
            <li><strong>Bishops roam farther,</strong> reaching squares through the poles that a flat board would wall off.</li>
            <li><strong>Files are circular,</strong> so a rook’s file wraps all the way around.</li>
            <li><strong>Your back rank is exposed from behind,</strong> since the poles connect the far ranks.</li>
          </ul>
        </section>

        <div className="rules-footer">
          <button className="btn btn--primary" onClick={onClose}>Got it — back to menu</button>
        </div>
      </div>

      <style>{`
        .rules-root {
          position: absolute; inset: 0; z-index: 200;
          overflow-y: auto;
          color: #ece6d8;
          background-color: #15130f;
          background-image: radial-gradient(120% 120% at 50% 0%, rgba(201,167,106,0.06) 0%, transparent 55%);
        }
        .rules-stage { max-width: 720px; margin: 0 auto; padding: 28px 24px 60px; }
        .rules-topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
        .rules-title {
          font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 600;
          font-size: clamp(28px, 6vw, 40px); color: #f3eee2; margin: 0; text-align: center;
        }
        .rules-lead { color: #b8ae99; font-size: 16px; line-height: 1.6; margin: 4px 0 22px; text-align: center; }
        .rules-video {
          position: relative; width: 100%; padding-top: 56.25%;
          border-radius: 6px; overflow: hidden; margin-bottom: 28px;
          border: 1px solid rgba(236,230,216,0.12); background: #000;
        }
        .rules-video iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
        .rules-section { margin-bottom: 28px; }
        .rules-section h2 {
          font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 600;
          font-size: 26px; color: #f0dcb0; margin: 0 0 12px; border-bottom: 1px solid rgba(236,230,216,0.12); padding-bottom: 6px;
        }
        .rules-section h3 { font-size: 14px; letter-spacing: 0.4px; color: #d8c8a0; margin: 16px 0 6px; }
        .rules-section p { line-height: 1.65; color: #d4cbb8; margin: 0 0 10px; }
        .rules-section ul { margin: 0 0 10px; padding-left: 20px; }
        .rules-section li { line-height: 1.6; color: #d4cbb8; margin-bottom: 7px; }
        .rules-section strong { color: #f3eee2; }
        .rules-note {
          font-size: 14px; color: #b8ae99; font-style: italic;
          border-left: 2px solid rgba(201,167,106,0.5); padding-left: 12px; margin-top: 12px;
        }
        .rules-footer { text-align: center; margin-top: 32px; }
      `}</style>
    </div>
  );
}
