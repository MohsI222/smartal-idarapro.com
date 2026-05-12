#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# 1) يحذف **كل** متغيرات البيئة من Vercel (production + preview + development)
#    لكل مفتاح يظهر في `vercel env list` لتلك البيئة.
# 2) يدمج القيم من `.env` ثم `.env.local` (الثاني يطغى على الأول).
# 3) يدفع مجموعة كاملة للإنتاج (ومعاينة إن رغبت) بـ `vercel env add` — لأن
#    `vercel env push` غير موجود في CLI الحالي.
#
# يفرض NEXT_PUBLIC_SITE_URL بدون / في النهاية، ويتحقق من الأربعة:
#   Supabase URL (VITE أو NEXT_PUBLIC)، Anon، Service Role، Site URL.
#
# استخدام:
#   ./scripts/vercel-purge-and-push-env.sh
#   PURGE_ONLY=1 ./scripts/vercel-purge-and-push-env.sh   # حذف فقط
#   SYNC_PREVIEW=1 ./scripts/vercel-purge-and-push-env.sh # نفس القيم لـ preview
#
# شرط: vercel login && vercel link من جذر المشروع.
# -----------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

if ! command -v vercel &>/dev/null; then
  echo "❌ vercel CLI غير مثبت." >&2
  exit 1
fi

PYTHON="${PYTHON:-python3}"

list_keys_for_env() {
  local env_name="$1"
  vercel env list "$env_name" --format json 2>&1 | "$PYTHON" "${SCRIPT_DIR}/scripts/vercel_purge_env_json.py" || true
}

purge_env() {
  local env_name="$1"
  echo "🧹 حذف متغيرات: $env_name"
  local keys tmp
  tmp="$(mktemp)"
  list_keys_for_env "$env_name" >"$tmp" || true
  if [[ ! -s "$tmp" ]]; then
    rm -f "$tmp"
    return 0
  fi
  while IFS= read -r key || [[ -n "$key" ]]; do
    [[ -z "$key" ]] && continue
    echo "   rm $key ($env_name)"
    vercel env rm "$key" "$env_name" --yes 2>/dev/null || vercel env remove "$key" "$env_name" --yes 2>/dev/null || true
  done <"$tmp"
  rm -f "$tmp"
}

strip_trailing_slash() {
  local u="$1"
  while [[ "$u" == */ ]]; do
    u="${u%/}"
  done
  printf '%s' "$u"
}

merge_env_files() {
  "$PYTHON" "${SCRIPT_DIR}/scripts/env_merge_for_vercel.py" "$SCRIPT_DIR"
}

get_val() {
  local want="$1"
  local file="$2"
  local line key v
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" != *"="* ]] && continue
    key="${line%%=*}"
    [[ "$key" == "$want" ]] || continue
    v="${line#*=}"
    printf '%s' "$v"
    return 0
  done <"$file"
  return 1
}

# يضيف connection_limit=1 لـ Pooler إن غاب (متوافق مع .env.local المختصر)
ensure_pooler_connection_limit() {
  local v="$1"
  local lower
  lower="$(printf '%s' "$v" | tr '[:upper:]' '[:lower:]')"
  [[ "$lower" != *pgbouncer=true* ]] && { printf '%s' "$v"; return; }
  [[ "$lower" == *connection_limit=* ]] && { printf '%s' "$v"; return; }
  if [[ "$v" == *"?"* ]]; then
    printf '%s&connection_limit=1' "$v"
  else
    printf '%s?connection_limit=1' "$v"
  fi
}

# يضيف sslmode=require لروابط Supabase إن غاب (لوحة Vercel / أدوات أخرى)
ensure_supabase_sslmode() {
  local v="$1"
  local lower
  lower="$(printf '%s' "$v" | tr '[:upper:]' '[:lower:]')"
  [[ "$lower" != *supabase* ]] && { printf '%s' "$v"; return; }
  [[ "$lower" == *sslmode=* ]] && { printf '%s' "$v"; return; }
  if [[ "$v" == *"?"* ]]; then
    printf '%s&sslmode=require' "$v"
  else
    printf '%s?sslmode=require' "$v"
  fi
}

echo "=== 1) Purge all Vercel env vars (production, preview, development) ==="
if [[ "${SKIP_PURGE:-}" != "1" ]]; then
  for env in production preview development; do
    purge_env "$env"
  done
else
  echo "⏭️  SKIP_PURGE=1 — لم يُحذف شيء."
fi

if [[ "${PURGE_ONLY:-}" == "1" ]]; then
  echo "✅ PURGE_ONLY=1 — توقف بعد الحذف."
  exit 0
fi

MERGED="$(mktemp)"
merge_env_files >"$MERGED"

# فرض الموقع الرسمي بدون slash
SITE="$(get_val "NEXT_PUBLIC_SITE_URL" "$MERGED" || true)"
if [[ -z "$SITE" ]]; then
  SITE="$(get_val "VITE_PUBLIC_APP_URL" "$MERGED" || true)"
fi
SITE="$(strip_trailing_slash "${SITE:-}")"
if [[ -n "$SITE" ]]; then
  # تحديث الملف المؤقت للدفع
  grep -v '^NEXT_PUBLIC_SITE_URL=' "$MERGED" >"${MERGED}.new" || true
  mv "${MERGED}.new" "$MERGED"
  echo "NEXT_PUBLIC_SITE_URL=${SITE}" >>"$MERGED"
  # مرآة شائعة للبناء
  grep -v '^VITE_PUBLIC_APP_URL=' "$MERGED" >"${MERGED}.new" || true
  mv "${MERGED}.new" "$MERGED"
  echo "VITE_PUBLIC_APP_URL=${SITE}" >>"$MERGED"
fi

# التحقق من الأربعة
SUP_URL="$(get_val "VITE_SUPABASE_URL" "$MERGED" || true)"
[[ -z "$SUP_URL" ]] && SUP_URL="$(get_val "NEXT_PUBLIC_SUPABASE_URL" "$MERGED" || true)"
[[ -z "$SUP_URL" ]] && SUP_URL="$(get_val "SUPABASE_URL" "$MERGED" || true)"

SUP_ANON="$(get_val "VITE_SUPABASE_ANON_KEY" "$MERGED" || true)"
[[ -z "$SUP_ANON" ]] && SUP_ANON="$(get_val "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$MERGED" || true)"
[[ -z "$SUP_ANON" ]] && SUP_ANON="$(get_val "SUPABASE_ANON_KEY" "$MERGED" || true)"

SRK="$(get_val "SUPABASE_SERVICE_ROLE_KEY" "$MERGED" || true)"
SITE_CHECK="$(get_val "NEXT_PUBLIC_SITE_URL" "$MERGED" || true)"

if [[ -z "$SUP_URL" || -z "$SUP_ANON" || -z "$SRK" || -z "$SITE_CHECK" ]]; then
  echo "❌ بعد دمج .env و .env.local، يجب تعريف:" >&2
  echo "   - Supabase URL (VITE_SUPABASE_URL أو NEXT_PUBLIC_SUPABASE_URL أو SUPABASE_URL)" >&2
  echo "   - Anon (VITE_SUPABASE_ANON_KEY أو NEXT_PUBLIC_SUPABASE_ANON_KEY أو SUPABASE_ANON_KEY)" >&2
  echo "   - SUPABASE_SERVICE_ROLE_KEY" >&2
  echo "   - NEXT_PUBLIC_SITE_URL (أو VITE_PUBLIC_APP_URL كمصدر)" >&2
  rm -f "$MERGED"
  exit 1
fi

# قائمة الدفع الكاملة (إنتاج يعمل — لا نكتفي بأربعة مفاتيح فقط)
KEYS=(
  DATABASE_URL
  DIRECT_URL
  JWT_SECRET
  JWT_EXPIRES_DAYS
  PUBLIC_APP_URL
  PORT
  SUPABASE_URL
  SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  VITE_SUPABASE_URL
  VITE_SUPABASE_ANON_KEY
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  NEXT_PUBLIC_SITE_URL
  VITE_PUBLIC_APP_URL
  VITE_API_URL
  SUPER_ADMIN_EMAIL
  SUPER_ADMIN_PASSWORD
  SUPER_ADMIN_NAME
  SUPER_ADMIN_WHATSAPP
  ADMIN_BOOTSTRAP_KEY
)

push_targets=(production)
if [[ "${SYNC_PREVIEW:-}" == "1" ]]; then
  push_targets+=(preview)
fi

# معاينة Vercel: المتغيرات مرتبطة بفرع Git على المستودع المربوط.
# إن فشل الدفع، عيّن الفرع الصحيح: VERCEL_PREVIEW_GIT_BRANCH=your-branch SYNC_PREVIEW=1
PREVIEW_GIT_BRANCH="${VERCEL_PREVIEW_GIT_BRANCH:-}"

echo ""
echo "=== 2) Push merged env → ${push_targets[*]} ==="

for target in "${push_targets[@]}"; do
  if [[ "$target" == "preview" && -z "${PREVIEW_GIT_BRANCH:-}" ]]; then
    echo "⚠️  تخطي preview — عيّن VERCEL_PREVIEW_GIT_BRANCH=اسم-الفرع-على-GitHub-المربوط ثم أعد التشغيل."
    continue
  fi
  for key in "${KEYS[@]}"; do
    val="$(get_val "$key" "$MERGED" || true)"
    if [[ -z "$val" ]]; then
      echo "⏭️  تخطي (فارغ): $key → $target"
      continue
    fi
    if [[ "$key" == "DATABASE_URL" ]]; then
      val="$(ensure_pooler_connection_limit "$val")"
      val="$(ensure_supabase_sslmode "$val")"
    fi
    if [[ "$key" == "DIRECT_URL" ]] && [[ -n "$val" ]]; then
      val="$(ensure_supabase_sslmode "$val")"
    fi
    echo "⬆️  $target ← $key"
    if [[ "$target" == "preview" ]]; then
      printf '%s' "$val" | vercel env add "$key" "$target" "$PREVIEW_GIT_BRANCH" --yes --force
    else
      printf '%s' "$val" | vercel env add "$key" "$target" --yes --force
    fi
  done
done

rm -f "$MERGED"
echo ""
echo "✅ اكتمل. للنشر: vercel --prod --yes"
echo "ℹ️  ملاحظة: أمر vercel env push غير متوفر في CLI؛ استُبدل بـ vercel env add لكل مفتاح."
