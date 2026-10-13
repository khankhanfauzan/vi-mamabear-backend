#!/usr/bin/env bash
# Cek otomatis checklist "Sebelum Copy-Paste ke FE" di PANDUAN_DOKUMENTASI_BE.md (bagian 9).
# Pemakaian: bash scripts/check-docs.sh
set -uo pipefail
cd "$(dirname "$0")/.."

fail=0
err() {
  echo "FAIL: $*"
  fail=1
}

shopt -s nullglob
mdx=(docs/*.mdx)

for f in docs/*; do
  [ -f "$f" ] || continue
  case "$f" in *.mdx | docs/meta.json) ;; *) err "file tidak diizinkan di docs/ (harus .mdx, meta.json, atau folder assets/): $f" ;; esac
done

for f in "${mdx[@]}"; do
  base=$(basename "$f" .mdx)
  [[ "$base" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || err "nama file harus kebab-case: $f"
done

for f in "${mdx[@]}"; do
  [ "$(head -1 "$f")" = "---" ] || err "frontmatter tidak di baris 1: $f"
  grep -q '^title: ' "$f" || err "frontmatter tanpa title: $f"
  grep -q '^description: ' "$f" || err "frontmatter tanpa description: $f"

  out=$(awk -v F="$f" '
    NR==1 && $0=="---" { fm=1; next }
    fm && $0=="---" { fm=0; next }
    fm { next }
    /^`{3,}/ {
      if (open) { open=0 } else {
        open=1
        if ($0 !~ /^`{3,}[a-zA-Z0-9]+/) print "FAIL: code fence tanpa tag bahasa: " F ":" NR
      }
      next
    }
    open==0 && /^# / { print "FAIL: H1 di body: " F ":" NR }
  ' "$f")
  [ -z "$out" ] || {
    echo "$out"
    fail=1
  }
done

if command -v node >/dev/null; then
  pages=$(node -e 'console.log(require("./docs/meta.json").pages.join("\n"))') || err "docs/meta.json tidak bisa dibaca"
  for p in $pages; do
    [ -f "docs/$p.mdx" ] || err "meta.json menyebut halaman yang tidak ada: $p"
  done
  for f in "${mdx[@]}"; do
    grep -qx "$(basename "$f" .mdx)" <<<"$pages" || err "belum terdaftar di docs/meta.json: $(basename "$f")"
  done
  [ "${pages%%$'\n'*}" = "index" ] || err '"index" harus jadi halaman pertama di docs/meta.json'
else
  err "node tidak ditemukan, cek meta.json dilewati"
fi

if grep -InE 'sk-or-v1-|-----BEGIN [A-Z ]*PRIVATE KEY|eyJhbGciOi' "${mdx[@]}"; then
  err "ada indikasi kredensial asli di docs/"
fi

[ "$fail" = 0 ] && echo "OK: docs/ sesuai PANDUAN_DOKUMENTASI_BE.md"
exit "$fail"
