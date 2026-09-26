# 赛鸽血统环号登记站

运行：

```bash
npm start
```

访问`http://localhost:3024`。支持档案、血统查询、转让、归巢成绩与电子血统证书。

## 模块划分

- `src/certificates.js` 证书判定：签发前核对（鸽主、父母档、疫苗记录）、缺项待核、换发与失效规则
- `src/archiveStore.js` 档案保存：鸽只档案与证书的读写、旧数据迁移、档案变更
- `src/page.js` 页面操作：档案卡片、证书筛选（待核/有效/失效）、签发当刻快照查看
- `server.js` HTTP 路由，串联以上三个业务文件

## 证书规则

- 每羽同一时间只认一份有效（含待核）证书
- 签发前核对鸽主、父母档案、疫苗记录，缺项先留待核
- 转让或父母信息更正后，原证书失效并按新值生成下一版本；补齐缺项后待核自动转有效
- 已交付拍卖方的内容永久可查，证书失效后快照仍保留签发当刻的血统资料

## 证书接口

- `POST /api/pigeons/:ringNo/certificate` 签发 / 重新核对
- `POST /api/pigeons/:ringNo/parents` 父母信息更正（联动换发）
- `GET /api/certificates?status=pending|valid|invalid&ringNo=` 筛选
- `GET /api/certificates/:id` 单份证书与签发当刻快照
- `POST /api/certificates/:id/deliver` 交付拍卖方
