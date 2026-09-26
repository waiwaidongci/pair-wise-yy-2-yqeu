import http from "node:http";
import {
  loadDb, saveDb, relation,
  createPigeon, addTransfer, addRace, addVaccine, correctParents, childrenOf
} from "./src/archiveStore.js";
import {
  issueCertificate, syncCertificates, listCertificates, getCertificate, markDelivered
} from "./src/certificates.js";
import { renderPage } from "./src/page.js";

const port = Number(process.env.PORT || 3024);

async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}
function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}
function sendError(res, status, error) {
  sendJson(res, status, { error });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const db = await loadDb();

    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(renderPage());
    }

    if (req.method === "GET" && url.pathname === "/api/pigeons") return sendJson(res, 200, db.pigeons);

    if (req.method === "POST" && url.pathname === "/api/pigeons") {
      const result = createPigeon(db, await body(req));
      if (result.error) return sendError(res, result.error === "ring_exists" ? 409 : 400, result.error);
      // 新档案可能补上了别人缺失的父母档，联动刷新相关证书
      syncCertificates(db, childrenOf(db, result.pigeon.ringNo).map(item => item.ringNo), "archive_supplement");
      await saveDb(db);
      return sendJson(res, 201, result.pigeon);
    }

    const relationMatch = url.pathname.match(/^\/api\/pigeons\/(.+)\/relation$/);
    if (relationMatch && req.method === "GET") {
      const data = relation(db, decodeURIComponent(relationMatch[1]));
      return data ? sendJson(res, 200, data) : sendError(res, 404, "pigeon_not_found");
    }

    // 签发/重新核对证书：缺项留待核，内容有变化才换发新版本
    const issueMatch = url.pathname.match(/^\/api\/pigeons\/(.+)\/certificate$/);
    if (issueMatch && req.method === "POST") {
      const result = issueCertificate(db, decodeURIComponent(issueMatch[1]), "reissue");
      if (result.error) return sendError(res, 404, result.error);
      await saveDb(db);
      return sendJson(res, result.created ? 201 : 200, result.certificate);
    }

    // 父母信息更正：原证书失效并按新值生成版本
    const parentsMatch = url.pathname.match(/^\/api\/pigeons\/(.+)\/parents$/);
    if (parentsMatch && req.method === "POST") {
      const ringNo = decodeURIComponent(parentsMatch[1]);
      const result = correctParents(db, ringNo, await body(req));
      if (result.error) return sendError(res, result.error === "pigeon_not_found" ? 404 : 400, result.error);
      syncCertificates(db, [ringNo], "parent_correction");
      await saveDb(db);
      return sendJson(res, 200, result.pigeon);
    }

    const actionMatch = url.pathname.match(/^\/api\/pigeons\/(.+)\/(transfers|races|vaccines)$/);
    if (actionMatch && req.method === "POST") {
      const ringNo = decodeURIComponent(actionMatch[1]);
      const action = actionMatch[2];
      const input = await body(req);
      const result = action === "transfers" ? addTransfer(db, ringNo, input)
        : action === "races" ? addRace(db, ringNo, input)
        : addVaccine(db, ringNo, input);
      if (result.error) return sendError(res, result.error === "pigeon_not_found" ? 404 : 400, result.error);
      // 转让换发新版本；补疫苗后重新核对，待核可转有效
      if (action === "transfers") syncCertificates(db, [ringNo], "transfer");
      if (action === "vaccines") syncCertificates(db, [ringNo], "vaccine_supplement");
      await saveDb(db);
      return sendJson(res, 200, result.pigeon);
    }

    // 证书筛选：?status=pending|valid|invalid&ringNo=
    if (req.method === "GET" && url.pathname === "/api/certificates") {
      const result = listCertificates(db, { status: url.searchParams.get("status"), ringNo: url.searchParams.get("ringNo") });
      if (result.error) return sendError(res, 400, result.error);
      return sendJson(res, 200, result.certificates);
    }

    // 单份证书（含签发当刻快照），失效/已交付的也可查
    const certMatch = url.pathname.match(/^\/api\/certificates\/([^/]+)$/);
    if (certMatch && req.method === "GET") {
      const certificate = getCertificate(db, decodeURIComponent(certMatch[1]));
      return certificate ? sendJson(res, 200, certificate) : sendError(res, 404, "certificate_not_found");
    }

    // 交付拍卖方
    const deliverMatch = url.pathname.match(/^\/api\/certificates\/([^/]+)\/deliver$/);
    if (deliverMatch && req.method === "POST") {
      const input = await body(req);
      const result = markDelivered(db, decodeURIComponent(deliverMatch[1]), input.to);
      if (result.error) return sendError(res, result.error === "certificate_not_found" ? 404 : 409, result.error);
      await saveDb(db);
      return sendJson(res, 200, result.certificate);
    }

    sendError(res, 404, "not_found");
  } catch (error) {
    sendError(res, 500, error.message);
  }
});

server.listen(port, () => console.log(`Racing pigeon registry app listening on http://localhost:${port}`));
