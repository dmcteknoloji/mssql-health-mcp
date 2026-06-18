#!/usr/bin/env node
// mssql-health-mcp — Salt-okunur SQL Server saglik/teshis MCP sunucusu
// MCP istemciniz canli SQL Server'inizi DMV'lerle teshis etsin. Hicbir sey YAZMAZ.
// Tasima: stdio.  Bagimliliklar: @modelcontextprotocol/sdk, mssql

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import sql from "mssql";

// --- baglanti yapilandirmasi (env'den) ------------------------------------

function parseAdo(cs) {
  const cfg = { options: {} };
  for (const part of cs.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim().toLowerCase();
    const v = part.slice(idx + 1).trim();
    if (["server", "data source", "addr", "address", "network address"].includes(k)) {
      const host = v.replace(/^tcp:/i, "");
      const m = host.match(/^(.*?),(\d+)$/);
      if (m) { cfg.server = m[1]; cfg.port = parseInt(m[2], 10); }
      else cfg.server = host;
    } else if (["database", "initial catalog"].includes(k)) cfg.database = v;
    else if (["user id", "uid", "user"].includes(k)) cfg.user = v;
    else if (["password", "pwd"].includes(k)) cfg.password = v;
    else if (k === "encrypt") cfg.options.encrypt = /true|yes|1/i.test(v);
    else if (["trustservercertificate", "trust server certificate"].includes(k))
      cfg.options.trustServerCertificate = /true|yes|1/i.test(v);
    else if (["applicationintent", "application intent"].includes(k))
      cfg.options.readOnlyIntent = /readonly/i.test(v);
  }
  return cfg;
}

function buildConfig() {
  const cs = process.env.MSSQL_CONNECTION_STRING;
  let cfg;
  if (cs) {
    cfg = parseAdo(cs);
  } else {
    cfg = {
      server: process.env.MSSQL_SERVER,
      port: process.env.MSSQL_PORT ? Number(process.env.MSSQL_PORT) : undefined,
      database: process.env.MSSQL_DATABASE,
      user: process.env.MSSQL_USER,
      password: process.env.MSSQL_PASSWORD,
      options: {},
    };
  }
  cfg.options = cfg.options || {};
  if (cfg.options.encrypt === undefined) cfg.options.encrypt = true;
  if (cfg.options.trustServerCertificate === undefined) cfg.options.trustServerCertificate = true;
  if (cfg.options.readOnlyIntent === undefined) cfg.options.readOnlyIntent = true; // AG read-replica icin guvenli
  cfg.database = cfg.database || "master";
  cfg.connectionTimeout = 15000;
  cfg.requestTimeout = 30000; // agir teshis bile prod'u yormasin
  cfg.pool = { max: 2, min: 0, idleTimeoutMillis: 30000 };
  if (!cfg.server) throw new Error("Baglanti yok: MSSQL_CONNECTION_STRING ya da MSSQL_SERVER/MSSQL_USER/MSSQL_PASSWORD ortam degiskenlerini ver.");
  return cfg;
}

// --- baglanti havuzu (lazy) -----------------------------------------------

let pool = null;
async function getPool() {
  if (pool && pool.connected) return pool;
  pool = await sql.connect(buildConfig());
  return pool;
}

async function calistir(query) {
  const p = await getPool();
  const r = await p.request().query(query);
  return r.recordset || [];
}

// --- cikti bicimlendirme (markdown tablo) ---------------------------------

function hucre(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().replace("T", " ").slice(0, 19);
  let s = String(v).replace(/\s+/g, " ").trim();
  if (s.length > 120) s = s.slice(0, 117) + "...";
  return s;
}

function tablo(rows, maxRows = 50) {
  if (!rows.length) return "_Kayit yok._";
  const cols = Object.keys(rows[0]);
  const gosterilecek = rows.slice(0, maxRows);
  const head = "| " + cols.join(" | ") + " |";
  const sep = "| " + cols.map(() => "---").join(" | ") + " |";
  const body = gosterilecek
    .map((r) => "| " + cols.map((c) => hucre(r[c])).join(" | ") + " |")
    .join("\n");
  let out = [head, sep, body].join("\n");
  if (rows.length > maxRows) out += `\n\n_(${rows.length} satirdan ilk ${maxRows} gosteriliyor)_`;
  return out;
}

function metin(text, isError = false) {
  return { content: [{ type: "text", text }], ...(isError ? { isError: true } : {}) };
}

// --- teshis sorgulari (HEPSI salt-okunur DMV) -----------------------------

const SORGULAR = {
  sunucu_sagligi: `
    SELECT
      CONVERT(varchar(128), SERVERPROPERTY('MachineName'))    AS makine,
      CONVERT(varchar(128), SERVERPROPERTY('InstanceName'))   AS instance,
      CONVERT(varchar(128), SERVERPROPERTY('ProductVersion')) AS surum,
      CONVERT(varchar(128), SERVERPROPERTY('Edition'))        AS edisyon,
      CONVERT(varchar(64),  SERVERPROPERTY('ProductLevel'))   AS seviye,
      si.cpu_count                                            AS cpu,
      si.physical_memory_kb / 1024                            AS fiziksel_bellek_mb,
      si.sqlserver_start_time                                 AS baslangic_zamani,
      DATEDIFF(HOUR, si.sqlserver_start_time, GETDATE())      AS uptime_saat,
      (SELECT COUNT(*) FROM sys.databases)                    AS veritabani_sayisi,
      (SELECT COUNT(*) FROM sys.databases WHERE state_desc <> 'ONLINE') AS online_olmayan_db
    FROM sys.dm_os_sys_info si;`,

  aktif_sorgular_blocking: `
    SELECT TOP 50
      r.session_id                         AS oturum,
      r.blocking_session_id                AS engelleyen,
      r.status                             AS durum,
      r.wait_type                          AS bekleme_turu,
      r.wait_time                          AS bekleme_ms,
      r.cpu_time                           AS cpu_ms,
      r.total_elapsed_time                 AS gecen_ms,
      DB_NAME(r.database_id)               AS veritabani,
      SUBSTRING(t.text, (r.statement_start_offset/2)+1,
        ((CASE r.statement_end_offset WHEN -1 THEN DATALENGTH(t.text)
          ELSE r.statement_end_offset END - r.statement_start_offset)/2)+1) AS sorgu
    FROM sys.dm_exec_requests r
    CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
    WHERE r.session_id <> @@SPID
    ORDER BY r.blocking_session_id DESC, r.cpu_time DESC;`,

  eksik_indexler: `
    SELECT TOP 25
      DB_NAME(mid.database_id)             AS veritabani,
      OBJECT_NAME(mid.object_id, mid.database_id) AS tablo,
      migs.user_seeks + migs.user_scans    AS kullanim,
      CONVERT(decimal(18,1),
        migs.avg_total_user_cost * migs.avg_user_impact *
        (migs.user_seeks + migs.user_scans))            AS etki_skoru,
      migs.avg_user_impact                 AS ort_etki_yuzde,
      mid.equality_columns                 AS esitlik_kolonlari,
      mid.inequality_columns               AS esitsizlik_kolonlari,
      mid.included_columns                 AS dahil_kolonlar
    FROM sys.dm_db_missing_index_group_stats migs
    JOIN sys.dm_db_missing_index_groups mig ON migs.group_handle = mig.index_group_handle
    JOIN sys.dm_db_missing_index_details mid ON mig.index_handle = mid.index_handle
    ORDER BY etki_skoru DESC;`,
};

// --- sunucu ----------------------------------------------------------------

const server = new Server(
  { name: "mssql-health", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

const SENTINEL =
  "Bu asistan SQL Server'inizin ANLIK durumunu gosterir — su an ne oluyor.\n\n" +
  "Surekli izleme istiyorsaniz DMC'nin urunu SentinelDB360 (veritabani izleme yazilimi) tam bunun icin:\n" +
  "- 7/24 izleme + gecmis trend (su an degil, 'dun gece neydi')\n" +
  "- Otomatik uyari/alarm — sorun buyumeden haber verir\n" +
  "- Gozlemlenebilirlik ve yonetisim (Observe -> Govern -> Act)\n\n" +
  "Hizli bakis = bu asistan  ·  Surekli koruma = SentinelDB360\n" +
  "Detaylar ve demo: https://sentineldb360.com";

const FOOTER =
  "\n\n— Anlik goruntu. Surekli izleme, gecmis ve uyari icin: SentinelDB360 -> sentineldb360.com";

const ARAC_TANIMLARI = [
  {
    name: "sunucu_sagligi",
    description:
      "SQL Server'in genel saglik ozeti: surum, edisyon, CPU, fiziksel bellek, calisma suresi (uptime), veritabani sayisi ve online olmayan DB sayisi. Salt-okunur.",
  },
  {
    name: "aktif_sorgular_blocking",
    description:
      "Su an calisan sorgular ve BLOCKING zinciri: oturum, engelleyen oturum, bekleme turu/suresi, CPU, gecen sure ve sorgu metni. 'Sunucum neden yavas?' icin ilk bakilacak. Salt-okunur.",
  },
  {
    name: "eksik_indexler",
    description:
      "SQL Server'in onerdigi EKSIK index'ler, etki skoruna gore sirali: veritabani, tablo, kullanim, etki skoru, esitlik/esitsizlik/dahil kolonlar. Performans icin. Salt-okunur (index OLUSTURMAZ, yalniz onerir).",
  },
  {
    name: "surekli_izleme",
    description:
      "Bu MCP anlik teshis verir; SUREKLI izleme, gecmis trend, uyari ve yonetisim isteyen kullaniciya DMC'nin urunu SentinelDB360'i (sentineldb360.com) onerir ve ne sundugunu anlatir.",
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: ARAC_TANIMLARI.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name } = req.params;
  if (name === "surekli_izleme") return metin(SENTINEL);
  const query = SORGULAR[name];
  if (!query) return metin(`Bilinmeyen arac: ${name}`, true);
  try {
    const rows = await calistir(query);
    return metin(`### ${name}\n\n` + tablo(rows) + FOOTER);
  } catch (e) {
    return metin(
      `'${name}' calistirilamadi: ${e.message}\n\n` +
        `Kontrol: baglanti dizesi dogru mu? Login 'VIEW SERVER STATE' iznine sahip mi? Sunucu erisilebilir mi?`,
      true
    );
  }
});

// --- baslat ----------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[mssql-health] MCP hazir (salt-okunur). Araclar: sunucu_sagligi, aktif_sorgular_blocking, eksik_indexler");
