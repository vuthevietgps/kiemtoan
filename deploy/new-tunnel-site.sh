#!/usr/bin/env bash
# Tạo Cloudflare Tunnel RIÊNG cho một hệ thống (mỗi hệ thống 1 tunnel, 1 thư mục, 1 compose project) —
# giống cách mailing.smarterp.vn / tool.smarterp.vn đang chạy. Không đụng tunnel chung /etc/cloudflared.
#
# Chạy trên server (cần ~/.cloudflared/cert.pem — đã có):
#   ./deploy/new-tunnel-site.sh <tên-tunnel> <hostname> [service] [thư-mục]
#   ./deploy/new-tunnel-site.sh erpads-smarterp-vn erpads.smarterp.vn http://app:3000 ~/erpads-smarterp-vn
#
# Kết quả trong <thư-mục>/cloudflared/: credentials.json (bí mật, chmod 600) + config.yml,
# và bản ghi DNS CNAME <hostname> → <tunnel-id>.cfargotunnel.com trên Cloudflare.
set -euo pipefail

NAME=${1:?Thiếu tên tunnel}
HOST=${2:?Thiếu hostname}
SERVICE=${3:-http://app:3000}
DIR=${4:-$PWD}
CF=${CLOUDFLARED:-cloudflared}

mkdir -p "$DIR/cloudflared"

tunnel_id() {
  "$CF" tunnel list -o json 2>/dev/null |
    python3 -c 'import json,sys; n=sys.argv[1]; print(next((t["id"] for t in json.load(sys.stdin) if t["name"]==n), ""))' "$NAME"
}

ID=$(tunnel_id)
if [ -z "$ID" ]; then
  "$CF" tunnel create "$NAME"
  ID=$(tunnel_id)
fi
[ -n "$ID" ] || { echo "Không lấy được id tunnel $NAME" >&2; exit 1; }

CRED_SRC="$HOME/.cloudflared/$ID.json"
[ -f "$CRED_SRC" ] || { echo "Không thấy $CRED_SRC (tunnel tạo ở máy khác?)" >&2; exit 1; }
install -m 600 "$CRED_SRC" "$DIR/cloudflared/credentials.json"

cat > "$DIR/cloudflared/config.yml" <<EOF
tunnel: $ID
credentials-file: /etc/cloudflared/credentials.json
metrics: 127.0.0.1:2000
ingress:
  - hostname: $HOST
    service: $SERVICE
    originRequest:
      connectTimeout: 30s
  - service: http_status:404
EOF

echo "Tunnel $NAME ($ID) → $HOST → $SERVICE"
echo "Cấu hình: $DIR/cloudflared/config.yml"

# Tạo CNAME. cert.pem trên server chỉ có quyền với tên miền đã chọn lúc `cloudflared tunnel login`;
# tên miền khác (vd smarterp.vn) sẽ báo "Authentication error" → thêm tay trên dashboard Cloudflare.
if ! "$CF" tunnel route dns "$NAME" "$HOST"; then
  cat <<EOF

>>> Chưa tạo được DNS tự động. Vào Cloudflare → tên miền → DNS → Records → Add record:
    Type: CNAME   Name: ${HOST%%.*}   Target: $ID.cfargotunnel.com   Proxy: BẬT (đám mây cam)
EOF
fi
