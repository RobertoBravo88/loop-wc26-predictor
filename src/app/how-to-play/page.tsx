import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'How to Play — Loop WC26 Predictor',
  description: 'Learn how to earn points in the Loop WC26 Predictor competition.',
}

const serif = "'Playfair Display', Georgia, serif"
const sans = 'Inter, sans-serif'

export default function HowToPlayPage() {
  return (
    <div style={{ background: '#f7f4ef' }} className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Page header */}
        <div className="mb-10 pb-3" style={{ borderBottom: '3px solid #141414' }}>
          <h1
            className="text-4xl sm:text-5xl"
            style={{ fontFamily: serif, fontWeight: 900, color: '#141414', lineHeight: 1.1 }}
          >
            How to Play
          </h1>
          <p className="mt-2 text-sm" style={{ fontFamily: sans, color: '#6b6b6b' }}>
            Everything you need to know about scoring points in the Loop WC26 Predictor.
          </p>
        </div>

        <div className="space-y-10">

          {/* Section 1 — Match Predictions */}
          <section style={{ borderLeft: '3px solid #e0dbd3', paddingLeft: '1rem' }}>
            <h2
              className="text-xl mb-1 pb-2"
              style={{ fontFamily: serif, fontWeight: 700, color: '#141414', borderBottom: '1px solid #e0dbd3' }}
            >
              Match Predictions
            </h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ fontFamily: sans, color: '#141414' }}>
              Predict the exact score of any match before kick-off. Every prediction is locked the moment the match starts — you can edit freely right up until kick-off.
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed" style={{ fontFamily: sans, color: '#141414' }}>
              <li>
                <span style={{ color: '#ff5c35', fontWeight: 700 }}>100 points</span>
                {' '}— Exact score (you nailed it perfectly)
              </li>
              <li>
                <span style={{ color: '#ff5c35', fontWeight: 700 }}>50 points</span>
                {' '}— Correct outcome (right winner or draw, wrong score)
              </li>
              <li>
                <span style={{ color: '#141414', fontWeight: 700 }}>0 points</span>
                {' '}— Wrong prediction
              </li>
            </ul>
          </section>

          {/* Section 2 — Hot Streak Bonus */}
          <section style={{ borderLeft: '3px solid #e0dbd3', paddingLeft: '1rem' }}>
            <h2
              className="text-xl mb-1 pb-2"
              style={{ fontFamily: serif, fontWeight: 700, color: '#141414', borderBottom: '1px solid #e0dbd3' }}
            >
              Hot Streak Bonus 🔥
            </h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ fontFamily: sans, color: '#141414' }}>
              Chain together exact scores and you&apos;ll unlock a streak multiplier.
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed" style={{ fontFamily: sans, color: '#141414' }}>
              <li>Get <span style={{ fontWeight: 700 }}>3 or more exact scores in a row</span> to activate your streak.</li>
              <li>
                From the 3rd consecutive exact score onwards:{' '}
                <span style={{ color: '#ff5c35', fontWeight: 700 }}>+50 bonus points</span> per match on top of the regular 100.
              </li>
              <li>Streak resets the moment you don&apos;t get an exact score.</li>
              <li>Your active streak is visible on the leaderboard with a <span style={{ fontWeight: 700 }}>🔥 badge</span>.</li>
            </ul>
          </section>

          {/* Section 3 — Loop Crystal Ball */}
          <section style={{ borderLeft: '3px solid #e0dbd3', paddingLeft: '1rem' }}>
            <h2
              className="text-xl mb-1 pb-2"
              style={{ fontFamily: serif, fontWeight: 700, color: '#141414', borderBottom: '1px solid #e0dbd3' }}
            >
              🔮 Loop Crystal Ball
            </h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ fontFamily: sans, color: '#141414' }}>
              Who lifts the trophy in July? Pick the top three finishers before the tournament kicks off on{' '}
              <span style={{ fontWeight: 700 }}>June 11, 2026</span>. These picks lock at tournament start and cannot be changed.
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed" style={{ fontFamily: sans, color: '#141414' }}>
              <li>
                <span style={{ color: '#ff5c35', fontWeight: 700 }}>300 points</span>
                {' '}— World Cup winner
              </li>
              <li>
                <span style={{ color: '#ff5c35', fontWeight: 700 }}>200 points</span>
                {' '}— Runner-up
              </li>
              <li>
                <span style={{ color: '#ff5c35', fontWeight: 700 }}>100 points</span>
                {' '}— 3rd place
              </li>
            </ul>
          </section>

          {/* Section 4 — Loop's Golden Boots */}
          <section style={{ borderLeft: '3px solid #e0dbd3', paddingLeft: '1rem' }}>
            <h2
              className="text-xl mb-1 pb-2"
              style={{ fontFamily: serif, fontWeight: 700, color: '#141414', borderBottom: '1px solid #e0dbd3' }}
            >
              👟 Loop&apos;s Golden Boots
            </h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ fontFamily: sans, color: '#141414' }}>
              Five strikers. One country each. Every goal counts. Pick up to 5 players before the tournament starts — one per country maximum. Every goal your chosen players score earns you points.
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed" style={{ fontFamily: sans, color: '#141414' }}>
              <li>
                <span style={{ color: '#ff5c35', fontWeight: 700 }}>+10 points</span>
                {' '}per goal scored by each of your chosen players
              </li>
              <li>Pick up to <span style={{ fontWeight: 700 }}>5 players</span> — one per country max</li>
              <li>Locks when the tournament starts on <span style={{ fontWeight: 700 }}>June 11, 2026</span>.</li>
            </ul>
          </section>

          {/* Section 5 — Secret Bonuses */}
          <section style={{ borderLeft: '3px solid #ff5c35', paddingLeft: '1rem' }}>
            <h2
              className="text-xl mb-1 pb-2"
              style={{ fontFamily: serif, fontWeight: 700, color: '#141414', borderBottom: '1px solid #e0dbd3' }}
            >
              ⭐ 12th Man Bonus
            </h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ fontFamily: sans, color: '#141414' }}>
              This one&apos;s about heart, not strategy. Pick the team you actually support — the one that makes you nervous, the one you&apos;ve been defending in the office for years.
            </p>
            <p className="mt-2 text-sm leading-relaxed" style={{ fontFamily: sans, color: '#141414' }}>
              <span style={{ fontWeight: 700 }}>Their flag will appear next to your name on the leaderboard</span> for the entire tournament. Wear it with pride.
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed" style={{ fontFamily: sans, color: '#141414' }}>
              <li>
                <span style={{ color: '#ff5c35', fontWeight: 700 }}>+10 points</span>
                {' '}every time your team scores a goal
              </li>
              <li>
                <span style={{ color: '#ff5c35', fontWeight: 700 }}>+10 points</span>
                {' '}every time your player scores a goal
              </li>
              <li>Your player <span style={{ fontWeight: 700 }}>must be from your team</span> — someone you&apos;re genuinely riding with all tournament.</li>
              <li>These picks are hidden from everyone else until June 11. Then they&apos;re all revealed at once.</li>
              <li>The further your team goes, the more goals — and the more bonus points you rack up.</li>
            </ul>
          </section>

          {/* Section 6 — Quick Reference Table */}
          <section>
            <h2
              className="text-xl mb-1 pb-2"
              style={{ fontFamily: serif, fontWeight: 700, color: '#141414', borderBottom: '1px solid #e0dbd3' }}
            >
              Quick Reference
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table
                className="w-full text-sm"
                style={{
                  fontFamily: sans,
                  borderCollapse: 'collapse',
                  border: '1px solid #141414',
                }}
              >
                <thead>
                  <tr style={{ background: '#141414', color: '#ffffff' }}>
                    <th
                      className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ border: '1px solid #141414' }}
                    >
                      Action
                    </th>
                    <th
                      className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider"
                      style={{ border: '1px solid #141414', whiteSpace: 'nowrap' }}
                    >
                      Points
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { action: 'Exact score', points: '100 pts', highlight: true },
                    { action: 'Correct outcome', points: '50 pts', highlight: false },
                    { action: 'Streak bonus (3rd exact score in a row, and each after)', points: '+50 pts each', highlight: true },
                    { action: 'Tournament winner pick', points: '300 pts', highlight: false },
                    { action: 'Runner-up pick', points: '200 pts', highlight: true },
                    { action: '3rd place pick', points: '100 pts', highlight: false },
                    { action: "Golden Boots pick (per goal, up to 5 picks)", points: '10 pts', highlight: true },
                    { action: '12th Man Bonus — team goal', points: '10 pts', highlight: false },
                    { action: '12th Man Bonus — player goal', points: '10 pts', highlight: true },
                  ].map(({ action, points, highlight }, i) => (
                    <tr
                      key={i}
                      style={{ background: highlight ? '#faf9f6' : '#ffffff' }}
                    >
                      <td
                        className="px-4 py-2 leading-relaxed"
                        style={{ border: '1px solid #e0dbd3', color: '#141414' }}
                      >
                        {action}
                      </td>
                      <td
                        className="px-4 py-2 text-right font-bold"
                        style={{ border: '1px solid #e0dbd3', color: '#ff5c35', whiteSpace: 'nowrap' }}
                      >
                        {points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
