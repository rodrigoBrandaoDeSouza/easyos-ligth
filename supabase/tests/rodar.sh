#!/usr/bin/env bash
# Roda as migrations e os cenários de teste num Postgres descartável (Docker).
# Uso (na raiz do repositório):  bash supabase/tests/rodar.sh
set -euo pipefail

cd "$(dirname "$0")/.."
CONTAINER=easyos-teste-pg

docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=teste postgres:16 >/dev/null
trap 'docker rm -f "$CONTAINER" >/dev/null 2>&1 || true' EXIT

until docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
sleep 1

psql_arquivo() {
  echo "==> $1"
  docker exec -i "$CONTAINER" psql -U postgres -q -v ON_ERROR_STOP=1 < "$1"
}

psql_arquivo tests/00_ambiente_supabase.sql
for f in migrations/*.sql; do psql_arquivo "$f"; done
for f in tests/[1-9]*.sql; do psql_arquivo "$f"; done

echo "Tudo certo."
