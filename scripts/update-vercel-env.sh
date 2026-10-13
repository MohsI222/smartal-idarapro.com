#!/bin/bash

# Update Vercel environment variables from .env file

echo "Updating Vercel environment variables..."

# Remove existing variables first
echo "y" | vercel env rm DATABASE_URL production 2>/dev/null || true
echo "y" | vercel env rm DIRECT_URL production 2>/dev/null || true
echo "y" | vercel env rm SUPABASE_URL production 2>/dev/null || true
echo "y" | vercel env rm SUPABASE_ANON_KEY production 2>/dev/null || true
echo "y" | vercel env rm SUPABASE_SERVICE_ROLE_KEY production 2>/dev/null || true
echo "y" | vercel env rm VITE_SUPABASE_URL production 2>/dev/null || true
echo "y" | vercel env rm VITE_SUPABASE_ANON_KEY production 2>/dev/null || true
echo "y" | vercel env rm VITE_PUBLIC_APP_URL production 2>/dev/null || true
echo "y" | vercel env rm PUBLIC_APP_URL production 2>/dev/null || true
echo "y" | vercel env rm JWT_SECRET production 2>/dev/null || true
echo "y" | vercel env rm JWT_EXPIRES_DAYS production 2>/dev/null || true
echo "y" | vercel env rm SUPER_ADMIN_EMAIL production 2>/dev/null || true
echo "y" | vercel env rm SUPER_ADMIN_PASSWORD production 2>/dev/null || true
echo "y" | vercel env rm SUPER_ADMIN_NAME production 2>/dev/null || true
echo "y" | vercel env rm SUPER_ADMIN_WHATSAPP production 2>/dev/null || true
echo "y" | vercel env rm ADMIN_BOOTSTRAP_KEY production 2>/dev/null || true

# Add new variables
vercel env add DATABASE_URL production --value "postgresql://postgres.ihteylplpdtxdpqxafrq:smartalidara2026@aws-1-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=no-verify"
vercel env add DIRECT_URL production --value "postgresql://postgres.ihteylplpdtxdpqxafrq:smartalidara2026@aws-1-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=no-verify"
vercel env add SUPABASE_URL production --value "https://ihteylplpdtxdpqxafrq.supabase.co"
vercel env add SUPABASE_ANON_KEY production --value "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlodGV5bHBscGR0eGRwcXhhZnJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwOTk3ODQsImV4cCI6MjA5MTY3NTc4NH0.ZbFycMjVp6LKKbFZOO5OXAOLlheq3QEPilodFT12dUI"
vercel env add SUPABASE_SERVICE_ROLE_KEY production --value "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlodGV5bHBscGR0eGRwcXhhZnJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjA5OTc4NCwiZXhwIjoyMDkxNjc1Nzg0fQ.T7h-ncmdDm9VkkeRVsOGgk0PxMuGcgsfpGiDankR1r0"
vercel env add VITE_SUPABASE_URL production --value "https://ihteylplpdtxdpqxafrq.supabase.co"
vercel env add VITE_SUPABASE_ANON_KEY production --value "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlodGV5bHBscGR0eGRwcXhhZnJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwOTk3ODQsImV4cCI6MjA5MTY3NTc4NH0.ZbFycMjVp6LKKbFZOO5OXAOLlheq3QEPilodFT12dUI"
vercel env add VITE_PUBLIC_APP_URL production --value "https://www.smartal-idarapro.com"
vercel env add PUBLIC_APP_URL production --value "https://www.smartal-idarapro.com"
vercel env add JWT_SECRET production --value "change-me-in-production-please-use-a-long-random-string"
vercel env add JWT_EXPIRES_DAYS production --value "365"
vercel env add SUPER_ADMIN_EMAIL production --value "lahcenm534@gmail.com"
vercel env add SUPER_ADMIN_PASSWORD production --value "Mohsin1978@"
vercel env add SUPER_ADMIN_NAME production --value "LAHCEN EL MOUTAOUAKIL"
vercel env add SUPER_ADMIN_WHATSAPP production --value "+212780290270"
vercel env add ADMIN_BOOTSTRAP_KEY production --value "temp-reset-key-12345"

echo "✅ Environment variables updated successfully!"
