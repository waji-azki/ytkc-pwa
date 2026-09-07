// 配信感想メモ - 共通ロジック
window.YTKC = (function () {
  'use strict';

  const STORAGE_KEY = 'ytkc_videos_v1';
  const EMOJIS = [
    '😂', '🤣', '😭', '😳', '😱', '😅', '😆', '😢', '😡', '😍', '🥺', '👏',
    '🙌', '🔥', '💯', '❤️', '💦', '💀', '😴', '🎉', '✨', '😇', '🤯', '😤',
    '🫠', '🙏', '👍', '👎', '✅', '❓', '❗', '😏', '🫡', '😬', '🤝', '💪',
    '😹', '🥹', '😮', '草', 'それな', '尊い', '神', 'わかる',
  ];

  // ---------- ストレージ ----------

  function loadAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.error('load error', e);
      return {};
    }
  }

  function saveAll(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function getVideo(videoId) {
    const all = loadAll();
    return all[videoId] || null;
  }

  function ensureVideo(videoId) {
    const all = loadAll();
    if (!all[videoId]) {
      all[videoId] = {
        videoId,
        title: null,
        thumbnail: null,
        lastWatchedAt: 0,
        updatedAt: Date.now(),
        entries: [],
      };
      saveAll(all);
    }
    return all[videoId];
  }

  function listVideos() {
    const all = loadAll();
    return Object.values(all).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  function addEntry(videoId, { t, type, content }) {
    const all = loadAll();
    if (!all[videoId]) {
      all[videoId] = { videoId, title: null, thumbnail: null, lastWatchedAt: 0, updatedAt: Date.now(), entries: [] };
    }
    const video = all[videoId];
    const entry = {
      id: 'e' + Date.now() + Math.random().toString(36).slice(2, 7),
      t: t || 0,
      type: type || 'text',
      content,
      createdAt: Date.now(),
    };
    video.entries.push(entry);
    video.entries.sort((a, b) => a.t - b.t);
    if (typeof t === 'number' && t > (video.lastWatchedAt || 0)) {
      video.lastWatchedAt = t;
    }
    video.updatedAt = Date.now();
    saveAll(all);
    return video;
  }

  function markPosition(videoId, t) {
    const all = loadAll();
    if (!all[videoId]) {
      all[videoId] = { videoId, title: null, thumbnail: null, lastWatchedAt: 0, updatedAt: Date.now(), entries: [] };
    }
    const video = all[videoId];
    if (typeof t === 'number' && t > (video.lastWatchedAt || 0)) {
      video.lastWatchedAt = t;
    }
    video.updatedAt = Date.now();
    saveAll(all);
    return video;
  }

  function deleteEntry(videoId, entryId) {
    const all = loadAll();
    const video = all[videoId];
    if (!video) return null;
    video.entries = video.entries.filter((e) => e.id !== entryId);
    saveAll(all);
    return video;
  }

  function updateMeta(videoId, { title, thumbnail }) {
    const all = loadAll();
    if (!all[videoId]) return;
    if (title) all[videoId].title = title;
    if (thumbnail) all[videoId].thumbnail = thumbnail;
    saveAll(all);
  }

  function deleteVideo(videoId) {
    const all = loadAll();
    delete all[videoId];
    saveAll(all);
  }

  // ---------- 時刻処理 ----------

  function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // "1h2m3s" / "90" / "90s" / "1:30" 形式を秒数に変換
  function parseTimeToken(token) {
    if (!token) return null;
    token = String(token).trim();
    if (/^\d+$/.test(token)) return parseInt(token, 10);
    if (/^\d+s$/.test(token)) return parseInt(token, 10);
    const hms = token.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (hms && (hms[1] || hms[2] || hms[3])) {
      const h = parseInt(hms[1] || '0', 10);
      const m = parseInt(hms[2] || '0', 10);
      const s = parseInt(hms[3] || '0', 10);
      return h * 3600 + m * 60 + s;
    }
    const colon = token.split(':').map((x) => parseInt(x, 10));
    if (colon.every((n) => !isNaN(n))) {
      if (colon.length === 3) return colon[0] * 3600 + colon[1] * 60 + colon[2];
      if (colon.length === 2) return colon[0] * 60 + colon[1];
    }
    return null;
  }

  // mm:ss 形式の文字列に変換(input用)
  function secondsToInputString(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // ---------- URL解析 ----------

  function extractYoutubeInfo(text) {
    if (!text) return null;
    const urlMatch = text.match(/https?:\/\/[^\s]+/g);
    const candidates = urlMatch || [text];
    for (const raw of candidates) {
      const info = parseOneUrl(raw);
      if (info) return info;
    }
    return null;
  }

  function parseOneUrl(raw) {
    try {
      const url = new URL(raw);
      let videoId = null;

      if (url.hostname.includes('youtu.be')) {
        videoId = url.pathname.replace('/', '').split('/')[0];
      } else if (url.hostname.includes('youtube.com')) {
        if (url.pathname === '/watch') {
          videoId = url.searchParams.get('v');
        } else if (url.pathname.startsWith('/live/')) {
          videoId = url.pathname.split('/')[2];
        } else if (url.pathname.startsWith('/shorts/')) {
          videoId = url.pathname.split('/')[2];
        }
      } else {
        return null;
      }

      if (!videoId) return null;

      let t = null;
      const tParam = url.searchParams.get('t') || url.searchParams.get('start');
      if (tParam) t = parseTimeToken(tParam);

      return { videoId, t: t || 0, url: `https://www.youtube.com/watch?v=${videoId}` };
    } catch (e) {
      return null;
    }
  }

  function buildWatchUrl(videoId, t) {
    const sec = Math.max(0, Math.floor(t || 0));
    return `https://www.youtube.com/watch?v=${videoId}&t=${sec}s`;
  }

  function buildEmbedOrigin() {
    try {
      return location.origin;
    } catch (e) {
      return '';
    }
  }

  // ---------- 「同時視聴」タイマーの状態(タイマー方式で使用) ----------
  // ページを離れて戻ってきたときにある程度復元できるよう保存しておく

  function getCounterState(videoId) {
    const v = getVideo(videoId);
    return v && v.counter ? v.counter : null;
  }

  function setCounterState(videoId, state) {
    const all = loadAll();
    if (!all[videoId]) {
      all[videoId] = { videoId, title: null, thumbnail: null, lastWatchedAt: 0, updatedAt: Date.now(), entries: [] };
    }
    all[videoId].counter = state;
    all[videoId].updatedAt = Date.now();
    saveAll(all);
  }

  function clearCounterState(videoId) {
    setCounterState(videoId, null);
  }

  // ---------- YouTube oEmbed(タイトル・サムネ取得。失敗しても無視) ----------

  async function fetchOEmbed(videoId) {
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(
          'https://www.youtube.com/watch?v=' + videoId
        )}&format=json`
      );
      if (!res.ok) return null;
      const data = await res.json();
      return { title: data.title, thumbnail: data.thumbnail_url };
    } catch (e) {
      return null;
    }
  }

  // ---------- 送信用テキスト整形 ----------

  function buildExportText(video) {
    const title = video.title || video.videoId;
    const lines = [];
    lines.push(`【${title}】`);
    lines.push(`https://www.youtube.com/watch?v=${video.videoId}`);
    lines.push('');
    video.entries.forEach((e) => {
      const prefix = e.source ? `(${e.source}) ` : '';
      lines.push(`[${formatTime(e.t)}] ${prefix}${e.content}`);
    });
    return lines.join('\n');
  }

  // ---------- 送信用テキストのインポート(友人の感想を取り込む) ----------

  // buildExportText と同じフォーマットのテキストを解析する
  function parseExportText(text) {
    if (!text) return null;
    const lines = text.split('\n').map((l) => l.replace(/\r$/, ''));
    let title = null;
    let videoId = null;
    const entries = [];
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (!title && /^【.+】$/.test(line)) {
        title = line.replace(/^【/, '').replace(/】$/, '');
        continue;
      }
      if (!videoId) {
        const info = extractYoutubeInfo(line);
        if (info) {
          videoId = info.videoId;
          continue;
        }
      }
      const m = line.match(/^\[([^\]]+)\]\s*(.*)$/);
      if (m) {
        const t = parseTimeToken(m[1]);
        if (t !== null) {
          entries.push({ t, content: m[2] });
        }
      }
    }
    if (!videoId || entries.length === 0) return null;
    return { videoId, title, entries };
  }

  // 解析済みのentriesを、source(表示名)付きで動画の記録にマージする。重複はスキップする
  function importEntries(videoId, entries, source) {
    const all = loadAll();
    if (!all[videoId]) {
      all[videoId] = { videoId, title: null, thumbnail: null, lastWatchedAt: 0, updatedAt: Date.now(), entries: [] };
    }
    const video = all[videoId];
    let addedCount = 0;
    let skippedCount = 0;
    entries.forEach((e) => {
      const isDup = video.entries.some(
        (existing) => existing.t === e.t && existing.content === e.content && (existing.source || null) === (source || null)
      );
      if (isDup) {
        skippedCount++;
        return;
      }
      video.entries.push({
        id: 'e' + Date.now() + Math.random().toString(36).slice(2, 7),
        t: e.t,
        type: 'text',
        content: e.content,
        source: source || null,
        createdAt: Date.now(),
      });
      addedCount++;
    });
    video.entries.sort((a, b) => a.t - b.t);
    video.updatedAt = Date.now();
    saveAll(all);
    return { video, addedCount, skippedCount };
  }

  const SOURCE_COLORS = ['#ffab40', '#7ee787', '#ff6b9d', '#c792ea', '#4dd0e1', '#ffd54f', '#ff8a65', '#90caf9'];
  function sourceColor(name) {
    if (!name) return null;
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return SOURCE_COLORS[hash % SOURCE_COLORS.length];
  }

  // ---------- Service Worker登録 ----------

  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    }
  }

  return {
    EMOJIS,
    loadAll,
    saveAll,
    getVideo,
    ensureVideo,
    listVideos,
    addEntry,
    markPosition,
    deleteEntry,
    updateMeta,
    deleteVideo,
    formatTime,
    parseTimeToken,
    secondsToInputString,
    extractYoutubeInfo,
    buildWatchUrl,
    buildEmbedOrigin,
    getCounterState,
    setCounterState,
    clearCounterState,
    fetchOEmbed,
    buildExportText,
    parseExportText,
    importEntries,
    sourceColor,
    registerSW,
  };
})();
