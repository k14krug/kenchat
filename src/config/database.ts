import * as mysql from 'mysql2/promise';
import { environment } from './environment';

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
  acquireTimeout: number;
  timeout: number;
  reconnect: boolean;
}

export const databaseConfig = {
  host: environment.database.host,
  port: environment.database.port,
  user: environment.database.user,
  password: environment.database.password,
  database: environment.database.name,
  connectionLimit: environment.database.connectionLimit,
  waitForConnections: true,
  queueLimit: 0,
};

let pool: mysql.Pool | null = null;

export const createPool = (): mysql.Pool => {
  if (!pool) {
    pool = mysql.createPool(databaseConfig);
  }
  return pool;
};

export const getConnection = async (): Promise<mysql.PoolConnection> => {
  const dbPool = createPool();
  return await dbPool.getConnection();
};

export const closePool = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};

export const testConnection = async (): Promise<boolean> => {
  try {
    const connection = await getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
};
