/* ============================================================================
   mssql-health-mcp  —  SALT-OKUNUR login olusturma
   ----------------------------------------------------------------------------
   Bu script'i SSMS'te (ya da sqlcmd ile) 'master' uzerinde, sysadmin/securityadmin
   yetkili bir hesapla calistirin. Olusturulan login HICBIR SEY yazamaz/degistiremez;
   yalnizca teshis (DMV) sorgularini calistirabilir.
   PAROLAYI degistirmeyi unutmayin.
   ============================================================================ */

-------------------------------------------------------------------------------
-- 1) Login (SQL Authentication)
-------------------------------------------------------------------------------
USE [master];
GO

IF SUSER_ID(N'mcp_readonly') IS NULL
BEGIN
    CREATE LOGIN [mcp_readonly]
        WITH PASSWORD = N'Degistir_Guclu_Parola!2026',
             CHECK_POLICY = ON;
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
-- DOGRULAMA (istege bagli): bu login ile baglanip asagidakini calistirin.
-- Calismalı:   SELECT TOP 1 * FROM sys.dm_os_sys_info;
-- Calismamali: CREATE TABLE dbo._test (x int);   -- izin reddi almalisiniz
-------------------------------------------------------------------------------
