import asyncio
import asyncpg


async def main():
    try:
        conn = await asyncpg.connect("postgresql://postgres:postgres@localhost:5432/postgres")
        print("connected OK")
        exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname='mall'")
        if not exists:
            await conn.execute("CREATE DATABASE mall")
            print("database mall created")
        else:
            print("database mall already exists")
        await conn.close()
    except Exception as e:
        print("ERROR:", repr(e))


asyncio.run(main())
