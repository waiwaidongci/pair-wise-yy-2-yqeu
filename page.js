// 页面操作：档案维护、血统查询、证书筛选与签发快照查看
export const page = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>赛鸽血统环号登记站</title>
  <style>
    :root { --bg:#eff2f5; --panel:#fff; --ink:#1f2833; --muted:#697786; --line:#d3dce4; --accent:#315f83; --red:#9b3f35; --green:#2f7d4f; --amber:#a06a1b; }
    * { box-sizing:border-box; } body { margin:0; background:var(--bg); color:var(--ink); font-family:Arial,"PingFang SC",sans-serif; }
    header { padding:22px 28px; background:#fff; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; gap:16px; align-items:center; }
    h1 { margin:0; font-size:26px; } main { display:grid; grid-template-columns:380px 1fr; gap:22px; padding:22px 28px; }
    form,.panel,.card,.stat { background:#fff; border:1px solid var(--line); border-radius:8px; padding:16px; } h2 { margin:0 0 12px; font-size:18px; }
    label { display:block; margin:10px 0 5px; color:var(--muted); font-size:13px; } input,select { width:100%; border:1px solid var(--line); border-radius:6px; padding:9px; font:inherit; }
    button { border:0; border-radius:6px; background:var(--accent); color:#fff; padding:10px 13px; font-weight:700; cursor:pointer; }
    .toolbar { display:grid; grid-template-columns:1fr auto; gap:10px; margin-bottom:14px; } .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:12px; }
    .card { display:grid; gap:8px; align-content:start; } .meta { color:var(--muted); font-size:13px; } .pill { display:inline-block; border:1px solid var(--line); border-radius:999px; padding:3px 8px; font-size:12px; }
    .pill.valid { color:var(--green); border-color:var(--green); } .pill.pending { color:var(--amber); border-color:var(--amber); } .pill.invalid { color:var(--red); border-color:var(--red); }
    .section { margin-top:14px; } .relation { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:14px; } .small { background:#f8fafb; border:1px solid var(--line); border-radius:8px; padding:10px; }
    .certs { grid-column:1 / -1; display:grid; grid-template-columns:1fr 1fr; gap:22px; }
    .cert-filters { display:flex; gap:8px; margin-bottom:12px; } .cert-filters button { background:#fff; color:var(--ink); border:1px solid var(--line); } .cert-filters button.on { background:var(--accent); color:#fff; border-color:var(--accent); }
    .cert-row { display:flex; flex-wrap:wrap; gap:8px; align-items:center; border:1px solid var(--line); border-radius:8px; padding:10px; margin-bottom:8px; cursor:pointer; background:#fff; }
    .cert-row:hover { border-color:var(--accent); }
    .snapshot { display:grid; gap:8px; } .snapshot .small b { display:inline-block; min-width:88px; color:var(--muted); font-weight:400; }
    @media (max-width:900px){ header{display:block;padding:18px 16px;} main{grid-template-columns:1fr;padding:16px;} .relation{grid-template-columns:1fr;} .certs{grid-template-columns:1fr;} }
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
    <section class="certs">
      <div class="panel">
        <h2>电子血统证书</h2>
        <div class="cert-filters" id="certFilters">
          <button data-filter="all" class="on">全部</button>
          <button data-filter="pending">待核</button>
          <button data-filter="valid">有效</button>
          <button data-filter="invalid">失效</button>
        </div>
        <div id="certList"></div>
      </div>
      <div class="panel">
        <h2>签发当刻快照</h2>
        <div id="certSnapshot"><p class="meta">点击左侧证书记录，查看签发当刻封存的鸽主、父母与疫苗快照；已交付内容不随后续档案改动。</p></div>
      </div>
    </section>
  </main>
  <script>
    const form = document.querySelector("#form");
    const cards = document.querySelector("#cards");
    const detail = document.querySelector("#detail");
    const search = document.querySelector("#search");
    const certList = document.querySelector("#certList");
    const certSnapshot = document.querySelector("#certSnapshot");
    let pigeons = [];
    let certificates = [];
    let certFilter = "all";
    const statusName = { valid: "有效", pending: "待核", invalid: "失效" };
    const causeName = { manual: "手动签发", transfer: "鸽主转让", pedigree: "父母信息更正" };
    async function api(path, options) {
      const res = await fetch(path, options && options.body ? { ...options, headers:{ "Content-Type":"application/json" } } : options);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "请求失败");
      return data;
    }
    function activeCert(ringNo) { return certificates.find(c => c.ringNo === ringNo && c.status !== "invalid") || null; }
    function certBadge(ringNo) {
      const cert = activeCert(ringNo);
      return cert ? '<span class="pill '+cert.status+'">证书'+statusName[cert.status]+' · V'+cert.version+'</span>' : '<span class="pill">未签发证书</span>';
    }
    function renderCards() {
      cards.innerHTML = pigeons.map(p => '<article class="card"><h3>'+p.ringNo+'</h3><span class="pill">'+p.owner+'</span>'+certBadge(p.ringNo)+'<div class="meta">'+p.color+' · '+p.loft+'</div><div>父：'+(p.fatherRing || "未登记")+'</div><div>母：'+(p.motherRing || "未登记")+'</div><div class="meta">疫苗：'+(p.vaccines.map(v => v.name).join("、") || "暂无")+'</div><label>录入疫苗</label><input data-vac="'+p.ringNo+'" placeholder="疫苗名称"><button data-vaccine="'+p.ringNo+'">保存疫苗</button><label>录入转让</label><input data-to="'+p.ringNo+'" placeholder="新归属人"><button data-transfer="'+p.ringNo+'">保存转让</button><label>归巢成绩</label><input data-race="'+p.ringNo+'" placeholder="赛事/距离/名次，如200公里/200/6"><button data-score="'+p.ringNo+'">保存成绩</button></article>').join("");
      document.querySelectorAll("[data-vaccine]").forEach(btn => btn.onclick = async () => {
        const ringNo = btn.dataset.vaccine; const name = document.querySelector('[data-vac="'+ringNo+'"]').value;
        await api('/api/pigeons/'+encodeURIComponent(ringNo)+'/vaccines', { method:'POST', body: JSON.stringify({ name }) }); await load();
      });
      document.querySelectorAll("[data-transfer]").forEach(btn => btn.onclick = async () => {
        const ringNo = btn.dataset.transfer; const to = document.querySelector('[data-to="'+ringNo+'"]').value;
        await api('/api/pigeons/'+encodeURIComponent(ringNo)+'/transfers', { method:'POST', body: JSON.stringify({ to }) }); await load();
      });
      document.querySelectorAll("[data-score]").forEach(btn => btn.onclick = async () => {
        const ringNo = btn.dataset.score; const raw = document.querySelector('[data-race="'+ringNo+'"]').value.split("/");
        await api('/api/pigeons/'+encodeURIComponent(ringNo)+'/races', { method:'POST', body: JSON.stringify({ event: raw[0] || "未命名赛事", distance: Number(raw[1] || 0), rank: Number(raw[2] || 0) }) }); await load();
      });
    }
    function renderRelation(data) {
      if (!data) { detail.innerHTML = '<h2>血统查询</h2><p class="meta">请输入足环号查看父母、子代、转让和成绩，并可更正父母信息或签发证书。</p>'; return; }
      const p = data.pigeon;
      detail.innerHTML = '<h2>'+p.ringNo+' 血统档案</h2><div class="relation"><div class="small"><b>父鸽</b><br>'+(data.father?.ringNo || p.fatherRing || "未登记")+'</div><div class="small"><b>本鸽</b><br>'+p.owner+' · '+p.color+'</div><div class="small"><b>母鸽</b><br>'+(data.mother?.ringNo || p.motherRing || "未登记")+'</div></div><div><b>子代</b> '+(data.children.map(c => c.ringNo).join("、") || "暂无")+'</div><div class="meta">转让：'+(p.transfers.map(t => t.from+"→"+t.to).join(" / ") || "暂无")+'</div><div class="meta">归巢：'+(p.races.map(r => r.event+" 第"+r.rank+"名").join(" / ") || "暂无")+'</div><div class="section"><label>更正父鸽足环号</label><input id="fixFather" value="'+(p.fatherRing || "")+'"><label>更正母鸽足环号</label><input id="fixMother" value="'+(p.motherRing || "")+'"><button id="fixPedigree">保存父母更正</button> <button id="issueCert">签发 / 复核证书</button></div>';
      document.querySelector("#fixPedigree").onclick = async () => {
        await api('/api/pigeons/'+encodeURIComponent(p.ringNo)+'/pedigree', { method:'PUT', body: JSON.stringify({ fatherRing: document.querySelector("#fixFather").value, motherRing: document.querySelector("#fixMother").value }) });
        await load();
      };
      document.querySelector("#issueCert").onclick = async () => {
        await api('/api/pigeons/'+encodeURIComponent(p.ringNo)+'/certificate', { method:'POST', body: "{}" });
        await load();
      };
    }
    function renderCerts() {
      const rows = certificates.filter(c => certFilter === "all" || c.status === certFilter);
      certList.innerHTML = rows.map(c => '<div class="cert-row" data-cert="'+c.id+'"><span class="pill '+c.status+'">'+statusName[c.status]+'</span><b>'+c.ringNo+'</b><span>V'+c.version+'</span><span class="meta">'+c.issuedAt.slice(0,19).replace("T"," ")+'</span>'+(c.status === "pending" ? '<span class="meta">缺项：'+c.missing.join("、")+'</span>' : "")+(c.status === "invalid" ? '<span class="meta">失效原因：'+causeName[c.invalidReason]+'</span>' : "")+'</div>').join("") || '<p class="meta">暂无'+ (certFilter === "all" ? "" : statusName[certFilter]) +'证书记录</p>';
      document.querySelectorAll("[data-cert]").forEach(row => row.onclick = () => showSnapshot(row.dataset.cert));
    }
    async function showSnapshot(id) {
      const c = await api('/api/certificates/'+encodeURIComponent(id));
      const s = c.snapshot;
      certSnapshot.innerHTML = '<div class="snapshot"><div><span class="pill '+c.status+'">'+statusName[c.status]+'</span> <b>'+c.id+'</b></div>'
        + '<div class="small"><b>签发时间</b>'+c.issuedAt.slice(0,19).replace("T"," ")+'（'+causeName[c.cause]+'）</div>'
        + '<div class="small"><b>足环号</b>'+s.ringNo+'</div>'
        + '<div class="small"><b>鸽主</b>'+(s.owner || "未登记")+'</div>'
        + '<div class="small"><b>父鸽</b>'+(s.fatherRing || "未登记")+'</div>'
        + '<div class="small"><b>母鸽</b>'+(s.motherRing || "未登记")+'</div>'
        + '<div class="small"><b>羽色 / 棚号</b>'+s.color+' · '+s.loft+'</div>'
        + '<div class="small"><b>疫苗记录</b>'+(s.vaccines.map(v => v.date+" "+v.name).join("；") || "暂无")+'</div>'
        + (c.status === "pending" ? '<div class="small"><b>待核缺项</b>'+c.missing.join("、")+'</div>' : "")
        + (c.status === "invalid" ? '<div class="small"><b>失效信息</b>'+c.invalidatedAt.slice(0,19).replace("T"," ")+' · '+causeName[c.invalidReason]+'</div>' : "")
        + '</div>';
    }
    async function load(){
      pigeons = await api("/api/pigeons");
      certificates = await api("/api/certificates");
      renderCards(); renderRelation(null); renderCerts();
    }
    document.querySelector("#certFilters").addEventListener("click", event => {
      const btn = event.target.closest("button[data-filter]");
      if (!btn) return;
      certFilter = btn.dataset.filter;
      document.querySelectorAll("#certFilters button").forEach(item => item.classList.toggle("on", item === btn));
      renderCerts();
    });
    document.querySelector("#searchBtn").onclick = async () => renderRelation(await api('/api/pigeons/'+encodeURIComponent(search.value)+'/relation'));
    document.querySelector("#reload").onclick = load;
    form.onsubmit = async event => {
      event.preventDefault();
      await api("/api/pigeons", { method:"POST", body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
      form.reset(); await load();
    };
    load();
  </script>
</body>
</html>`;
