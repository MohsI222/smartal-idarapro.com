#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# يدفع إلى Vercel **Production** المتغيرات الستة المرجعية من `.env` في جذر المشروع.
# (انظر قائمة KEYS أدناه). يتحقق أن DATABASE_URL يحتوي connection_limit=1 و sslmode=require لـ Supabase.
#
# استخدام:  ./scripts/vercel-sync-production-env.sh  [مسار-اختياري-لـ-.env]
# شرط: vercel login && vercel link من جذر المشروع.
#
# لتنظيف أسماء قديمة على Production: vercel env ls production
# ثم: vercel env rm OLD_NAME production --yes
# -----------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-${SCRIPT_DIR}/.env}"

KEYS=(
  DATABASE_URL
  DIRECT_URL
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  NEXT_PUBLIC_SITE_URL
)

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ ملف البيئة غير موجود: $ENV_FILE" >&2
  exit 1
fi

if ! command -v vercel &>/dev/null; then
  echo "❌ vercel CLI غير مثبت." >&2
  exit 1
fi

cd "$SCRIPT_DIR"

strip_surrounding_quotes() {
  local v="$1"
  local len=${#v}
  if ((len < 2)); then printf '%s' "$v"; return; fi
  local first="${v:0:1}" last="${v:len-1:1}"
  if [[ ( "$first" == '"' && "$last" == '"' ) || ( "$first" == "'" && "$last" == "'" ) ]]; then
    printf '%s' "${v:1:len-2}"
  else
    printf '%s' "$v"
  fi
}

extract_value_for_key() {
  local want="$1"
  local line raw_line key v
  while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
    line="${raw_line%$'\r'}"
    [[ -z "${line//[[:space:]]/}" || "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^[[:space:]]*export[[:space:]]+ ]]; then
      line="${line#*export}"
      line="${line#"${line%%[![:space:]]*}"}"
    fi
    [[ "$line" != *"="* ]] && continue
    key="${line%%=*}"
    key="${key%"${key##*[![:space:]]}"}"
    key="${key#"${key%%[![:space:]]*}"}"
    [[ "$key" == "$want" ]] || continue
    v="${line#*=}"
    v="${v#"${v%%[![:space:]]*}"}"
    strip_surrounding_quotes "$v"
    return 0
  done < "$ENV_FILE"
  printf ''
  return 1
}

for key in "${KEYS[@]}"; do
  val="$(extract_value_for_key "$key" || true)"
  if [[ -z "$val" ]]; then
    echo "⚠️  تخطي (غير معرّف في الملف): $key" >&2
    continue
  fi
  if [[ "$key" == "DATABASE_URL" ]] && [[ "$val" != *connection_limit=1* ]]; then
    echo "❌ DATABASE_URL يجب أن يحتوي connection_limit=1" >&2
    exit 1
  fi
  if [[ "$key" == "DATABASE_URL" ]] && [[ "$val" != *pgbouncer=true* ]]; then
    echo "⚠️  تحذير: DATABASE_URL يُفضّل أن يحتوي pgbouncer=true للمنفذ 6543" >&2
  fi
  if [[ "$key" == "DATABASE_URL" || "$key" == "DIRECT_URL" ]] && [[ "$val" == *supabase* ]] && [[ "$val" != *sslmode=* ]]; then
    echo "❌ $key لـ Supabase يجب أن يحتوي sslmode=require في سلسلة الاتصال" >&2
    exit 1
  fi
  echo "⬆️  production ← $key"
  vercel env add "$key" production --value "$val" --yes --force
done

echo ""
echo "✅ اكتمل دفع المتغيرات. للنشر: vercel --prod --yes"
