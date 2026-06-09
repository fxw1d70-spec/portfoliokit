const express = require('express');
const fs      = require('fs');
const path    = require('path');

const app      = express();
const PORT     = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

app.use(express.json({ limit: '10mb' }));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use(express.static(__dirname));

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

/* ─── helpers ─────────────────────────────────────────────────── */
function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 60);
}
function dataFile(id) {
  return path.join(DATA_DIR, `${slug(id)}.json`);
}
function readPortfolio(id) {
  const f = dataFile(id);
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

/* ─── API ──────────────────────────────────────────────────────── */

// List all portfolios
app.get('/api/portfolios', (_req, res) => {
  try {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    const list = files.map(f => {
      try {
        const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
        return {
          slug:    f.replace('.json', ''),
          name:    d.profile?.name    || 'Unnamed',
          tagline: d.profile?.headline || '',
          photo:   d.profile?.photo   || '',
          updated: fs.statSync(path.join(DATA_DIR, f)).mtime.toISOString(),
        };
      } catch { return null; }
    }).filter(Boolean);
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get one portfolio's JSON
app.get('/api/portfolio/:id', (req, res) => {
  const d = readPortfolio(req.params.id);
  if (!d) return res.status(404).json({ error: 'Not found' });
  res.json(d);
});

// Save (overwrite) a portfolio
app.post('/api/portfolio/:id', (req, res) => {
  const id = slug(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid ID' });
  fs.writeFileSync(dataFile(id), JSON.stringify(req.body, null, 2));
  res.json({ ok: true, slug: id });
});

// Create new portfolio
app.post('/api/portfolio', (req, res) => {
  const id   = slug(req.body?.slug || '');
  const name = String(req.body?.name || id || 'New Portfolio');
  if (!id) return res.status(400).json({ error: 'slug is required' });
  if (fs.existsSync(dataFile(id))) return res.status(409).json({ error: 'Already exists' });
  fs.writeFileSync(dataFile(id), JSON.stringify(defaultData(id, name), null, 2));
  res.json({ ok: true, slug: id });
});

// Delete a portfolio
app.delete('/api/portfolio/:id', (req, res) => {
  const f = dataFile(req.params.id);
  if (!fs.existsSync(f)) return res.status(404).json({ error: 'Not found' });
  fs.unlinkSync(f);
  res.json({ ok: true });
});

/* ─── Pages ────────────────────────────────────────────────────── */

// Render portfolio — inject JSON into template
app.get('/portfolio/:id', (req, res) => {
  const d = readPortfolio(req.params.id);
  if (!d) return res.status(404).send(notFound(req.params.id));
  let html = fs.readFileSync(path.join(__dirname, 'portfolio.html'), 'utf8');
  html = html.replace('/*__DATA__*/', `window.__PF__=${JSON.stringify(d)};`);
  res.send(html);
});

// Admin pages
app.get('/admin/edit/:id', (_req, res) =>
  res.sendFile(path.join(__dirname, 'admin', 'edit.html')));
app.get('/admin', (_req, res) =>
  res.sendFile(path.join(__dirname, 'admin', 'index.html')));
app.get('/', (_req, res) => res.redirect('/admin'));

/* ─── Default template ─────────────────────────────────────────── */
function defaultData(id, name) {
  return {
    meta: { slug: id },
    profile: {
      name, initials: name.slice(0, 2).toUpperCase(),
      photo: 'https://randomuser.me/api/portraits/men/1.jpg',
      availability: 'Open to Opportunities', availability_dot: true,
      roles: ['Student', 'Engineer', 'Problem Solver'],
      headline: 'Engineering Student',
      tagline: 'A passionate student ready to make an impact.',
      chips: [
        { icon: 'fas fa-cog',  color: 'cyan',   label: 'Specialty', value: 'Your Skill' },
        { icon: 'fas fa-star', color: 'orange', label: 'Tool',      value: 'Your Tool'  },
      ],
      about: {
        title: 'About Me', highlight: 'Enthusiast',
        paragraphs: [
          'Write your introduction here.',
          'Add more details about your background.',
          'Share your goals and interests.',
        ],
        details: {
          degree: 'B.Tech', university: 'University Name', graduation: '2026',
          location: 'City, Country', specialization: 'Your Specialisation',
          status: 'Open to Opportunities', cgpa: '0.0',
        },
      },
    },
    contact: {
      email: 'you@example.com', phone: '+0 000 000 0000',
      linkedin: 'linkedin.com/in/you', linkedin_url: '#',
      github: 'github.com/you', github_url: '#', cv_url: '#',
    },
    stats: [
      { value: 0, decimals: 1, label: 'CGPA'           },
      { value: 0, decimals: 0, label: 'Projects'        },
      { value: 0, decimals: 0, label: 'Certifications'  },
      { value: 0, decimals: 0, label: 'Awards'          },
    ],
    skills: { core: [], computational: [], tools: [] },
    projects: [], education: [], certifications: [],
    honours: [], publications: [], patents: [],
    volunteer: [], services: [],
    career_break: {
      enabled: false, title: '', period: '', duration: '',
      location: '', paragraphs: [], bullets: [], outcomes: [],
    },
  };
}

function notFound(id) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Not found</title>
<style>body{font-family:sans-serif;background:#04080f;color:#e6edf3;display:flex;
flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0}
h1{font-size:2rem;margin-bottom:1rem}a{color:#00d4ff}</style></head>
<body><h1>Portfolio "${id}" not found</h1>
<a href="/admin">← Back to dashboard</a></body></html>`;
}

app.listen(PORT, () =>
  console.log(`\n  Portfolio Manager  →  http://localhost:${PORT}/admin\n`));
