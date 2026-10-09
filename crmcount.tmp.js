const { app, session } = require('electron');
app.disableHardwareAcceleration();
app.setPath('userData', 'C:\Users\Tyler\AppData\Roaming\T&G Vault');

const BASE = 'https://crm.tgagencypro.com';

app.whenReady().then(async () => {
  const s = session.fromPartition('persist:crm');
  const get = async (path) => {
    const r = await s.fetch(BASE + path);
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: r.status, data: json && 'ok' in json ? json.data : json, raw: text.slice(0, 200) };
  };

  const models = await get('/api/bundle/models');
  if (models.status !== 200) {
    console.log('models failed:', models.status, models.raw);
    app.quit();
    return;
  }
  console.log('models:', (models.data.models || []).map((m) => `${m.name} [${m.platform}] id=${m.id}`).join('\n        '));

  for (const m of models.data.models || []) {
    for (const kind of ['STORY', 'REEL']) {
      const r = await get(`/api/bundle/reels?modelId=${encodeURIComponent(m.id)}&kind=${kind}`);
      const list = r.data?.reels ?? [];
      const names = list.map((x) => x.filename || x.name || x.id);
      const uniqueNames = new Set(names).size;
      const hashes = new Set(list.map((x) => x.sha256 || x.hash).filter(Boolean)).size;
      console.log(`\n${m.name} / ${kind}: ${list.length} items, ${uniqueNames} distinct names, ${hashes || 'n/a'} distinct hashes`);
      if (list.length) console.log('  sample keys:', Object.keys(list[0]).join(', '));
    }
  }
  app.quit();
}).catch((e) => { console.log('error', e.message); app.quit(); });
