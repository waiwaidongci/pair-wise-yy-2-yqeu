import http from "node:http";
import { loadDb, saveDb, findPigeon, relation } from "./store.js";
import { issueCertificate, refreshCertificateOnChange, listCertificates, findCertificate } from "./certificates.js";
import { page } from "./page.js";

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

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const db = await loadDb();
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type":"text/html; charset=utf-8" });
      return res.end(page);
    }
    if (req.method === "GET" && url.pathname === "/api/pigeons") return sendJson(res, 200, db.pigeons);
    if (req.method === "POST" && url.pathname === "/api/pigeons") {
      const input = await body(req);
      if (db.pigeons.some(item => item.ringNo === input.ringNo)) return sendJson(res, 409, { error: "ring_exists" });
      const pigeon = { ...input, vaccines: [], transfers: [], races: [] };
      db.pigeons.unshift(pigeon);
      await saveDb(db);
      return sendJson(res, 201, pigeon);
    }
    if (req.method === "GET" && url.pathname === "/api/certificates") {
      return sendJson(res, 200, listCertificates(db, { status: url.searchParams.get("status"), ringNo: url.searchParams.get("ringNo") }));
    }
    const certificateMatch = url.pathname.match(/^\/api\/certificates\/([^/]+)$/);
    if (certificateMatch && req.method === "GET") {
      const certificate = findCertificate(db, decodeURIComponent(certificateMatch[1]));
      return certificate ? sendJson(res, 200, certificate) : sendJson(res, 404, { error: "certificate_not_found" });
    }
    const relationMatch = url.pathname.match(/^\/api\/pigeons\/([^/]+)\/relation$/);
    if (relationMatch && req.method === "GET") {
      const data = relation(db, decodeURIComponent(relationMatch[1]));
      return data ? sendJson(res, 200, data) : sendJson(res, 404, { error: "pigeon_not_found" });
    }
    const pigeonMatch = url.pathname.match(/^\/api\/pigeons\/([^/]+)\/(pedigree|certificate)$/);
    if (pigeonMatch && (req.method === "PUT" || req.method === "POST")) {
      const pigeon = findPigeon(db, decodeURIComponent(pigeonMatch[1]));
      if (!pigeon) return sendJson(res, 404, { error: "pigeon_not_found" });
      if (pigeonMatch[2] === "pedigree" && req.method === "PUT") {
        const input = await body(req);
        pigeon.fatherRing = input.fatherRing || "";
        pigeon.motherRing = input.motherRing || "";
        const certificate = refreshCertificateOnChange(db, pigeon, "pedigree");
        await saveDb(db);
        return sendJson(res, 200, { pigeon, certificate });
      }
      if (pigeonMatch[2] === "certificate" && req.method === "POST") {
        const certificate = issueCertificate(db, pigeon, "manual");
        await saveDb(db);
        return sendJson(res, 201, certificate);
      }
    }
    const actionMatch = url.pathname.match(/^\/api\/pigeons\/([^/]+)\/(transfers|races|vaccines)$/);
    if (actionMatch && req.method === "POST") {
      const pigeon = findPigeon(db, decodeURIComponent(actionMatch[1]));
      if (!pigeon) return sendJson(res, 404, { error: "pigeon_not_found" });
      const input = await body(req);
      let certificate = null;
      if (actionMatch[2] === "transfers") {
        const transfer = { date: input.date || new Date().toISOString().slice(0, 10), from: pigeon.owner, to: input.to };
        pigeon.owner = input.to;
        pigeon.transfers.push(transfer);
        certificate = refreshCertificateOnChange(db, pigeon, "transfer");
      }
      if (actionMatch[2] === "races") pigeon.races.push({ date: input.date || new Date().toISOString().slice(0, 10), event: input.event, distance: Number(input.distance || 0), returnTime: input.returnTime || "", rank: Number(input.rank || 0) });
      if (actionMatch[2] === "vaccines") pigeon.vaccines.push({ date: input.date || new Date().toISOString().slice(0, 10), name: input.name });
      await saveDb(db);
      return sendJson(res, 200, { pigeon, certificate });
    }
    sendJson(res, 404, { error: "not_found" });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(port, () => console.log(`Racing pigeon registry app listening on http://localhost:${port}`));
