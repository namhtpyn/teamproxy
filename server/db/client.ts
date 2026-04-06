import { drizzle } from 'drizzle-orm/node-sqlite'
import { relationsMap } from './relations'

function createDb() {
  const connectionString = useRuntimeConfig().databaseUrl
  return drizzle(connectionString, { relations: relationsMap })
}

export const db = createDb()

export type Database = ReturnType<typeof createDb>
