#!/bin/bash
set -e

# Tear down any leftover containers and volumes from a previous run
echo "Tearing down previous state..."
docker-compose down -v --remove-orphans

# Clear stale LocalStack state
rm -rf ./localstack_data

# 1. Start the Mock RDS container and wait for it to accept connections
echo "Starting Mock RDS & Localstack..."
docker-compose up -d postgres localstack

echo "Waiting for PostgreSQL to be ready..."
until docker-compose exec -T postgres pg_isready -U postgres -d antcollect; do
  echo "Database is unavailable - sleeping..."
  sleep 2
done
echo "PostgreSQL is up and running!"

echo "Waiting for LocalStack S3 to be ready..."
until [ "$(docker inspect --format='{{.State.Health.Status}}' localstack_main 2>/dev/null)" = "healthy" ]; do
  echo "LocalStack S3 is unavailable - sleeping..."
  sleep 2
done
echo "LocalStack S3 is up and running!"

# Initialize LocalStack S3 Bucket (will not fail if it already exists)
echo "Ensuring mock S3 bucket 'petrcollect-bucket' exists..."
docker-compose exec -T localstack awslocal s3 mb s3://petrcollect-bucket --region us-east-1 2>/dev/null || true

# 2. Initialize Roles (Admin)
echo "Initializing Roles..."
# Using sed to inject local mock passwords into the initialization script
sed -e "s/\${APP_DB_PASSWORD}/local_app_pw/g" \
    -e "s/\${MESSAGING_DB_PASSWORD}/local_msg_pw/g" \
    infra/db/init-roles.sql > /tmp/init-roles.sql

# Execute initialization script as RDS Admin (the default 'postgres' user)
cat /tmp/init-roles.sql | docker-compose exec -T postgres psql -U postgres -d antcollect

# 3. Run Backend Migrations (App User)
echo "Running Backend Migrations..."
docker-compose run --rm \
  -e DB_USER=petrcollect_app \
  -e DB_PASSWORD=local_app_pw \
  -e DB_HOST=postgres \
  -e DB_PORT=5432 \
  -e DB_NAME=antcollect \
  backend alembic upgrade head

# 4. Grant Cross-Schema Access (Admin)
echo "Granting Cross-Schema Access..."
docker-compose exec -T postgres psql -U postgres -d antcollect -c "GRANT SELECT ON public.users TO petrcollect_messaging;"

# 5. Run Messaging Migrations (Messaging User) & Start Services
echo "Building and starting Application Services (Triggers Flyway automatically)..."
# --build ensures the image is always rebuilt from current source before starting.
APP_DB_PASSWORD=local_app_pw MESSAGING_DB_PASSWORD=local_msg_pw docker-compose up -d --build backend messaging

echo "--------------------------------------------------------"
echo "Local deployment rehearsal completed successfully!"
echo "Backend is available at: http://localhost:8000"
echo "Messaging is available at: http://localhost:8080"
echo "--------------------------------------------------------"