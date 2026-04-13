/**
 * 数据迁移脚本：从 killadbot-node 单租户迁移到 SaaS 平台
 *
 * 使用方法：
 *   npx tsx scripts/migrate-from-killadbot.ts \
 *     --source mysql://user:pass@localhost/killadbot \
 *     --target mysql://user:pass@localhost/kook_saas_tenants \
 *     --tenant-id <uuid>
 *
 * 迁移内容：
 *   - welcome_messages → plugin_welcome_messages
 *   - checkin_records → plugin_points_checkin_records
 *   - user_points → plugin_points_user_points
 *   - shop_items → plugin_points_shop_items
 *   - shop_exchanges → plugin_points_shop_exchanges
 *   - reward_records → plugin_points_reward_records
 *   - box_reward_configs → plugin_points_box_reward_configs
 *   - ads → plugin_filter_ads
 *   - violation_records → plugin_filter_violation_records
 *   - reminders → plugin_reminders
 */

import mysql from 'mysql2/promise'

interface MigrateConfig {
  sourceUrl: string
  targetUrl: string
  tenantId: string
}

const TABLE_MAPPINGS = [
  { source: 'welcome_messages', target: 'plugin_welcome_messages' },
  { source: 'checkin_records', target: 'plugin_points_checkin_records' },
  { source: 'user_points', target: 'plugin_points_user_points' },
  { source: 'shop_items', target: 'plugin_points_shop_items' },
  { source: 'shop_exchanges', target: 'plugin_points_shop_exchanges' },
  { source: 'reward_records', target: 'plugin_points_reward_records' },
  { source: 'box_reward_configs', target: 'plugin_points_box_reward_configs' },
  { source: 'ads', target: 'plugin_filter_ads' },
  { source: 'violation_records', target: 'plugin_filter_violation_records' },
  { source: 'reminders', target: 'plugin_reminders' },
]

async function migrate(config: MigrateConfig) {
  const { sourceUrl, targetUrl, tenantId } = config

  console.info('========================================')
  console.info('  Kook Bot SaaS — 数据迁移')
  console.info('========================================')
  console.info(`  租户 ID: ${tenantId}`)
  console.info(`  来源库: ${sourceUrl.replace(/:[^@]+@/, ':***@')}`)
  console.info(`  目标库: ${targetUrl.replace(/:[^@]+@/, ':***@')}`)
  console.info('')

  const source = await mysql.createConnection(sourceUrl)
  const target = await mysql.createConnection(targetUrl)

  try {
    for (const { source: srcTable, target: tgtTable } of TABLE_MAPPINGS) {
      console.info(`迁移 ${srcTable} → ${tgtTable}...`)

      try {
        // 获取源数据
        const [rows] = await source.query(`SELECT * FROM ${srcTable}`) as any[]

        if (!rows.length) {
          console.info(`  跳过（无数据）`)
          continue
        }

        // 为每行添加 tenant_id
        let migrated = 0
        for (const row of rows) {
          const withTenant = { ...row, tenant_id: tenantId }
          // 移除自增 ID
          delete withTenant.id

          const columns = Object.keys(withTenant)
          const placeholders = columns.map(() => '?').join(', ')
          const values = columns.map(k => withTenant[k])

          try {
            await target.query(
              `INSERT INTO ${tgtTable} (${columns.join(', ')}) VALUES (${placeholders})`,
              values,
            )
            migrated++
          } catch (err: any) {
            if (err.code === 'ER_DUP_ENTRY') {
              // 重复数据跳过
              continue
            }
            throw err
          }
        }

        console.info(`  ✓ 迁移 ${migrated}/${rows.length} 条记录`)
      } catch (err: any) {
        if (err.code === 'ER_NO_SUCH_TABLE') {
          console.info(`  跳过（源表不存在）`)
        } else {
          console.error(`  ✗ 迁移失败:`, err.message)
        }
      }
    }

    console.info('')
    console.info('迁移完成！')
  } finally {
    await source.end()
    await target.end()
  }
}

// CLI 参数解析
function parseArgs(): MigrateConfig {
  const args = process.argv.slice(2)
  let sourceUrl = ''
  let targetUrl = ''
  let tenantId = ''

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source' && args[i + 1]) sourceUrl = args[++i]
    if (args[i] === '--target' && args[i + 1]) targetUrl = args[++i]
    if (args[i] === '--tenant-id' && args[i + 1]) tenantId = args[++i]
  }

  if (!sourceUrl || !targetUrl || !tenantId) {
    console.error('用法: npx tsx scripts/migrate-from-killadbot.ts --source <url> --target <url> --tenant-id <uuid>')
    process.exit(1)
  }

  return { sourceUrl, targetUrl, tenantId }
}

migrate(parseArgs()).catch(err => {
  console.error('迁移失败:', err)
  process.exit(1)
})
