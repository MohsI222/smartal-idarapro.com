#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# sync-env.sh — يقرأ المتغيرات من .env.local (أو ملف تمرره كمعامل)
# ويضيفها/يحدّثها على Vercel لوضع Production، ثم ينشر الإنتاج.
#
# المتطلبات: vercel login، والمشروع مرتبط هنا (vercel link) ضمن نفس المجلد.
# الاستخدام:
#   chmod +x sync-env.sh
#   ./sync-env.sh
#   ./sync-env.sh /مسار/آخر/.env.local
#
# تحذير: لا ترفع ملف .env.local إلى Git. المتغيرات متعددة الأسطر في الملف
# غير مدعومة بهذا الم_parser البسيط — انسخها يدوياً من لوحة Vercel إن لزم.
# -----------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${1:-${SCRIPT_DIR}/.env.local}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ الملف غير موجود: $ENV_FILE" >&2
  exit 1
fi

if ! command -v vercel &>/dev/null; then
  echo "❌ أمر vercel غير موجود. ثبّته: npm i -g vercel" >&2
  exit 1
fi

cd "$SCRIPT_DIR"

strip_surrounding_quotes() {
  local v="$1"
  local len=${#v}
  if ((len < 2)); then
    printf '%s' "$v"
    return
  fi
  local first="${v:0:1}"
  local last="${v:len-1:1}"
  if [[ ( "$first" == '"' && "$last" == '"' ) || ( "$first" == "'" && "$last" == "'" ) ]]; then
    printf '%s' "${v:1:len-2}"
  else
    printf '%s' "$v"
  fi
}

synced=0

while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
  line="${raw_line%$'\r'}"
  # تجاهل الفارغ والتعليقات
  if [[ -z "${line//[[:space:]]/}" ]] || [[ "$line" =~ ^[[:space:]]*# ]]; then
    continue
  fi

  # export KEY=value
  if [[ "$line" =~ ^[[:space:]]*export[[:space:]]+ ]]; then
    line="${line#*export}"
    line="${line#"${line%%[![:space:]]*}"}" # ltrim
  fi

  if [[ "$line" != *"="* ]]; then
    echo "⚠️  سطر بدون «=»، تخطي." >&2
    continue
  fi

  key="${line%%=*}"
  value="${line#*=}"

  # تقليم مسافات المفتاح
  key="${key%"${key##*[![:space:]]}"}"
  key="${key#"${key%%[![:space:]]*}"}"

  # تقليم مسافات أولية للقيمة (شائع في .env)
  value="${value#"${value%%[![:space:]]*}"}"

  value="$(strip_surrounding_quotes "$value")"

  if [[ -z "$key" ]]; then
    echo "⚠️  سطر بدون مفتاح صالح، تخطي: ${raw_line:0:60}..." >&2
    continue
  fi

  echo "⬆️  Vercel production: $key"
  vercel env add "$key" production --value "$value" --yes --force
  synced=$((synced + 1))
done < "$ENV_FILE"

echo ""
echo "✅ تم مزامنة $synced متغير(ات) إلى Production."

echo ""
echo "🚀 نشر الإنتاج: vercel --prod --yes"
vercel --prod --yes

echo ""
echo "✅ اكتمل."
