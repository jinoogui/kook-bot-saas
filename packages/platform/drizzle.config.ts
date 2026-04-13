import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: {
    url: process.env.PLATFORM_MYSQL_URL ?? 'mysql://root:root@localhost:3306/kook_saas_platform',
  },
})
