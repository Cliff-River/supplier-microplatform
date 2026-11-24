import 'dotenv/config';
import pg from 'pg';

/**
 * 确保 DATABASE_URL 指向的数据库存在。
 * 连接到 postgres 系统库查询，不存在则创建。
 */
async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('缺少 DATABASE_URL 环境变量');
  }
  const url = new URL(databaseUrl);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!databaseName) {
    throw new Error('DATABASE_URL 中缺少数据库名');
  }

  url.pathname = '/postgres';
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    const existing = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [databaseName],
    );
    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE "${databaseName.replaceAll('"', '""')}"`);
      console.log(`已创建数据库 ${databaseName}`);
    } else {
      console.log(`数据库 ${databaseName} 已存在`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
