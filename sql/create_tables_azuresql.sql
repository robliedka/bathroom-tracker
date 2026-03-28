-- Bathroom Watch schema for Azure SQL / SQL Server
-- Creates ASP.NET Identity tables plus app domain tables.

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'dbo')
BEGIN
    EXEC(N'CREATE SCHEMA [dbo]');
END

-- Identity tables
IF OBJECT_ID(N'[dbo].[AspNetRoles]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AspNetRoles] (
        [Id] nvarchar(450) NOT NULL,
        [Name] nvarchar(256) NULL,
        [NormalizedName] nvarchar(256) NULL,
        [ConcurrencyStamp] nvarchar(max) NULL,
        CONSTRAINT [PK_AspNetRoles] PRIMARY KEY ([Id])
    );
END

IF OBJECT_ID(N'[dbo].[AspNetUsers]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AspNetUsers] (
        [Id] nvarchar(450) NOT NULL,
        [UserName] nvarchar(256) NULL,
        [NormalizedUserName] nvarchar(256) NULL,
        [Email] nvarchar(256) NULL,
        [NormalizedEmail] nvarchar(256) NULL,
        [EmailConfirmed] bit NOT NULL CONSTRAINT [DF_AspNetUsers_EmailConfirmed] DEFAULT(0),
        [PasswordHash] nvarchar(max) NULL,
        [SecurityStamp] nvarchar(max) NULL,
        [ConcurrencyStamp] nvarchar(max) NULL,
        [PhoneNumber] nvarchar(max) NULL,
        [PhoneNumberConfirmed] bit NOT NULL CONSTRAINT [DF_AspNetUsers_PhoneNumberConfirmed] DEFAULT(0),
        [TwoFactorEnabled] bit NOT NULL CONSTRAINT [DF_AspNetUsers_TwoFactorEnabled] DEFAULT(0),
        [LockoutEnd] datetimeoffset NULL,
        [LockoutEnabled] bit NOT NULL CONSTRAINT [DF_AspNetUsers_LockoutEnabled] DEFAULT(0),
        [AccessFailedCount] int NOT NULL CONSTRAINT [DF_AspNetUsers_AccessFailedCount] DEFAULT(0),
        [FullName] nvarchar(max) NOT NULL,
        [Points] int NOT NULL CONSTRAINT [DF_AspNetUsers_Points] DEFAULT(0),
        CONSTRAINT [PK_AspNetUsers] PRIMARY KEY ([Id])
    );
END
ELSE
BEGIN
    IF COL_LENGTH(N'[dbo].[AspNetUsers]', N'Points') IS NULL
    BEGIN
        ALTER TABLE [dbo].[AspNetUsers] ADD [Points] int NOT NULL CONSTRAINT [DF_AspNetUsers_Points] DEFAULT(0);
    END
END

IF OBJECT_ID(N'[dbo].[AspNetRoleClaims]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AspNetRoleClaims] (
        [Id] int IDENTITY(1,1) NOT NULL,
        [RoleId] nvarchar(450) NOT NULL,
        [ClaimType] nvarchar(max) NULL,
        [ClaimValue] nvarchar(max) NULL,
        CONSTRAINT [PK_AspNetRoleClaims] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_AspNetRoleClaims_AspNetRoles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [dbo].[AspNetRoles] ([Id]) ON DELETE CASCADE
    );
END

IF OBJECT_ID(N'[dbo].[AspNetUserClaims]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AspNetUserClaims] (
        [Id] int IDENTITY(1,1) NOT NULL,
        [UserId] nvarchar(450) NOT NULL,
        [ClaimType] nvarchar(max) NULL,
        [ClaimValue] nvarchar(max) NULL,
        CONSTRAINT [PK_AspNetUserClaims] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_AspNetUserClaims_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [dbo].[AspNetUsers] ([Id]) ON DELETE CASCADE
    );
END

IF OBJECT_ID(N'[dbo].[AspNetUserLogins]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AspNetUserLogins] (
        [LoginProvider] nvarchar(450) NOT NULL,
        [ProviderKey] nvarchar(450) NOT NULL,
        [ProviderDisplayName] nvarchar(max) NULL,
        [UserId] nvarchar(450) NOT NULL,
        CONSTRAINT [PK_AspNetUserLogins] PRIMARY KEY ([LoginProvider], [ProviderKey]),
        CONSTRAINT [FK_AspNetUserLogins_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [dbo].[AspNetUsers] ([Id]) ON DELETE CASCADE
    );
END

IF OBJECT_ID(N'[dbo].[AspNetUserRoles]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AspNetUserRoles] (
        [UserId] nvarchar(450) NOT NULL,
        [RoleId] nvarchar(450) NOT NULL,
        CONSTRAINT [PK_AspNetUserRoles] PRIMARY KEY ([UserId], [RoleId]),
        CONSTRAINT [FK_AspNetUserRoles_AspNetRoles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [dbo].[AspNetRoles] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_AspNetUserRoles_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [dbo].[AspNetUsers] ([Id]) ON DELETE CASCADE
    );
END

IF OBJECT_ID(N'[dbo].[AspNetUserTokens]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AspNetUserTokens] (
        [UserId] nvarchar(450) NOT NULL,
        [LoginProvider] nvarchar(450) NOT NULL,
        [Name] nvarchar(450) NOT NULL,
        [Value] nvarchar(max) NULL,
        CONSTRAINT [PK_AspNetUserTokens] PRIMARY KEY ([UserId], [LoginProvider], [Name]),
        CONSTRAINT [FK_AspNetUserTokens_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [dbo].[AspNetUsers] ([Id]) ON DELETE CASCADE
    );
END

-- App tables
IF OBJECT_ID(N'[dbo].[Bathrooms]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Bathrooms] (
        [Id] uniqueidentifier NOT NULL CONSTRAINT [DF_Bathrooms_Id] DEFAULT NEWID(),
        [Name] nvarchar(200) NOT NULL,
        [Location] nvarchar(200) NULL,
        [CreatedAtUtc] datetimeoffset NOT NULL,
        [CreatedByUserId] nvarchar(450) NULL,
        CONSTRAINT [PK_Bathrooms] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Bathrooms_AspNetUsers_CreatedByUserId] FOREIGN KEY ([CreatedByUserId]) REFERENCES [dbo].[AspNetUsers] ([Id]) ON DELETE NO ACTION
    );
END

IF OBJECT_ID(N'[dbo].[BathroomReports]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[BathroomReports] (
        [Id] uniqueidentifier NOT NULL CONSTRAINT [DF_BathroomReports_Id] DEFAULT NEWID(),
        [BathroomId] uniqueidentifier NOT NULL,
        [ReporterUserId] nvarchar(450) NOT NULL,
        [Status] int NOT NULL,
        [Notes] nvarchar(500) NULL,
        [CreatedAtUtc] datetimeoffset NOT NULL,
        CONSTRAINT [PK_BathroomReports] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_BathroomReports_Bathrooms_BathroomId] FOREIGN KEY ([BathroomId]) REFERENCES [dbo].[Bathrooms] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_BathroomReports_AspNetUsers_ReporterUserId] FOREIGN KEY ([ReporterUserId]) REFERENCES [dbo].[AspNetUsers] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [CK_BathroomReports_Status] CHECK ([Status] IN (0, 1))
    );
END

IF OBJECT_ID(N'[dbo].[BathroomSubscriptions]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[BathroomSubscriptions] (
        [BathroomId] uniqueidentifier NOT NULL,
        [UserId] nvarchar(450) NOT NULL,
        [CreatedAtUtc] datetimeoffset NOT NULL,
        CONSTRAINT [PK_BathroomSubscriptions] PRIMARY KEY ([BathroomId], [UserId]),
        CONSTRAINT [FK_BathroomSubscriptions_Bathrooms_BathroomId] FOREIGN KEY ([BathroomId]) REFERENCES [dbo].[Bathrooms] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_BathroomSubscriptions_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [dbo].[AspNetUsers] ([Id]) ON DELETE CASCADE
    );
END

-- Indexes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'RoleNameIndex' AND object_id = OBJECT_ID(N'[dbo].[AspNetRoles]'))
    CREATE UNIQUE INDEX [RoleNameIndex] ON [dbo].[AspNetRoles] ([NormalizedName]) WHERE [NormalizedName] IS NOT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'EmailIndex' AND object_id = OBJECT_ID(N'[dbo].[AspNetUsers]'))
    CREATE INDEX [EmailIndex] ON [dbo].[AspNetUsers] ([NormalizedEmail]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UserNameIndex' AND object_id = OBJECT_ID(N'[dbo].[AspNetUsers]'))
    CREATE UNIQUE INDEX [UserNameIndex] ON [dbo].[AspNetUsers] ([NormalizedUserName]) WHERE [NormalizedUserName] IS NOT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AspNetRoleClaims_RoleId' AND object_id = OBJECT_ID(N'[dbo].[AspNetRoleClaims]'))
    CREATE INDEX [IX_AspNetRoleClaims_RoleId] ON [dbo].[AspNetRoleClaims] ([RoleId]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AspNetUserClaims_UserId' AND object_id = OBJECT_ID(N'[dbo].[AspNetUserClaims]'))
    CREATE INDEX [IX_AspNetUserClaims_UserId] ON [dbo].[AspNetUserClaims] ([UserId]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AspNetUserLogins_UserId' AND object_id = OBJECT_ID(N'[dbo].[AspNetUserLogins]'))
    CREATE INDEX [IX_AspNetUserLogins_UserId] ON [dbo].[AspNetUserLogins] ([UserId]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AspNetUserRoles_RoleId' AND object_id = OBJECT_ID(N'[dbo].[AspNetUserRoles]'))
    CREATE INDEX [IX_AspNetUserRoles_RoleId] ON [dbo].[AspNetUserRoles] ([RoleId]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Bathrooms_CreatedByUserId' AND object_id = OBJECT_ID(N'[dbo].[Bathrooms]'))
    CREATE INDEX [IX_Bathrooms_CreatedByUserId] ON [dbo].[Bathrooms] ([CreatedByUserId]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_BathroomReports_BathroomId_CreatedAtUtc' AND object_id = OBJECT_ID(N'[dbo].[BathroomReports]'))
    CREATE INDEX [IX_BathroomReports_BathroomId_CreatedAtUtc] ON [dbo].[BathroomReports] ([BathroomId], [CreatedAtUtc]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_BathroomReports_ReporterUserId' AND object_id = OBJECT_ID(N'[dbo].[BathroomReports]'))
    CREATE INDEX [IX_BathroomReports_ReporterUserId] ON [dbo].[BathroomReports] ([ReporterUserId]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_BathroomSubscriptions_UserId' AND object_id = OBJECT_ID(N'[dbo].[BathroomSubscriptions]'))
    CREATE INDEX [IX_BathroomSubscriptions_UserId] ON [dbo].[BathroomSubscriptions] ([UserId]);
