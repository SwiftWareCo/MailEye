import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'
import * as schema from './schema'
import { config } from 'dotenv'


// Load environment variables
config()

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined')
}

const sql = neon(process.env.DATABASE_URL)
const db = drizzle(sql, { schema })

async function main() {
  console.log('Running migrations...')

  await migrate(db, { migrationsFolder: 'drizzle' })

  console.log('Migrations complete!')
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
