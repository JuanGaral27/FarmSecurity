#!/bin/sh
set -e
/usr/local/bin/net-init.sh
nginx -t
exec nginx -g 'daemon off;'
