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
      CONVERT(varchar(128), SERVERPROPERTY('Edition'))        AS edition,
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

  bekleme_istatistikleri: `
    SELECT TOP 20
      wait_type AS bekleme_turu,
      waiting_tasks_count AS bekleyen_gorev,
      CONVERT(decimal(18,1), wait_time_ms/1000.0) AS toplam_bekleme_sn,
      CONVERT(decimal(18,1), (wait_time_ms - signal_wait_time_ms)/1000.0) AS kaynak_bekleme_sn,
      CONVERT(decimal(18,1), signal_wait_time_ms/1000.0) AS sinyal_bekleme_sn,
      CONVERT(decimal(5,2), 100.0 * wait_time_ms / NULLIF(SUM(wait_time_ms) OVER(), 0)) AS yuzde
    FROM sys.dm_os_wait_stats
    WHERE waiting_tasks_count > 0
      AND wait_type NOT IN (
        'CLR_SEMAPHORE','LAZYWRITER_SLEEP','RESOURCE_QUEUE','SLEEP_TASK','SLEEP_SYSTEMTASK',
        'SQLTRACE_BUFFER_FLUSH','WAITFOR','LOGMGR_QUEUE','CHECKPOINT_QUEUE','REQUEST_FOR_DEADLOCK_SEARCH',
        'XE_TIMER_EVENT','BROKER_TO_FLUSH','BROKER_TASK_STOP','CLR_MANUAL_EVENT','CLR_AUTO_EVENT',
        'DISPATCHER_QUEUE_SEMAPHORE','FT_IFTS_SCHEDULER_IDLE_WAIT','XE_DISPATCHER_WAIT','XE_DISPATCHER_JOIN',
        'BROKER_EVENTHANDLER','TRACEWRITE','FT_IFTSHC_MUTEX','SQLTRACE_INCREMENTAL_FLUSH_SLEEP',
        'BROKER_RECEIVE_WAITFOR','ONDEMAND_TASK_QUEUE','DBMIRROR_EVENTS_QUEUE','DBMIRRORING_CMD',
        'BROKER_TRANSMITTER','SQLTRACE_WAIT_ENTRIES','SLEEP_BPOOL_FLUSH','SQLTRACE_LOCK',
        'DIRTY_PAGE_POLL','SP_SERVER_DIAGNOSTICS_SLEEP','HADR_WORK_QUEUE','HADR_TIMER_TASK',
        'HADR_CLUSAPI_CALL','QDS_PERSIST_TASK_MAIN_LOOP_SLEEP','QDS_ASYNC_QUEUE','QDS_SHUTDOWN_QUEUE',
        'REDO_THREAD_PENDING_WORK','SLEEP_DBSTARTUP','SLEEP_MASTERDBREADY','SLEEP_MSDBSTARTUP',
        'SLEEP_TEMPDBSTARTUP','WAIT_XTP_HOST_WAIT','WAIT_XTP_OFFLINE_CKPT_NEW_LOG','WAIT_XTP_CKPT_CLOSE',
        'XE_LIVE_TARGET_TVF','PWAIT_ALL_COMPONENTS_INITIALIZED','PREEMPTIVE_XE_GETTARGETSTATE',
        'SOS_WORK_DISPATCHER','QDS_SHUTDOWN_QUEUE','WAIT_XTP_RECOVERY','PVS_PREALLOCATE','PREEMPTIVE_OS_FLUSHFILEBUFFERS',
        'HADR_FILESTREAM_IOMGR_IOCOMPLETION','AZURE_IMDS_VERSIONS','VDI_CLIENT_OTHER',
        'PARALLEL_REDO_DRAIN_WORKER','PARALLEL_REDO_LOG_CACHE','PARALLEL_REDO_TRAN_LIST','PARALLEL_REDO_WORKER_SYNC','PARALLEL_REDO_WORKER_WAIT_WORK','PREEMPTIVE_HADR_LEASE_MECHANISM','STARTUP_DEPENDENCY_MANAGER','WAIT_XTP_HOST_WAIT','PARALLEL_REDO_WORKER_WAIT_FOR_BARRIER','PWAIT_EXTENSIBILITY_CLEANUP_TASK','CHKPT'
      )
    ORDER BY wait_time_ms DESC;`,

  log_kullanimi: `DBCC SQLPERF(LOGSPACE);`,

  disk_dosya: `
    SELECT
      DB_NAME(mf.database_id) AS veritabani,
      mf.name                 AS mantiksal_ad,
      mf.type_desc            AS tur,
      CONVERT(decimal(18,1), mf.size * 8.0 / 1024) AS dosya_mb,
      vs.volume_mount_point   AS disk,
      CONVERT(decimal(18,1), vs.available_bytes / 1048576.0) AS disk_bos_mb,
      CONVERT(decimal(5,1), 100.0 * vs.available_bytes / NULLIF(vs.total_bytes, 0)) AS disk_bos_yuzde
    FROM sys.master_files mf
    CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.file_id) vs
    ORDER BY vs.available_bytes ASC;`,

  yedek_durumu: `
    SELECT
      d.name                 AS veritabani,
      d.recovery_model_desc  AS kurtarma_modeli,
      MAX(CASE WHEN b.type = 'D' THEN b.backup_finish_date END) AS son_full,
      MAX(CASE WHEN b.type = 'I' THEN b.backup_finish_date END) AS son_diff,
      MAX(CASE WHEN b.type = 'L' THEN b.backup_finish_date END) AS son_log,
      DATEDIFF(HOUR, MAX(CASE WHEN b.type = 'D' THEN b.backup_finish_date END), GETDATE()) AS full_kac_saat_once
    FROM sys.databases d
    LEFT JOIN msdb.dbo.backupset b ON b.database_name = d.name
    WHERE d.database_id > 4 AND d.state_desc = 'ONLINE'
    GROUP BY d.name, d.recovery_model_desc
    ORDER BY CASE WHEN MAX(CASE WHEN b.type = 'D' THEN b.backup_finish_date END) IS NULL THEN 0 ELSE 1 END,
             full_kac_saat_once DESC;`,

  tempdb_kullanimi: `
    SELECT
      CONVERT(decimal(18,1), SUM(user_object_reserved_page_count)     * 8.0/1024) AS kullanici_nesneleri_mb,
      CONVERT(decimal(18,1), SUM(internal_object_reserved_page_count) * 8.0/1024) AS dahili_nesneler_mb,
      CONVERT(decimal(18,1), SUM(version_store_reserved_page_count)   * 8.0/1024) AS surum_deposu_mb,
      CONVERT(decimal(18,1), SUM(unallocated_extent_page_count)       * 8.0/1024) AS bos_mb,
      CONVERT(decimal(18,1), SUM(total_page_count)                    * 8.0/1024) AS toplam_mb
    FROM tempdb.sys.dm_db_file_space_usage;`,

  deadlock: `
    SELECT
      q.x.value('(@timestamp)[1]', 'datetime2') AS deadlock_zamani
    FROM (
      SELECT CAST(t.target_data AS xml) AS td
      FROM sys.dm_xe_sessions s
      JOIN sys.dm_xe_session_targets t ON t.event_session_address = s.address
      WHERE s.name = 'system_health' AND t.target_name = 'ring_buffer'
    ) r
    CROSS APPLY r.td.nodes('RingBufferTarget/event[@name="xml_deadlock_report"]') AS q(x)
    ORDER BY deadlock_zamani DESC;`,

  pahali_sorgular: `
    SELECT TOP 20
      CONVERT(decimal(18,1), qs.total_worker_time/1000.0/NULLIF(qs.execution_count,0)) AS ort_cpu_ms,
      CONVERT(decimal(18,1), qs.total_elapsed_time/1000.0/NULLIF(qs.execution_count,0)) AS ort_sure_ms,
      qs.total_logical_reads/NULLIF(qs.execution_count,0) AS ort_okuma,
      qs.execution_count AS calisma,
      CONVERT(decimal(18,1), qs.total_worker_time/1000.0) AS toplam_cpu_ms,
      DB_NAME(st.dbid) AS veritabani,
      SUBSTRING(st.text, (qs.statement_start_offset/2)+1,
        ((CASE qs.statement_end_offset WHEN -1 THEN DATALENGTH(st.text)
          ELSE qs.statement_end_offset END - qs.statement_start_offset)/2)+1) AS sorgu
    FROM sys.dm_exec_query_stats qs
    CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
    ORDER BY qs.total_worker_time DESC;`,

  index_sagligi: `
    SELECT TOP 25
      OBJECT_NAME(s.object_id) AS tablo,
      i.name                   AS index_adi,
      s.user_seeks + s.user_scans + s.user_lookups AS okuma,
      s.user_updates           AS yazma,
      s.last_user_update       AS son_yazma
    FROM sys.dm_db_index_usage_stats s
    JOIN sys.indexes i ON i.object_id = s.object_id AND i.index_id = s.index_id
    WHERE s.database_id = DB_ID() AND i.type_desc = 'NONCLUSTERED' AND i.is_primary_key = 0
      AND (s.user_seeks + s.user_scans + s.user_lookups) = 0 AND s.user_updates > 0
    ORDER BY s.user_updates DESC;`,

  eksik_index_create: `
    SELECT TOP 15
      DB_NAME(mid.database_id) AS veritabani,
      CONVERT(decimal(18,1), migs.avg_total_user_cost * migs.avg_user_impact *
        (migs.user_seeks + migs.user_scans)) AS etki,
      'CREATE INDEX IX_' + OBJECT_NAME(mid.object_id, mid.database_id) + '_'
        + CONVERT(varchar(20), mig.index_group_handle) + ' ON ' + mid.statement
        + ' (' + ISNULL(mid.equality_columns, '')
        + CASE WHEN mid.equality_columns IS NOT NULL AND mid.inequality_columns IS NOT NULL THEN ',' ELSE '' END
        + ISNULL(mid.inequality_columns, '') + ')'
        + ISNULL(' INCLUDE (' + mid.included_columns + ')', '') AS create_cumlesi
    FROM sys.dm_db_missing_index_group_stats migs
    JOIN sys.dm_db_missing_index_groups mig ON migs.group_handle = mig.index_group_handle
    JOIN sys.dm_db_missing_index_details mid ON mig.index_handle = mid.index_handle
    ORDER BY etki DESC;`,

  konfig_denetimi: `
    SELECT name AS ayar, CONVERT(varchar(40), value_in_use) AS deger,
      CASE
        WHEN name='max degree of parallelism' AND CONVERT(int,value_in_use)=0
          THEN 'DIKKAT: 0=sinirsiz; CPU/is yukune gore ayarla (OLTP riskli)'
        WHEN name='cost threshold for parallelism' AND CONVERT(int,value_in_use)<25
          THEN 'DIKKAT: cok dusuk; 25-50 onerilir'
        WHEN name='max server memory (MB)' AND CONVERT(bigint,value_in_use)>=2147483647
          THEN 'DIKKAT: sinirsiz; OS icin RAM birak'
        WHEN name='optimize for ad hoc workloads' AND CONVERT(int,value_in_use)=0
          THEN 'DIKKAT: 1 onerilir (plan cache sismesini azaltir)'
        WHEN name='backup compression default' AND CONVERT(int,value_in_use)=0
          THEN 'DIKKAT: 1 onerilir (yedek hizli/kucuk)'
        ELSE 'uygun'
      END AS durum
    FROM sys.configurations
    WHERE name IN ('max degree of parallelism','cost threshold for parallelism',
      'max server memory (MB)','optimize for ad hoc workloads','backup compression default');`,

  bellek_baskisi: `
    SELECT
      (SELECT cntr_value FROM sys.dm_os_performance_counters
        WHERE counter_name = 'Page life expectancy' AND object_name LIKE '%Buffer Manager%') AS ple_saniye,
      (SELECT cntr_value FROM sys.dm_os_performance_counters
        WHERE counter_name = 'Memory Grants Pending' AND object_name LIKE '%Memory Manager%') AS bekleyen_bellek_talebi,
      (SELECT CONVERT(decimal(18,1), total_physical_memory_kb/1048576.0) FROM sys.dm_os_sys_memory) AS toplam_ram_gb,
      (SELECT CONVERT(decimal(18,1), available_physical_memory_kb/1048576.0) FROM sys.dm_os_sys_memory) AS bos_ram_gb,
      (SELECT system_memory_state_desc FROM sys.dm_os_sys_memory) AS bellek_durumu;`,

  vlf_log_sagligi: `
    SELECT d.name AS veritabani,
      (SELECT COUNT(*) FROM sys.dm_db_log_info(d.database_id)) AS vlf_sayisi,
      d.log_reuse_wait_desc AS log_neden_buyuyor,
      d.recovery_model_desc AS kurtarma_modeli
    FROM sys.databases d
    WHERE d.state_desc = 'ONLINE'
    ORDER BY vlf_sayisi DESC;`,

  acik_transactionlar: `
    SELECT TOP 20
      s.session_id           AS oturum,
      s.login_name           AS login,
      DB_NAME(dt.database_id) AS veritabani,
      DATEDIFF(SECOND, dt.database_transaction_begin_time, GETDATE()) AS sure_sn,
      CONVERT(decimal(18,1), dt.database_transaction_log_bytes_used/1048576.0) AS log_mb,
      s.status               AS durum,
      s.host_name            AS makine,
      s.program_name         AS uygulama
    FROM sys.dm_tran_database_transactions dt
    JOIN sys.dm_tran_session_transactions stx ON stx.transaction_id = dt.transaction_id
    JOIN sys.dm_exec_sessions s ON s.session_id = stx.session_id
    WHERE dt.database_transaction_begin_time IS NOT NULL
    ORDER BY dt.database_transaction_begin_time ASC;`,
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
    name: "bekleme_istatistikleri",
    description:
      "SQL Server'in en cok NEREDE bekledigini gosterir (wait stats), benign/idle waitler haric, yuzdesiyle. 'Sunucu neyi bekliyor, darbogaz nerede?' icin. Salt-okunur.",
  },
  {
    name: "log_kullanimi",
    description:
      "Veritabani basina transaction log boyutu ve kullanim yuzdesi. 'Log doluyor mu?' icin. Salt-okunur.",
  },
  {
    name: "disk_dosya",
    description:
      "Veri/log dosyalarinin boyutu ve bulunduklari diskteki bos alan. 'Disk doluyor mu?' icin. Salt-okunur.",
  },
  {
    name: "yedek_durumu",
    description:
      "Her veritabaninin son full/diff/log yedegi ve full yedegin kac saat once alindigi. 'Yedegim guncel mi?' icin. (msdb okuma izni gerekir, setup script'te.) Salt-okunur.",
  },
  {
    name: "tempdb_kullanimi",
    description:
      "tempdb alan kullanimi: kullanici nesneleri, dahili nesneler, surum deposu (version store), bos ve toplam MB. 'tempdb sisiyor mu?' icin. Salt-okunur.",
  },
  {
    name: "deadlock",
    description:
      "system_health'ten son deadlock'larin zamanlari (rolling buffer). 'Deadlock oluyor mu, ne zaman?' icin; detayli grafik SSMS'te. Salt-okunur.",
  },
  {
    name: "pahali_sorgular",
    description:
      "En cok kaynak yiyen sorgular: ortalama CPU, sure, okuma, calisma sayisi ve sorgu metni (plan cache'ten). 'Hangi sorgu sunucuyu yoruyor?' icin. Salt-okunur.",
  },
  {
    name: "index_sagligi",
    description:
      "Bagli oldugunuz veritabaninda KULLANILMAYAN index'ler: hic okunmuyor ama yazmada maliyet cikariyor. Silme adayi. Salt-okunur.",
  },
  {
    name: "eksik_index_create",
    description:
      "Eksik index onerilerini etkiye gore HAZIR 'CREATE INDEX' cumleleriyle verir; kopyala-calistir. Salt-okunur (olusturmaz, metni uretir).",
  },
  {
    name: "konfig_denetimi",
    description:
      "Sunucu ayarlarinin best-practice denetimi: MAXDOP, cost threshold, max memory, ad hoc workloads, backup compression — her biri icin oneriyle. Salt-okunur.",
  },
  {
    name: "bellek_baskisi",
    description:
      "Bellek baskisi gostergeleri: Page Life Expectancy, bekleyen bellek talebi (memory grants pending), toplam/bos RAM ve bellek durumu. Salt-okunur.",
  },
  {
    name: "vlf_log_sagligi",
    description:
      "Her veritabaninin VLF sayisi (cok yuksek = log performans sorunu) ve log'un neden buyudugu (log_reuse_wait). Salt-okunur. (SQL 2016+)",
  },
  {
    name: "acik_transactionlar",
    description:
      "Acik/uzun suren transaction'lar: oturum, sure, kullanilan log MB, uygulama. Log sismesinin ve blocking'in kok nedeni. Salt-okunur.",
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
