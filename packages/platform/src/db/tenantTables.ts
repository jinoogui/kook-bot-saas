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

  // ── Ticket ──
  `CREATE TABLE IF NOT EXISTS plugin_ticket_tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    channel_id VARCHAR(32),
    message_id VARCHAR(32),
    creator_user_id VARCHAR(32) NOT NULL,
    assignee_user_id VARCHAR(32),
    title VARCHAR(200) NOT NULL,
    content TEXT,
    priority VARCHAR(16) NOT NULL DEFAULT 'normal',
    status VARCHAR(16) NOT NULL DEFAULT 'open',
    closed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant_guild_status (tenant_id, guild_id, status),
    INDEX idx_tenant_creator (tenant_id, creator_user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS plugin_ticket_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    ticket_id INT NOT NULL,
    action VARCHAR(32) NOT NULL,
    operator_user_id VARCHAR(32) NOT NULL,
    detail TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_ticket (tenant_id, ticket_id)
  )`,

  // ── Events ──
  `CREATE TABLE IF NOT EXISTS plugin_events_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    channel_id VARCHAR(32) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    start_at TIMESTAMP NOT NULL,
    end_at TIMESTAMP NOT NULL,
    max_participants INT DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'draft',
    reminder_sent INT DEFAULT 0,
    created_by VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_events_tenant_guild_status (tenant_id, guild_id, status),
    INDEX idx_events_tenant_start (tenant_id, start_at)
  )`,
  `CREATE TABLE IF NOT EXISTS plugin_events_participants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    event_id INT NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'joined',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_events_tenant_event_user (tenant_id, event_id, user_id),
    INDEX idx_events_participant_tenant_guild (tenant_id, guild_id)
  )`,

  // ── Raffle ──
  `CREATE TABLE IF NOT EXISTS plugin_raffle_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    channel_id VARCHAR(32) NOT NULL,
    message_id VARCHAR(32),
    title VARCHAR(200) NOT NULL,
    prize VARCHAR(255) NOT NULL,
    draw_at TIMESTAMP NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'open',
    winner_user_id VARCHAR(32),
    created_by VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_raffle_tenant_guild_status (tenant_id, guild_id, status),
    INDEX idx_raffle_tenant_draw_at (tenant_id, draw_at)
  )`,
  `CREATE TABLE IF NOT EXISTS plugin_raffle_participants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    raffle_id INT NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_raffle_tenant_raffle_user (tenant_id, raffle_id, user_id),
    INDEX idx_raffle_participant_tenant_raffle (tenant_id, raffle_id)
  )`,

  // ── Quests ──
  `CREATE TABLE IF NOT EXISTS plugin_quests_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    code VARCHAR(64) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    target_count INT NOT NULL DEFAULT 10,
    reward_points INT NOT NULL DEFAULT 10,
    enabled INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_quest_template_tenant_guild_code (tenant_id, guild_id, code),
    INDEX idx_quest_template_tenant_guild_enabled (tenant_id, guild_id, enabled)
  )`,
  `CREATE TABLE IF NOT EXISTS plugin_quests_progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    quest_code VARCHAR(64) NOT NULL,
    date_key VARCHAR(10) NOT NULL,
    progress INT NOT NULL DEFAULT 0,
    claimed INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_quest_progress_tenant_guild_user_quest_date (tenant_id, guild_id, user_id, quest_code, date_key),
    INDEX idx_quest_progress_tenant_guild_date (tenant_id, guild_id, date_key)
  )`,

  // ── Announcer ──
  `CREATE TABLE IF NOT EXISTS plugin_announcer_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    channel_id VARCHAR(32) NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    schedule_at TIMESTAMP NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'scheduled',
    retry_count INT NOT NULL DEFAULT 0,
    last_error TEXT,
    created_by VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_announcer_tenant_guild_status (tenant_id, guild_id, status),
    INDEX idx_announcer_tenant_schedule (tenant_id, schedule_at)
  )`,

  // ── Polls ──
  `CREATE TABLE IF NOT EXISTS plugin_polls_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    channel_id VARCHAR(32) NOT NULL,
    message_id VARCHAR(32),
    title VARCHAR(255) NOT NULL,
    options_json TEXT NOT NULL,
    allow_multi INT DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'open',
    ends_at TIMESTAMP NULL,
    created_by VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_polls_tenant_guild_status (tenant_id, guild_id, status),
    INDEX idx_polls_tenant_ends_at (tenant_id, ends_at)
  )`,
  `CREATE TABLE IF NOT EXISTS plugin_polls_votes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    poll_id INT NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    option_key VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_polls_vote_tenant_poll (tenant_id, poll_id),
    UNIQUE KEY uniq_polls_tenant_poll_user_option (tenant_id, poll_id, user_id, option_key)
  )`,

  // ── Anti Spam ──
  `CREATE TABLE IF NOT EXISTS plugin_anti_spam_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    enabled INT DEFAULT 1,
    max_messages_per_window INT NOT NULL DEFAULT 6,
    window_seconds INT NOT NULL DEFAULT 10,
    duplicate_threshold INT NOT NULL DEFAULT 3,
    block_at_all INT NOT NULL DEFAULT 1,
    action_type VARCHAR(16) NOT NULL DEFAULT 'warn',
    mute_hours INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_anti_spam_tenant_guild (tenant_id, guild_id)
  )`,
  `CREATE TABLE IF NOT EXISTS plugin_anti_spam_violations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    type VARCHAR(32) NOT NULL,
    content TEXT,
    action_taken VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_anti_spam_tenant_guild_user (tenant_id, guild_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS plugin_anti_spam_whitelist (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_anti_spam_tenant_guild_user (tenant_id, guild_id, user_id),
    INDEX idx_anti_spam_whitelist_tenant_guild (tenant_id, guild_id)
  )`,
]
