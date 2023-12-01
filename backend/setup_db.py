"""
Database setup script
Creates the database and runs migrations
"""
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import os
import sys

# Database credentials
DB_HOST = "localhost"
DB_PORT = 5432
DB_USER = "postgres"
DB_PASSWORD = "1"
DB_NAME = "video_downloader"

def create_database():
    """Create the database if it doesn't exist"""
    try:
        # Connect to PostgreSQL server (default postgres database)
        print(f"Connecting to PostgreSQL server at {DB_HOST}:{DB_PORT}...")
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database="postgres"
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Check if database exists
        cursor.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s",
            (DB_NAME,)
        )
        exists = cursor.fetchone()
        
        if exists:
            print(f"Database '{DB_NAME}' already exists")
        else:
            # Create database
            print(f"Creating database '{DB_NAME}'...")
            cursor.execute(f'CREATE DATABASE {DB_NAME}')
            print(f"Database '{DB_NAME}' created successfully")
        
        cursor.close()
        conn.close()
        return True
        
    except psycopg2.Error as e:
        print(f"Error creating database: {e}")
        return False

def run_migrations():
    """Run the migration SQL script"""
    try:
        # Connect to the video_downloader database
        print(f"\nConnecting to database '{DB_NAME}'...")
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )
        cursor = conn.cursor()
        
        # Read and execute migration script
        migration_file = os.path.join(os.path.dirname(__file__), "migrations", "init_db.sql")
        print(f"Reading migration script: {migration_file}")
        
        with open(migration_file, 'r', encoding='utf-8') as f:
            sql_script = f.read()
        
        print("Running migrations...")
        cursor.execute(sql_script)
        conn.commit()
        
        print("Migrations completed successfully")
        
        # Verify tables were created
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        """)
        tables = cursor.fetchall()
        
        print(f"\nCreated {len(tables)} tables:")
        for table in tables:
            print(f"  - {table[0]}")
        
        cursor.close()
        conn.close()
        return True
        
    except psycopg2.Error as e:
        print(f"Error running migrations: {e}")
        return False
    except FileNotFoundError as e:
        print(f"Migration file not found: {e}")
        return False

def test_connection():
    """Test database connection"""
    try:
        print(f"\nTesting connection to '{DB_NAME}'...")
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        print(f"Connection successful!")
        print(f"PostgreSQL version: {version[0][:50]}...")
        
        cursor.close()
        conn.close()
        return True
        
    except psycopg2.Error as e:
        print(f"Connection failed: {e}")
        return False

def main():
    """Main setup function"""
    print("=" * 60)
    print("Video Downloader - Database Setup")
    print("=" * 60)
    
    # Step 1: Create database
    if not create_database():
        print("\nDatabase setup failed!")
        sys.exit(1)
    
    # Step 2: Run migrations
    if not run_migrations():
        print("\nMigration failed!")
        sys.exit(1)
    
    # Step 3: Test connection
    if not test_connection():
        print("\nConnection test failed!")
        sys.exit(1)
    
    print("\n" + "=" * 60)
    print("Database setup completed successfully!")
    print("=" * 60)
    print(f"\nDatabase URL: postgresql://{DB_USER}:****@{DB_HOST}:{DB_PORT}/{DB_NAME}")
    print("\nYou can now start the backend server with:")
    print("  python main.py")
    print("\nOr using uvicorn:")
    print("  uvicorn main:app --reload")

if __name__ == "__main__":
    main()
