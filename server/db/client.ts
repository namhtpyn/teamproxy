import { drizzle } from 'drizzle-orm/node-sqlite'
import { migrate } from 'drizzle-orm/node-sqlite/migrator'
import { relationsMap } from './relations'
import { resolve } from 'node:path'
import { consola } from 'consola'

function createDb() {
  const connectionString = useRuntimeConfig().databaseUrl
  const db = drizzle(connectionString, { relations: relationsMap })

  migrate(db, { migrationsFolder: resolve(process.cwd(), 'server/db/migrations') })
  consola.info('[db-migrate] Migrations applied')

  return db
}

export const db = createDb()

export type Database = ReturnType<typeof createDb>
