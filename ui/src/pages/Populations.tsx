import { Link } from 'react-router';
import { useState } from 'react';

const filters = ['All', 'Annual', 'Frequent', 'Occasional', 'Apple reference', 'Shopping habits'];

const AVATAR_COLORS = [
  '#16a34a','#0891b2','#7c3aed','#dc2626','#ca8a04',
  '#0e7490','#6d28d9','#b91c1c','#a16207','#15803d',
  '#1d4ed8','#9333ea','#be123c','#b45309','#047857',
];

function avatarColor(id: string) {
  const n = parseInt(id.replace('A', ''), 10);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const firstNames = [
  'Aisha','Tom','Macy','David','Maya','Oliver','Fatima','Jack','Priya','Leo',
  'Sarah','Noah','Amara','Yusuf','Chloe','Marcus','Isla','Ben','Zara','Ethan',
  'Nina','James','Layla','Ryan','Sofia','Daniel','Grace','Liam','Hannah','Adam',
  'Mei','George','Aria','Luke','Nadia','Sam','Leila','Harry','Imogen','Khalid',
  'Rosa','Finn','Sasha','Owen','Jade','Tariq','Ellie','Connor','Hana','Ravi',
  'Daisy','Joel','Tara','Max','Freya','Aaron','Lydia','Stefan','Nia','Callum',
  'Mia','Theo','Alicia','Jake','Simone','Rashid','Beth','Alex','Anaya','Patrick',
  'Zoe','Dami','Clara','Chris','Tamara','Hugo','Seren','Malik','Pippa','Dylan',
  'Alinta','Jonah','Yasmin','Toby','Carmen','Idris','Gemma','Rohan','Bea','Oscar',
  'Inaya','Felix','Petra','Will','Naomi','Javier','Ellen','Kwame','Lena','Olu',
];

const lastNames = [
  'Khan','Harris','Chadda','Wong','Patel','Smith','Ali','Evans','Shah','Martin',
  'Cole','Brown','Jones','Ahmed','Wilson','Reed','Thomson','Carter','Obi','Clarke',
  'Rao','Lewis','Hassan','Moore','Costa','Kim','Chen','Murphy','Okafor','Nair',
  'Bello','Taylor','Diallo','Walsh','Yildiz','Park','Fernandez','Nguyen','Sato','Kapoor',
  'White','Singh','Cruz','O\'Brien','Adeyemi','Johansson','Mistry','Griffin','Tanaka','Sharma',
  'Fletcher','Bakr','Gomez','Reid','Andersen','Osei','Brennan','Petrov','Eze','MacLeod',
  'Torres','Yong','Ferreira','Bell','Nakamura','Al-Hassan','Morris','Reyes','Iyer','O\'Connor',
  'Dupont','Adewale','Meyer','Hughes','Vasquez','Strand','Malik','Roberts','Mensah','Walsh',
  'Tran','Fox','Bergstrom','Owusu','Grant','Molina','Holt','Aziz','Lawson','Diaz',
  'Ito','Barrett','Okonkwo','Harrington','Leon','Dlamini','Warren','Baig','Olsen','Addo',
];

const roles = [
  'UX Engineer','Product Manager','Designer','Data Analyst','Marketing Lead',
  'Engineer','Operations','Finance','Customer Success','Sales',
  'Content','Backend Eng.','Brand','Legal','UX Research',
  'DevOps','PM','QA Engineer','Strategy','Growth',
  'Research','BI Analyst','IT Manager','Procurement','Admin',
];

const people = Array.from({ length: 100 }, (_, i) => {
  const n = i + 1;
  const id = `A${String(n).padStart(3, '0')}`;
  const name = `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`;
  const role = roles[i % roles.length];
  return { id, name, role };
});

export default function Populations() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [search, setSearch] = useState('');

  const filtered = people.filter(p =>
    search === '' || p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 48px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: '#6b7280', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>PRESET POPULATION</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e8eaf0', margin: 0, letterSpacing: '-0.02em' }}>100 people in London</h1>
          <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>A realistic customer population spanning lifestyles, life stages, needs, and digital confidence.</p>
        </div>
        <Link to="/tools" style={{ textDecoration: 'none' }}>
          <button className="btn-primary">Run this population</button>
        </Link>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, marginTop: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={activeFilter === f ? 'btn-primary' : 'btn-ghost'}
            style={{ fontSize: 12, padding: '5px 12px' }}
          >
            {f}
          </button>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <input
            className="input"
            placeholder="Search agents..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 200 }}
          />
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
        {filtered.map(p => (
          <Link key={p.id} to={`/populations/${p.id}`} style={{ textDecoration: 'none' }}>
            <div
              className="card"
              style={{ padding: 12, textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#252a38')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e2230')}
            >
              {/* Avatar placeholder */}
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: avatarColor(p.id),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 10px',
                fontSize: 16, fontWeight: 700, color: '#fff',
                opacity: 0.85,
              }}>
                {initials(p.name)}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#e8eaf0', marginBottom: 2, lineHeight: 1.3 }}>{p.name}</div>
              <div style={{ fontSize: 10, color: '#6b7280' }}>{p.role}</div>
              <div style={{ fontSize: 9, color: '#4b5563', marginTop: 3, fontFamily: 'JetBrains Mono, monospace' }}>{p.id}</div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ fontSize: 12, color: '#4b5563', textAlign: 'center' }}>
        Showing {filtered.length} of 100 agents · placeholder data · backend to be wired
      </div>
    </div>
  );
}
