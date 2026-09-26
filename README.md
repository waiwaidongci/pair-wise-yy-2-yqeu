# 赛鸽血统环号登记站

运行：

```bash
npm start
```

访问`http://localhost:3024`。支持档案、血统查询、转让、归巢成绩和电子血统证书。

## 电子血统证书

- 每羽同一时间只认一份有效证书；签发前核对父母档、鸽主和疫苗记录，缺项先留待核。
- 转让或父母信息更正后，原证书自动失效并按新值生成新版本，已交付的证书快照仍可查询。
- 页面可按待核 / 有效 / 失效筛选证书记录，点击记录可查看签发当刻快照。

代码分层：`certificates.js` 负责证书判定，`store.js` 负责档案保存，`page.js` 负责页面操作，`server.js` 只做 HTTP 接线。

主要接口：

- `POST /api/pigeons/:ringNo/certificate` 签发 / 复核证书
- `PUT /api/pigeons/:ringNo/pedigree` 更正父母信息（触发旧证失效、生成新版本）
- `POST /api/pigeons/:ringNo/transfers` 录入转让（同上触发换版）
- `GET /api/certificates?status=pending|valid|invalid&ringNo=` 证书列表筛选
- `GET /api/certificates/:id` 查看单份证书及签发当刻快照
