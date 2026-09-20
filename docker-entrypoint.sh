#!/bin/sh
set -e

# A mounted volume arrives owned by root, and the `chown` in the image runs
# *under* the mount point rather than on it — so the uploads directory has to
# have its ownership fixed here, after the mount, or the unprivileged server
# cannot write a single attachment to it.
#
# The container still runs as `nextjs`: this drops privileges before exec'ing
# the server, so only the chown happens as root.

UPLOADS_DIR="${UPLOADS_DIR:-/app/uploads}"
mkdir -p "$UPLOADS_DIR"

if [ "$(id -u)" = "0" ]; then
  # Not recursive: the files under it were written by `nextjs` already, and a
  # full walk would grow with every attachment ever posted.
  chown nextjs:nodejs "$UPLOADS_DIR" || true
  exec su-exec nextjs "$@"
fi

# Already unprivileged — a platform that pins the uid, or `docker run --user`.
# Nothing can be fixed from here, so say so loudly rather than failing on the
# first upload of the day.
probe="$UPLOADS_DIR/.writable"
if touch "$probe" 2>/dev/null; then
  rm -f "$probe"
else
  echo "[roster] $UPLOADS_DIR is not writable by uid $(id -u) — attachments will fail to upload." >&2
fi

exec "$@"
