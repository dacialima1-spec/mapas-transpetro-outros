export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { nome, email, enfase } = req.body || {};
    if (!nome || !email || !enfase) {
      res.status(400).json({ error: 'Campos obrigatorios faltando' });
      return;
    }

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

    const entry = {
      nome: String(nome).slice(0, 200),
      email: String(email).slice(0, 200),
      enfase: String(enfase).slice(0, 200),
      page: 'outros',
      ts: new Date().toISOString(),
    };

    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const getRes = await fetch(apiBase, { headers });
      let sha, arr = [];
      if (getRes.status === 200) {
        const data = await getRes.json();
        sha = data.sha;
        const content = Buffer.from(data.content, 'base64').toString('utf8');
        try { arr = JSON.parse(content); } catch (_) { arr = []; }
      } else if (getRes.status !== 404) {
        lastError = `GitHub GET ${getRes.status}`;
        continue;
      }

      arr.push(entry);
      const newContent = Buffer.from(JSON.stringify(arr, null, 2)).toString('base64');
      const putBody = { message: `lead: ${entry.email}`, content: newContent };
      if (sha) putBody.sha = sha;

      const putRes = await fetch(apiBase, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(putBody),
      });

      if (putRes.ok) {
        res.status(200).json({ ok: true });
        return;
      }
      if (putRes.status === 409) { lastError = 'conflict'; continue; }
      const errText = await putRes.text();
      lastError = `GitHub PUT ${putRes.status}: ${errText}`;
      break;
    }

    res.status(500).json({ error: lastError || 'Falha ao salvar' });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
