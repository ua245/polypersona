// /populations/data — personas from customer data. Planned, not built; this page says so plainly.
import { Link } from 'react-router';
import { C, Page, SectionLabel, Tag } from '../lib/ui';

const PLANNED: { title: string; body: string }[] = [
  { title: 'Bring your own evidence', body: 'Upload exports you already have: support tickets, interview notes, survey responses, or an analytics segment breakdown.' },
  { title: 'Cluster into segments', body: 'Group the records into a handful of behavioural segments, such as device mix, how carefully people read, and where they drop off.' },
  { title: 'Write one persona per segment', body: 'Each persona would carry quotes and counts from the underlying records, so you can check it against the data instead of trusting it.' },
];

export default function CustomerData() {
  return (
    <Page title="Personas from customer data" subtitle="Grounding personas in what your real customers said and did." actions={<Tag tone="yellow">not built yet</Tag>}>
      <div className="card" role="note" style={{ padding: 20, maxWidth: 820, borderColor: 'rgba(250,204,21,0.25)' }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>This feature is not connected.</div>
        <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.65, color: C.muted2 }}>
          There is no upload here because nothing on the backend would receive it. We would rather show an empty page than a form that accepts your file and does nothing with it.
          Today, personas come from two places: the built-in set, and ones generated from an audience description you write.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
          <Link to="/populations/new" className="btn-primary" style={{ textDecoration: 'none' }}>Generate from a description</Link>
          <Link to="/populations/custom" className="btn-secondary" style={{ textDecoration: 'none' }}>Saved personas</Link>
        </div>
      </div>

      <section style={{ marginTop: 32, maxWidth: 1000 }}>
        <SectionLabel>What it is meant to do</SectionLabel>
        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))' }}>
          {PLANNED.map((p, i) => (
            <li key={p.title} className="card" style={{ padding: 18 }}>
              <div className="mono" style={{ fontSize: 12, color: C.muted }}>{String(i + 1).padStart(2, '0')} · planned</div>
              <h2 style={{ margin: '8px 0 6px', fontSize: 15, fontWeight: 600 }}>{p.title}</h2>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: C.muted2 }}>{p.body}</p>
            </li>
          ))}
        </ol>
        <p style={{ margin: '20px 0 0', fontSize: 13, lineHeight: 1.6, color: C.muted, maxWidth: 760 }}>
          Until then, you can get close by hand: paste the patterns you see in your own data into the audience description, including the devices people use, what they are trying to get done, and the complaints that come up most.
        </p>
      </section>
    </Page>
  );
}
