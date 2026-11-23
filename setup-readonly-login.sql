/* ============================================================================
   mssql-health-mcp  —  SALT-OKUNUR login olusturma
   ----------------------------------------------------------------------------
   Bu script'i SSMS'te (ya da sqlcmd ile) 'master' uzerinde, sysadmin/securityadmin
   yetkili bir hesapla calistirin. Olusturulan login HICBIR SEY yazamaz/degistiremez;
   yalnizca teshis (DMV) sorgularini calistirabilir.
   Parolayi dosyaya kalici YAZMAYIN: asagidaki @Parola degiskenine yazip calistirin, sonra degeri silin.
   ============================================================================ */

-------------------------------------------------------------------------------
-- 1) Login (SQL Authentication)
-------------------------------------------------------------------------------
USE [master];
GO

IF SUSER_ID(N'mcp_readonly') IS NULL
BEGIN
    DECLARE @Parola NVARCHAR(128) = N'';   -- BURAYA kendi guclu parolanizi yazin (en az 14 karakter), calistirdiktan sonra silin
    IF LEN(@Parola) < 14
        THROW 50001, N'Once @Parola degiskenine en az 14 karakterli guclu bir parola yazin.', 1;
    DECLARE @sql NVARCHAR(MAX) = N'CREATE LOGIN [mcp_readonly] WITH PASSWORD = ' + QUOTENAME(@Parola, '''') + N', CHECK_POLICY = ON;';
    EXEC (@sql);
END
GO

-------------------------------------------------------------------------------
-- 2) Sunucu seviyesi: yalnizca DMV okuma
--    (sunucu_sagligi, aktif_sorgular_blocking, eksik_indexler bunu kullanir)
-------------------------------------------------------------------------------
GRANT VIEW SERVER STATE   TO [mcp_readonly];   -- dm_os_*, dm_exec_*, missing index DMV'leri
GRANT VIEW ANY DEFINITION TO [mcp_readonly];   -- nesne adlarini cozebilmek (OBJECT_NAME) icin
GO

-------------------------------------------------------------------------------
-- 3) (Opsiyonel) Veri de okumak isterseniz: izlenecek HER veritabaninda
--    db_datareader. v1 araclari yalnizca DMV kullanir; bu adim simdilik sart degil.
--    Asagidaki blogu izlemek istediginiz veritabani(lar) icin tekrarlayin.
-------------------------------------------------------------------------------
-- USE [VERITABANINIZ];
-- GO
-- IF DATABASE_PRINCIPAL_ID(N'mcp_readonly') IS NULL
--     CREATE USER [mcp_readonly] FOR LOGIN [mcp_readonly];
-- ALTER ROLE [db_datareader] ADD MEMBER [mcp_readonly];
-- GO

-------------------------------------------------------------------------------
-- 4) (yedek_durumu araci icin) msdb okuma izni
--    Bu olmadan yalniz yedek_durumu calismaz; diger araclar msdb'siz calisir.
-------------------------------------------------------------------------------
USE [msdb];
GO
IF DATABASE_PRINCIPAL_ID(N'mcp_readonly') IS NULL
    CREATE USER [mcp_readonly] FOR LOGIN [mcp_readonly];
GRANT SELECT ON OBJECT::dbo.backupset TO [mcp_readonly];   -- yedek_durumu icin yeterli, db_datareader gereksiz genis
GO

-------------------------------------------------------------------------------
-- DOGRULAMA (istege bagli): bu login ile baglanip asagidakini calistirin.
-- Calismalı:   SELECT TOP 1 * FROM sys.dm_os_sys_info;
-- Calismamali: CREATE TABLE dbo._test (x int);   -- izin reddi almalisiniz
-------------------------------------------------------------------------------
