// 证书判定：签发前核对、缺项待核、版本换发与失效规则
import { findPigeon } from "./archiveStore.js";

export const CERT_STATUS = { PENDING: "pending", VALID: "valid", INVALID: "invalid" };
const ACTIVE_STATUSES = [CERT_STATUS.PENDING, CERT_STATUS.VALID];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

// 签发前核对：鸽主、父母档、疫苗记录
export function evaluatePigeon(db, pigeon) {
  const father = pigeon.fatherRing ? findPigeon(db, pigeon.fatherRing) : null;
  const mother = pigeon.motherRing ? findPigeon(db, pigeon.motherRing) : null;
  const checks = [
    {
      key: "owner", label: "鸽主",
      ok: Boolean(pigeon.owner && pigeon.owner.trim()),
      detail: pigeon.owner ? "现任鸽主：" + pigeon.owner : "未登记鸽主"
    },
    {
      key: "father", label: "父鸽档案",
      ok: Boolean(pigeon.fatherRing && father),
      detail: !pigeon.fatherRing ? "未登记父鸽足环" : father ? "父鸽 " + pigeon.fatherRing + " 已建档" : "父鸽 " + pigeon.fatherRing + " 未建档"
    },
    {
      key: "mother", label: "母鸽档案",
      ok: Boolean(pigeon.motherRing && mother),
      detail: !pigeon.motherRing ? "未登记母鸽足环" : mother ? "母鸽 " + pigeon.motherRing + " 已建档" : "母鸽 " + pigeon.motherRing + " 未建档"
    },
    {
      key: "vaccines", label: "疫苗记录",
      ok: pigeon.vaccines.length > 0,
      detail: pigeon.vaccines.length ? pigeon.vaccines.length + " 条疫苗记录" : "无疫苗记录"
    }
  ];
  const missing = checks.filter(item => !item.ok).map(item => item.key);
  return { checks, missing, passed: missing.length === 0, father, mother };
}

// 签发当刻快照：把档案当前值和已解析的父母档冻结进证书，之后档案再改也不影响本证书
export function buildSnapshot(db, pigeon) {
  const { father, mother } = evaluatePigeon(db, pigeon);
  const parentView = item => (item ? { ringNo: item.ringNo, owner: item.owner, color: item.color, loft: item.loft } : null);
  return {
    ringNo: pigeon.ringNo,
    owner: pigeon.owner,
    fatherRing: pigeon.fatherRing,
    motherRing: pigeon.motherRing,
    color: pigeon.color,
    loft: pigeon.loft,
    vaccines: clone(pigeon.vaccines),
    transfers: clone(pigeon.transfers),
    father: parentView(father),
    mother: parentView(mother)
  };
}

export function activeCertificate(db, ringNo) {
  return db.certificates.find(cert => cert.ringNo === ringNo && ACTIVE_STATUSES.includes(cert.status)) || null;
}

function nextVersion(db, ringNo) {
  return db.certificates.reduce((max, cert) => (cert.ringNo === ringNo ? Math.max(max, cert.version) : max), 0) + 1;
}

function sameIssue(certificate, evaluation, snapshot) {
  return JSON.stringify(certificate.snapshot) === JSON.stringify(snapshot)
    && JSON.stringify(certificate.missing) === JSON.stringify(evaluation.missing);
}

// 签发/换发：每羽同一时间只保留一份有效（含待核）证书；
// 档案值或核对结果有变化时，原证书失效并按新值生成下一版本，否则返回当前证书
export function issueCertificate(db, ringNo, reason = "reissue") {
  const pigeon = findPigeon(db, ringNo);
  if (!pigeon) return { error: "pigeon_not_found" };
  const evaluation = evaluatePigeon(db, pigeon);
  const snapshot = buildSnapshot(db, pigeon);
  const current = activeCertificate(db, ringNo);
  if (current && sameIssue(current, evaluation, snapshot)) return { certificate: current, created: false };
  const now = new Date().toISOString();
  if (current) {
    current.status = CERT_STATUS.INVALID;
    current.invalidatedAt = now;
    current.invalidReason = reason;
  }
  const certificate = {
    id: "CERT-" + String(++db.certSeq).padStart(4, "0"),
    ringNo,
    version: nextVersion(db, ringNo),
    status: evaluation.passed ? CERT_STATUS.VALID : CERT_STATUS.PENDING,
    issuedAt: now,
    invalidatedAt: null,
    invalidReason: null,
    checks: evaluation.checks,
    missing: evaluation.missing,
    snapshot,
    deliveredAt: null,
    deliveredTo: null
  };
  db.certificates.push(certificate);
  return { certificate, created: true };
}

// 档案变动后联动刷新：只处理已签发证书的鸽只，未签发的不自动出证
export function syncCertificates(db, ringNos, reason) {
  const renewed = [];
  for (const ringNo of [...new Set(ringNos)]) {
    if (!activeCertificate(db, ringNo)) continue;
    const result = issueCertificate(db, ringNo, reason);
    if (result.created) renewed.push(result.certificate);
  }
  return renewed;
}

export function listCertificates(db, { status, ringNo } = {}) {
  if (status && !Object.values(CERT_STATUS).includes(status)) return { error: "invalid_status" };
  const certificates = db.certificates
    .filter(cert => (!status || cert.status === status) && (!ringNo || cert.ringNo === ringNo))
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt) || b.id.localeCompare(a.id));
  return { certificates };
}

export function getCertificate(db, id) {
  return db.certificates.find(cert => cert.id === id) || null;
}

// 交付拍卖方：交付内容永久可查，即使之后因转让/父母更正而失效
export function markDelivered(db, id, to) {
  const certificate = getCertificate(db, id);
  if (!certificate) return { error: "certificate_not_found" };
  if (certificate.status === CERT_STATUS.INVALID) return { error: "certificate_invalid" };
  if (certificate.deliveredAt) return { error: "already_delivered" };
  certificate.deliveredAt = new Date().toISOString();
  certificate.deliveredTo = to && to.trim() ? to.trim() : "拍卖方";
  return { certificate };
}
