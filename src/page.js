// 页面操作：档案卡片、证书筛选（待核/有效/失效）与签发当刻快照查看
export function renderPage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>赛鸽血统环号登记站</title>
  <style>
    :root { --bg:#eff2f5; --panel:#fff; --ink:#1f2833; --muted:#697786; --line:#d3dce4; --accent:#315f83; --red:#9b3f35; --green:#2f7d4f; --orange:#b26a21; }
    * { box-sizing:border-box; } body { margin:0; background:var(--bg); color:var(--ink); font-family:Arial,"PingFang SC",sans-serif; }
    header { padding:22px 28px; background:#fff; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; gap:16px; align-items:center; }
    h1 { margin:0; font-size:26px; } main { display:grid; grid-template-columns:380px 1fr; gap:22px; padding:22px 28px; }
    form,.panel,.card,.stat { background:#fff; border:1px solid var(--line); border-radius:8px; padding:16px; } h2 { margin:0 0 12px; font-size:18px; }
    label { display:block; margin:10px 0 5px; color:var(--muted); font-size:13px; } input,select { width:100%; border:1px solid var(--line); border-radius:6px; padding:9px; font:inherit; }
    button { border:0; border-radius:6px; background:var(--accent); color:#fff; padding:10px 13px; font-weight:700; cursor:pointer; }
    button.ghost { background:#fff; color:var(--accent); border:1px solid var(--accent); }
    .toolbar { display:grid; grid-template-columns:1fr auto; gap:10px; margin-bottom:14px; } .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:12px; }
    .card { display:grid; gap:8px; align-content:start; } .meta { color:var(--muted); font-size:13px; } .pill { display:inline-block; border:1px solid var(--line); border-radius:999px; padding:3px 8px; font-size:12px; }
    .pill.st-valid { color:var(--green); border-color:var(--green); } .pill.st-pending { color:var(--orange); border-color:var(--orange); } .pill.st-invalid { color:var(--red); border-color:var(--red); }
    .section { margin-top:14px; } .relation { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:14px; } .small { background:#f8fafb; border:1px solid var(--line); border-radius:8px; padding:10px; }
    .certzone { padding:0 28px 28px; }
    .certhead { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; }
    .tabs { display:flex; gap:8px; flex-wrap:wrap; }
    .tabs button { background:#fff; color:var(--ink); border:1px solid var(--line); padding:8px 12px; }
    .tabs button.on { background:var(--accent); color:#fff; border-color:var(--accent); }
    .certgrid { display:grid; grid-template-columns:430px 1fr; gap:16px; margin-top:14px; align-items:start; }
    .certlist { display:grid; gap:10px; max-height:580px; overflow:auto; }
    .cert { border:1px solid var(--line); border-radius:8px; padding:12px; display:grid; gap:6px; background:#fff; }
    .cert.sel { border-color:var(--accent); box-shadow:0 0 0 1px var(--accent); }
    .cert .row { display:flex; justify-content:space-between; gap:8px; align-items:center; flex-wrap:wrap; }
    .cert button { padding:6px 10px; font-size:13px; }
    .checks { display:grid; gap:6px; margin:12px 0; }
    .check { display:flex; gap:8px; align-items:center; } .ok { color:var(--green); } .bad { color:var(--red); }
    .kv { display:grid; grid-template-columns:110px 1fr; gap:6px 10px; font-size:14px; }
    .kv b { color:var(--muted); font-weight:400; }
    @media (max-width:900px){ header{display:block;padding:18px 16px;} main{grid-template-columns:1fr;padding:16px;} .relation{grid-template-columns:1fr;} .certgrid{grid-template-columns:1fr;} .certzone{padding:0 16px 16px;} }
  </style>
</head>
<body>
  <header><div><h1>赛鸽血统环号登记站</h1><div class="meta">档案、血统、转让、归巢成绩与电子血统证书</div></div><button id="reload">刷新</button></header>
  <main>
    <form id="form">
      <h2>创建鸽只档案</h2>
      <label>足环号</label><input name="ringNo" required>
      <label>鸽主</label><input name="owner" required>
      <label>父鸽足环号</label><input name="fatherRing">
      <label>母鸽足环号</label><input name="motherRing">
      <label>羽色</label><input name="color" required>
      <label>出生棚号</label><input name="loft" required>
      <button>保存档案</button>
    </form>
    <section>
      <div class="toolbar"><input id="search" placeholder="输入足环号查询血统"><button id="searchBtn">查询</button></div>
      <div class="panel" id="detail"></div>
      <div class="section grid" id="cards"></div>
    </section>
  </main>
  <section class="certzone">
    <div class="panel">
      <div class="certhead">
        <h2>电子血统证书</h2>
        <div class="tabs" id="tabs"></div>
      </div>
      <div class="certgrid">
        <div class="certlist" id="certlist"></div>
        <div class="panel" id="snapshot" style="background:#fbfcfd"></div>
      </div>
    </div>
  </section>
  <script>
    const form = document.querySelector("#form");
    const cards = document.querySelector("#cards");
    const detail = document.querySelector("#detail");
    const search = document.querySelector("#search");
    const tabs = document.querySelector("#tabs");
    const certlist = document.querySelector("#certlist");
    const snapshotBox = document.querySelector("#snapshot");
    let pigeons = [];
    let certs = [];
    let certFilter = "all";
    let selectedId = null;
    const STATUS_LABEL = { pending: "待核", valid: "有效", invalid: "失效" };
    const REASON_LABEL = { transfer: "转让换发", parent_correction: "父母信息更正", vaccine_supplement: "疫苗补齐", archive_supplement: "档案补齐", reissue: "重新签发" };
    const MISSING_LABEL = { owner: "鸽主", father: "父鸽档案", mother: "母鸽档案", vaccines: "疫苗记录" };
    const FILTERS = [["all", "全部"], ["pending", "待核"], ["valid", "有效"], ["invalid", "失效"]];

    async function api(path, options) {
      const res = await fetch(path, options && options.body ? { ...options, headers: { "Content-Type": "application/json" } } : options);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "请求失败");
      return data;
    }
    function run(job) { job().catch(error => alert(error.message)); }
    function fmt(iso) { return iso ? iso.replace("T", " ").slice(0, 19) : "-"; }
    function activeCertOf(ringNo) { return certs.find(c => c.ringNo === ringNo && c.status !== "invalid") || null; }

    function renderCards() {
      cards.innerHTML = pigeons.map(p => {
        const cert = activeCertOf(p.ringNo);
        const certPill = cert
          ? '<span class="pill st-' + cert.status + '">' + STATUS_LABEL[cert.status] + '证书 V' + cert.version + '</span>'
          : '<span class="pill">未签发证书</span>';
        return '<article class="card"><h3>' + p.ringNo + '</h3>'
          + '<div><span class="pill">' + p.owner + '</span> ' + certPill + '</div>'
          + '<div class="meta">' + p.color + ' · ' + p.loft + '</div>'
          + '<div>父：' + (p.fatherRing || "未登记") + '</div><div>母：' + (p.motherRing || "未登记") + '</div>'
          + '<button data-issue="' + p.ringNo + '">签发 / 重新核对证书</button>'
          + '<label>更正父母</label>'
          + '<input data-father="' + p.ringNo + '" placeholder="父鸽足环号" value="' + p.fatherRing + '">'
          + '<input data-mother="' + p.ringNo + '" placeholder="母鸽足环号" value="' + p.motherRing + '">'
          + '<button data-parents="' + p.ringNo + '">保存父母更正</button>'
          + '<label>录入疫苗</label><input data-vaccine="' + p.ringNo + '" placeholder="疫苗名称，如新城疫"><button data-vacc="' + p.ringNo + '">保存疫苗</button>'
          + '<label>录入转让</label><input data-to="' + p.ringNo + '" placeholder="新归属人"><button data-transfer="' + p.ringNo + '">保存转让</button>'
          + '<label>归巢成绩</label><input data-race="' + p.ringNo + '" placeholder="赛事/距离/名次，如200公里/200/6"><button data-score="' + p.ringNo + '">保存成绩</button></article>';
      }).join("");
      document.querySelectorAll("[data-issue]").forEach(btn => btn.onclick = () => run(async () => {
        await api("/api/pigeons/" + encodeURIComponent(btn.dataset.issue) + "/certificate", { method: "POST", body: "{}" });
        await load();
      }));
      document.querySelectorAll("[data-parents]").forEach(btn => btn.onclick = () => run(async () => {
        const ringNo = btn.dataset.parents;
        const fatherRing = document.querySelector('[data-father="' + ringNo + '"]').value;
        const motherRing = document.querySelector('[data-mother="' + ringNo + '"]').value;
        await api("/api/pigeons/" + encodeURIComponent(ringNo) + "/parents", { method: "POST", body: JSON.stringify({ fatherRing, motherRing }) });
        await load();
      }));
      document.querySelectorAll("[data-vacc]").forEach(btn => btn.onclick = () => run(async () => {
        const ringNo = btn.dataset.vacc;
        const name = document.querySelector('[data-vaccine="' + ringNo + '"]').value;
        await api("/api/pigeons/" + encodeURIComponent(ringNo) + "/vaccines", { method: "POST", body: JSON.stringify({ name }) });
        await load();
      }));
      document.querySelectorAll("[data-transfer]").forEach(btn => btn.onclick = () => run(async () => {
        const ringNo = btn.dataset.transfer;
        const to = document.querySelector('[data-to="' + ringNo + '"]').value;
        await api("/api/pigeons/" + encodeURIComponent(ringNo) + "/transfers", { method: "POST", body: JSON.stringify({ to }) });
        await load();
      }));
      document.querySelectorAll("[data-score]").forEach(btn => btn.onclick = () => run(async () => {
        const ringNo = btn.dataset.score;
        const raw = document.querySelector('[data-race="' + ringNo + '"]').value.split("/");
        await api("/api/pigeons/" + encodeURIComponent(ringNo) + "/races", { method: "POST", body: JSON.stringify({ event: raw[0] || "未命名赛事", distance: Number(raw[1] || 0), rank: Number(raw[2] || 0) }) });
        await load();
      }));
    }

    function renderRelation(data) {
      if (!data) { detail.innerHTML = "<h2>血统查询</h2><p class=\\"meta\\">请输入足环号查看父母、子代、转让和成绩。</p>"; return; }
      const p = data.pigeon;
      detail.innerHTML = "<h2>" + p.ringNo + " 血统档案</h2><div class=\\"relation\\"><div class=\\"small\\"><b>父鸽</b><br>" + (data.father?.ringNo || p.fatherRing || "未登记") + "</div><div class=\\"small\\"><b>本鸽</b><br>" + p.owner + " · " + p.color + "</div><div class=\\"small\\"><b>母鸽</b><br>" + (data.mother?.ringNo || p.motherRing || "未登记") + "</div></div><div><b>子代</b> " + (data.children.map(c => c.ringNo).join("、") || "暂无") + "</div><div class=\\"meta\\">转让：" + (p.transfers.map(t => t.from + "→" + t.to).join(" / ") || "暂无") + "</div><div class=\\"meta\\">归巢：" + (p.races.map(r => r.event + " 第" + r.rank + "名").join(" / ") || "暂无") + "</div>";
    }

    function renderTabs() {
      tabs.innerHTML = FILTERS.map(pair => {
        const key = pair[0];
        const count = key === "all" ? certs.length : certs.filter(c => c.status === key).length;
        return '<button class="' + (certFilter === key ? "on" : "") + '" data-filter="' + key + '">' + pair[1] + " " + count + "</button>";
      }).join("");
      document.querySelectorAll("[data-filter]").forEach(btn => btn.onclick = () => { certFilter = btn.dataset.filter; renderCerts(); });
    }

    function renderCerts() {
      renderTabs();
      const list = certFilter === "all" ? certs : certs.filter(c => c.status === certFilter);
      certlist.innerHTML = list.length ? list.map(c => {
        return '<div class="cert' + (selectedId === c.id ? " sel" : "") + '">'
          + '<div class="row"><b>' + c.id + '</b><span class="pill st-' + c.status + '">' + STATUS_LABEL[c.status] + "</span></div>"
          + "<div>" + c.ringNo + " · 版本 V" + c.version + (c.deliveredAt ? ' · <span class="pill">已交付 ' + (c.deliveredTo || "拍卖方") + "</span>" : "") + "</div>"
          + '<div class="meta">签发 ' + fmt(c.issuedAt) + (c.missing && c.missing.length ? " · 缺项：" + c.missing.map(m => MISSING_LABEL[m] || m).join("、") : "") + "</div>"
          + (c.status === "invalid" ? '<div class="meta">失效 ' + fmt(c.invalidatedAt) + " · " + (REASON_LABEL[c.invalidReason] || c.invalidReason || "") + "</div>" : "")
          + '<div class="row"><button class="ghost" data-view="' + c.id + '">查看签发快照</button>'
          + (c.status !== "invalid" && !c.deliveredAt ? '<button data-deliver="' + c.id + '">交付拍卖方</button>' : "")
          + "</div></div>";
      }).join("") : '<p class="meta">暂无记录</p>';
      document.querySelectorAll("[data-view]").forEach(btn => btn.onclick = () => { selectedId = btn.dataset.view; renderCerts(); renderSnapshot(); });
      document.querySelectorAll("[data-deliver]").forEach(btn => btn.onclick = () => run(async () => {
        const to = prompt("交付给：", "拍卖方");
        if (to === null) return;
        await api("/api/certificates/" + encodeURIComponent(btn.dataset.deliver) + "/deliver", { method: "POST", body: JSON.stringify({ to }) });
        await load();
      }));
    }

    function renderSnapshot() {
      const c = certs.find(item => item.id === selectedId);
      if (!c) {
        snapshotBox.innerHTML = "<h2>签发当刻快照</h2><p class=\\"meta\\">在左侧选择一份证书，查看签发当刻冻结的血统资料；已交付内容失效后仍可查。</p>";
        return;
      }
      const s = c.snapshot;
      const parentLine = (ring, obj) => (ring || "未登记") + (obj ? "（已建档：" + obj.owner + " · " + obj.color + "）" : (ring ? "（未建档）" : ""));
      snapshotBox.innerHTML = "<h2>" + c.id + " 签发当刻快照</h2>"
        + '<div><span class="pill st-' + c.status + '">' + STATUS_LABEL[c.status] + '</span> <span class="pill">' + c.ringNo + " V" + c.version + "</span>"
        + (c.deliveredAt ? ' <span class="pill">已交付 ' + (c.deliveredTo || "拍卖方") + " " + fmt(c.deliveredAt) + "</span>" : "") + "</div>"
        + '<div class="checks">' + c.checks.map(ch => '<div class="check ' + (ch.ok ? "ok" : "bad") + '">' + (ch.ok ? "✓" : "✗") + " " + ch.label + '<span class="meta">' + ch.detail + "</span></div>").join("") + "</div>"
        + '<div class="kv">'
        + "<b>签发时间</b><span>" + fmt(c.issuedAt) + "</span>"
        + (c.invalidatedAt ? "<b>失效时间</b><span>" + fmt(c.invalidatedAt) + "（" + (REASON_LABEL[c.invalidReason] || c.invalidReason || "") + "）</span>" : "")
        + "<b>鸽主</b><span>" + (s.owner || "未登记") + "</span>"
        + "<b>羽色 / 棚号</b><span>" + s.color + " · " + s.loft + "</span>"
        + "<b>父鸽</b><span>" + parentLine(s.fatherRing, s.father) + "</span>"
        + "<b>母鸽</b><span>" + parentLine(s.motherRing, s.mother) + "</span>"
        + "<b>疫苗</b><span>" + (s.vaccines.map(v => v.date + " " + v.name).join("；") || "无记录") + "</span>"
        + "<b>转让</b><span>" + (s.transfers.map(t => t.date + " " + t.from + "→" + t.to).join("；") || "无记录") + "</span>"
        + "</div>";
    }

    async function load() {
      pigeons = await api("/api/pigeons");
      certs = await api("/api/certificates");
      renderCards();
      renderRelation(null);
      renderCerts();
      renderSnapshot();
    }
    document.querySelector("#searchBtn").onclick = () => run(async () => renderRelation(await api("/api/pigeons/" + encodeURIComponent(search.value) + "/relation")));
    document.querySelector("#reload").onclick = () => run(load);
    form.onsubmit = event => {
      event.preventDefault();
      run(async () => {
        await api("/api/pigeons", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
        form.reset();
        await load();
      });
    };
    run(load);
  </script>
</body>
</html>`;
}
