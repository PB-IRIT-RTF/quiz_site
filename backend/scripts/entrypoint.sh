#!/bin/sh
set -eu

if [ "${AUTO_CREATE_ADMIN_ON_STARTUP:-false}" = "true" ]; then
  if [ -z "${ADMIN_PASSWORD:-}" ]; then
    echo "[entrypoint] AUTO_CREATE_ADMIN_ON_STARTUP=true but ADMIN_PASSWORD is empty, skip admin creation"
  else
    echo "[entrypoint] Ensuring admin user exists"
    if [ "${ADMIN_ROTATE_ON_STARTUP:-false}" = "true" ]; then
      python scripts/create_admin.py \
        --username "${ADMIN_USERNAME:-admin}" \
        --password "${ADMIN_PASSWORD}" \
        --rotate-password
    else
      python scripts/create_admin.py \
        --username "${ADMIN_USERNAME:-admin}" \
        --password "${ADMIN_PASSWORD}"
    fi
  fi
fi

exec "$@"
