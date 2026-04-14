import mysql from 'mysql2/promise'

/**
 * Ensure all plugin tables exist in the tenant database.
 * Called once at platform startup.
 */
export async function ensureTenantTables(tenantMysqlUrl: string): Promise<void> {
  const pool = mysql.createPool(tenantMysqlUrl)
  try {
    for (const sql of PLUGIN_TABLE_SQLS) {
      await pool.execute(sql)
    }
    console.info(`[TenantDB] 已确认 ${PLUGIN_TABLE_SQLS.length} 张插件表`)
  } finally {
    await pool.end()
  }
}

const PLUGIN_TABLE_SQLS = [
  // ── Points ──
  `CREATE TABLE IF NOT EXISTS plugin_points_checkin_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    checkin_date VARCHAR(10) NOT NULL,
    points INT NOT NULL DEFAULT 0,
    streak_days INT DEFAULT 1,
    bonus_points INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY (tenant_id, user_id, guild_id, checkin_date),
    INDEX idx_tenant_guild (tenant_id, guild_id)
  )`,
  `CREATE TABLE IF NOT EXISTS plugin_points_user_points (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    points INT NOT NULL DEFAULT 0,
    total_earned INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY (tenant_id, user_id, guild_id),
    INDEX idx_tenant_guild (tenant_id, guild_id)
  )`,
  `CREATE TABLE IF NOT EXISTS plugin_points_shop_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    price INT NOT NULL,
    role_id VARCHAR(32),
    stock INT DEFAULT -1,
    enabled INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_guild (tenant_id, guild_id)
  )`,
  `CREATE TABLE IF NOT EXISTS plugin_points_shop_exchanges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    item_id INT NOT NULL,
    item_name VARCHAR(128) NOT NULL,
    item_price INT NOT NULL,
    confirmed INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_user_guild (tenant_id, user_id, guild_id)
  )`,
  `CREATE TABLE IF NOT EXISTS plugin_points_reward_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    reward_type VARCHAR(32) NOT NULL,
    reward_name VARCHAR(128),
    points_earned INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_user (tenant_id, user_id, guild_id)
  )`,
  `CREATE TABLE IF NOT EXISTS plugin_points_box_reward_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    min_points INT NOT NULL DEFAULT 1,
    max_points INT NOT NULL DEFAULT 10,
    cooldown INT DEFAULT 3600,
    enabled INT DEFAULT 1,
    UNIQUE KEY (tenant_id, guild_id)
  )`,

  // ── Content Filter ──
  `CREATE TABLE IF NOT EXISTS plugin_filter_ads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    keyword VARCHAR(256) NOT NULL,
    enabled INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_guild (tenant_id, guild_id)
  )`,
  `CREATE TABLE IF NOT EXISTS plugin_filter_violation_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    type VARCHAR(32) NOT NULL,
    content TEXT,
    channel_id VARCHAR(32),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_user (tenant_id, user_id, guild_id)
  )`,

  // ── Welcome ──
  `CREATE TABLE IF NOT EXISTS plugin_welcome_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    content TEXT,
    channel_id VARCHAR(32),
    enabled INT DEFAULT 1,
    message_type VARCHAR(16) DEFAULT 'kmarkdown',
    card_content TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX uniq_tenant_guild (tenant_id, guild_id)
  )`,

  // ── Moderation ──
  `CREATE TABLE IF NOT EXISTS plugin_moderation_bans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    reason VARCHAR(255),
    banned_by VARCHAR(32),
    banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_guild (tenant_id, guild_id)
  )`,
  `CREATE TABLE IF NOT EXISTS plugin_moderation_mutes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    mute_until TIMESTAMP NOT NULL,
    muted_by VARCHAR(32),
    muted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_guild (tenant_id, guild_id)
  )`,
  `CREATE TABLE IF NOT EXISTS plugin_moderation_ads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    keyword VARCHAR(256) NOT NULL,
    enabled INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_guild (tenant_id, guild_id)
  )`,

  // ── Keyword Reply ──
  `CREATE TABLE IF NOT EXISTS plugin_keyword_replies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    keyword VARCHAR(256) NOT NULL,
    reply TEXT NOT NULL,
    match_type VARCHAR(16) DEFAULT 'contains',
    enabled INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_guild (tenant_id, guild_id)
  )`,
  `CREATE TABLE IF NOT EXISTS plugin_auto_replies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    \`trigger\` VARCHAR(256) NOT NULL,
    response TEXT NOT NULL,
    enabled INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_guild (tenant_id, guild_id)
  )`,

  // ── Role Claim ──
  `CREATE TABLE IF NOT EXISTS plugin_role_claim_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    channel_id VARCHAR(32) NOT NULL,
    message_id VARCHAR(32),
    role_id VARCHAR(32) NOT NULL,
    emoji VARCHAR(64),
    label VARCHAR(128),
    enabled INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_guild (tenant_id, guild_id)
  )`,

  // ── Levels ──
  `CREATE TABLE IF NOT EXISTS plugin_levels_user_activity (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    message_count INT DEFAULT 0,
    total_xp INT DEFAULT 0,
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY (tenant_id, user_id, guild_id),
    INDEX idx_tenant_guild (tenant_id, guild_id)
  )`,
  `CREATE TABLE IF NOT EXISTS plugin_levels_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    xp_per_message INT DEFAULT 10,
    xp_cooldown INT DEFAULT 60,
    level_up_channel VARCHAR(32),
    enabled INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY (tenant_id, guild_id)
  )`,

  // ── Reminders ──
  `CREATE TABLE IF NOT EXISTS plugin_reminders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    channel_id VARCHAR(32) NOT NULL,
    content TEXT NOT NULL,
    remind_at TIMESTAMP NOT NULL,
    sent INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_remind_at (tenant_id, remind_at)
  )`,

  // ── Statistics ──
  `CREATE TABLE IF NOT EXISTS plugin_stats_activity_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    channel_id VARCHAR(32),
    stat_date DATE NOT NULL,
    stat_hour INT NOT NULL,
    message_count INT DEFAULT 0,
    unique_users INT DEFAULT 0,
    INDEX idx_tenant_guild (tenant_id, guild_id)
  )`,
  `CREATE TABLE IF NOT EXISTS plugin_stats_online_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    online_count INT DEFAULT 0,
    INDEX idx_tenant_guild (tenant_id, guild_id)
  )`,
  `CREATE TABLE IF NOT EXISTS plugin_stats_user_activity (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    message_count INT DEFAULT 0,
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY (tenant_id, user_id, guild_id),
    INDEX idx_tenant_guild_user (tenant_id, guild_id, user_id)
  )`,

  // ── Voice Points ──
  `CREATE TABLE IF NOT EXISTS plugin_voice_online_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    channel_id VARCHAR(32) NOT NULL,
    join_time TIMESTAMP NOT NULL,
    leave_time TIMESTAMP NULL,
    duration_seconds INT DEFAULT 0,
    points_awarded INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_guild (tenant_id, guild_id)
  )`,
  `CREATE TABLE IF NOT EXISTS plugin_voice_points_daily (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    date VARCHAR(10) NOT NULL,
    total_seconds INT DEFAULT 0,
    points_earned INT DEFAULT 0,
    UNIQUE KEY (tenant_id, user_id, guild_id, date),
    INDEX idx_date (tenant_id, date)
  )`,
]
