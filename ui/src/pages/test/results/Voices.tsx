// What each persona said on the way out, one card per persona with a column per variant.
import { Link } from 'react-router';
import { sessionList, type RunState, type SessionState } from '../../../lib/api';
import { agentPath, avatarColor, initials } from '../../../lib/derive';
import { C, SessionTag } from '../../../lib/ui';
import { winnerOf } from './shared';

function Said({ run, s, winner }: { run: RunState; s: SessionState; winner: string | null }) {
  const survey = s.exit_survey;
  return (
    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 6, background: C.bg, border: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <span className="mono" style={{ fontSize: 11, letterSpacing: '0.06em', color: winner === s.variant ? C.green : C.muted2 }}>VARIANT {s.variant.toUpperCase()}{s.repeat > 0 ? ` · RUN ${s.repeat + 1}` : ''}</span>
        <SessionTag s={s} />
      </div>
      {survey ? (
        <>
          <blockquote className="pp-clamp-5" title={survey.summary} style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: C.text }}>“{survey.summary}”</blockquote>
          {survey.biggest_problem && <div className="pp-clamp-2" title={survey.biggest_problem} style={{ fontSize: 12, color: C.muted2 }}><span style={{ color: C.muted }}>Biggest problem: </span>{survey.biggest_problem}</div>}
          <div className="mono" style={{ fontSize: 11, color: C.muted2 }}>
            ease {survey.ease}/5 · trust {survey.trust}/5 · <span style={{ color: survey.would_return ? C.green : C.red }}>{survey.would_return ? 'would return' : 'would not return'}</span>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: C.muted }}>{s.error ? `No exit survey: ${s.error}` : 'No exit survey was recorded for this agent.'}</div>
      )}
      <Link to={agentPath(run.run_id, s.session_id)} style={{ marginTop: 'auto', fontSize: 12, color: C.green, textDecoration: 'none' }} aria-label={`Watch ${s.persona} on variant ${s.variant.toUpperCase()}`}>Watch this agent →</Link>
    </div>
  );
}

export default function Voices({ run }: { run: RunState }) {
  const winner = winnerOf(run);
  const groups = new Map<string, SessionState[]>();
  for (const s of sessionList(run)) groups.set(s.persona_id, [...(groups.get(s.persona_id) ?? []), s]);
  const notes = run.verdict?.per_persona_notes ?? [];
  if (groups.size === 0) return <div className="card" style={{ padding: 20, fontSize: 13, color: C.muted2 }}>This test has no agents.</div>;
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))' }}>
      {[...groups.values()].map((sessions) => {
        const p = sessions[0]!;
        const note = notes.find((n) => n.toLowerCase().startsWith(p.persona.toLowerCase()));
        return (
          <li key={p.persona_id} className="card" style={{ padding: 16, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: '50%', background: avatarColor(p.persona), color: '#fff', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials(p.persona)}</span>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{p.persona}</h3>
                <div className="mono" style={{ fontSize: 11, color: C.muted }}>{p.device} · {p.savviness} savviness · patience {p.patience}</div>
              </div>
            </div>
            {note && <p style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.55, color: C.muted2 }}><span style={{ color: C.muted }}>Evaluator: </span>{note.slice(p.persona.length).replace(/^\s*[:–-]\s*/, '')}</p>}
            <div style={{ display: 'grid', gap: 8, marginTop: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))' }}>
              {sessions.map((s) => <Said key={s.session_id} run={run} s={s} winner={winner} />)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
