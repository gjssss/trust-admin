#!/bin/sh
set -eu
node /app/dist/init-db.cjs
exec "$@"
