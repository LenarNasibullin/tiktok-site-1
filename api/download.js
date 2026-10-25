// Отдаёт файл браузеру как скачиваемый (MP4 или MP3).
// Разрешены только адреса TikTok/tikwm, чтобы функцию нельзя было использовать как открытый прокси.
const { Readable } = require('stream');

const ALLOWED_HOSTS = [
  'tikwm.com',
  'tiktokcdn.com',
  'tiktokcdn-us.com',
  'tokcdn.com',
  'tiktokv.com',
  'byteoversea.com',
];

module.exports = async (req, res) => {
  let target;
  try {
    target = new URL(String(req.query.u || ''));
  } catch (e) {
    return res.status(400).end('bad url');
  }

  const hostOk = ALLOWED_HOSTS.some(
    (h) => target.hostname === h || target.hostname.endsWith('.' + h)
  );
  if (target.protocol !== 'https:' || !hostOk) {
    return res.status(400).end('host not allowed');
  }

  const isMp3 = req.query.type === 'mp3';

  try {
    const upstream = await fetch(target, {
      headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.tikwm.com/' },
    });
    if (!upstream.ok || !upstream.body) {
      return res.status(502).end('upstream error');
    }

    res.setHeader('Content-Type', isMp3 ? 'audio/mpeg' : 'video/mp4');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="tiktok-${Date.now()}.${isMp3 ? 'mp3' : 'mp4'}"`
    );
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (e) {
    res.status(500).end('server error');
  }
};
