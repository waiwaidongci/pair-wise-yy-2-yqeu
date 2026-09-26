// 证书判定：签发前核对父母档、鸽主和疫苗记录；转让或父母更正后作废旧证并按新值生成版本。
// 每羽同一时间只认一份有效证书，已交付（含已失效）的证书快照永久保留可查。

export const CERT_STATUS = ["valid", "pending", "invalid"];

// 核对签发条件，返回缺项清单（为空即可签发有效证书）
export function evaluatePigeon(db, pigeon) {
  const missing = [];
  if (!pigeon.owner) missing.push("鸽主");
  if (!pigeon.fatherRing || !db.pigeons.some(item => item.ringNo === pigeon.fatherRing)) missing.push("父鸽档案");
  if (!pigeon.motherRing || !db.pigeons.some(item => item.ringNo === pigeon.motherRing)) missing.push("母鸽档案");
  if (!Array.isArray(pigeon.vaccines) || pigeon.vaccines.length === 0) missing.push("疫苗记录");
  return missing;
}

// 当前在用的证书（有效或待核），每羽至多一份
export function activeCertificate(db, ringNo) {
  return db.certificates.find(item => item.ringNo === ringNo && item.status !== "invalid") || null;
}

// 签发当刻快照：深拷贝当前档案值，之后档案改动不影响已交付内容
function takeSnapshot(pigeon) {
  return {
    ringNo: pigeon.ringNo,
    owner: pigeon.owner,
    fatherRing: pigeon.fatherRing || "",
    motherRing: pigeon.motherRing || "",
    color: pigeon.color,
    loft: pigeon.loft,
    vaccines: (pigeon.vaccines || []).map(item => ({ ...item })),
    takenAt: new Date().toISOString()
  };
}

// 签发新版本：旧证（如有）先失效，再按当前档案值判定并生成新证书
export function issueCertificate(db, pigeon, cause = "manual") {
  const now = new Date().toISOString();
  const previous = activeCertificate(db, pigeon.ringNo);
  if (previous) {
    previous.status = "invalid";
    previous.invalidatedAt = now;
    previous.invalidReason = cause;
  }
  const missing = evaluatePigeon(db, pigeon);
  const version = db.certificates.filter(item => item.ringNo === pigeon.ringNo).length + 1;
  const certificate = {
    id: `CERT-${pigeon.ringNo}-V${version}`,
    ringNo: pigeon.ringNo,
    version,
    status: missing.length ? "pending" : "valid",
    missing,
    cause,
    snapshot: takeSnapshot(pigeon),
    issuedAt: now,
    invalidatedAt: null,
    invalidReason: null
  };
  db.certificates.push(certificate);
  return certificate;
}

// 转让或父母信息更正后调用：仅当该羽已有在用证书时，作废旧证并按新值生成版本
export function refreshCertificateOnChange(db, pigeon, cause) {
  if (!activeCertificate(db, pigeon.ringNo)) return null;
  return issueCertificate(db, pigeon, cause);
}

export function listCertificates(db, { status, ringNo } = {}) {
  return db.certificates
    .filter(item => (!status || !CERT_STATUS.includes(status) || item.status === status) && (!ringNo || item.ringNo === ringNo))
    .slice()
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}

export function findCertificate(db, id) {
  return db.certificates.find(item => item.id === id) || null;
}
