export default async function handler(req, res) {
  const key = req.query.key;
  if (!key || key !== process.env.LEADS_VIEW_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const token = process.env.LEADS_GH_TOKEN;
    const repo = process.env.LEADS_GH_REPO;
    if (!token || !repo) {
      res.status(500).json({ error: 'Configuracao ausente' });
      return;
    }

    const apiBase = `https://api.github.com/repos/${repo}/contents/leads.json`;
    const headers = {
      Authorization: `token ${token}`,
      'User-Agent': 'mapas-transpetro-leads',
      Accept: 'application/vnd.github+json',
    };

    const r = await fetch(apiBase, { headers });
    if (r.status === 404) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json([]);
      return;
    }
    if (!r.ok) throw new Error(`GitHub GET ${r.status}`);

    const data = await r.json();
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    let arr = [];
    try { arr = JSON.parse(content); } catch (_) { arr = []; }
    arr.sort((a, b) => new Date(b.ts) - new Date(a.ts));

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(arr);
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
