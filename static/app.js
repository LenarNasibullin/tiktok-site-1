(function () {
  var form = document.getElementById('tool-form');
  if (!form) return;
  var input = document.getElementById('tool-url');
  var go = document.getElementById('tool-go');
  var statusEl = document.getElementById('tool-status');
  var result = document.getElementById('tool-result');
  var d = form.dataset;

  function setStatus(text, isError) {
    statusEl.textContent = text;
    statusEl.className = isError ? 'error' : '';
  }
  function fileLink(fileUrl, type) {
    return '/api/download?type=' + type + '&u=' + encodeURIComponent(fileUrl);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var link = input.value.trim();
    result.classList.remove('show');

    if (!/^https?:\/\/((www|m|vm|vt)\.)?tiktok\.com\//i.test(link)) {
      setStatus(d.errInvalid, true);
      return;
    }
    go.disabled = true;
    setStatus(d.searching, false);

    fetch('/api/info?url=' + encodeURIComponent(link))
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, data: j }; }); })
      .then(function (res) {
        if (!res.ok) { setStatus(d.errNotFound, true); return; }
        var v = res.data;
        document.getElementById('tool-author').textContent = v.author;
        document.getElementById('tool-title').textContent = v.title;
        var cover = document.getElementById('tool-cover');
        if (v.cover) { cover.src = v.cover; cover.style.display = ''; } else { cover.style.display = 'none'; }
        document.getElementById('tool-video').href = fileLink(v.video, 'mp4');
        var audio = document.getElementById('tool-audio');
        if (v.music) { audio.href = fileLink(v.music, 'mp3'); audio.style.display = ''; } else { audio.style.display = 'none'; }
        result.classList.add('show');
        setStatus(d.ready, false);
      })
      .catch(function () { setStatus(d.errServer, true); })
      .then(function () { go.disabled = false; });
  });
})();
