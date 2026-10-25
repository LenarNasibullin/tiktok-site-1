// Получает ссылки на видео без водяного знака через бесплатный сервис tikwm.com
const TIKTOK_URL = /^https?:\/\/((www|m|vm|vt)\.)?tiktok\.com\//i;

const absolute = (u) =>
  u ? (u.startsWith('http') ? u : 'https://www.tikwm.com' + u) : null;

module.exports = async (req, res) => {
  const url = String(req.query.url || '').trim();

  if (!TIKTOK_URL.test(url)) {
    return res.status(400).json({ error: 'invalid_url' });
  }

  try {
    const r = await fetch(
      'https://www.tikwm.com/api/?hd=1&url=' + encodeURIComponent(url),
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const j = await r.json();

    if (j.code !== 0 || !j.data) {
      return res.status(502).json({ error: 'not_found', message: j.msg || '' });
    }

    const d = j.data;
    const video = absolute(d.hdplay || d.play);
    if (!video) {
      return res.status(502).json({ error: 'no_video' });
    }

    res.setHeader('Cache-Control', 's-maxage=60');
    return res.status(200).json({
      title: d.title || '',
      author: (d.author && d.author.nickname) || '',
      cover: absolute(d.cover),
      video,
      music: absolute(d.music),
    });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};
