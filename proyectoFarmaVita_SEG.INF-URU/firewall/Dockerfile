FROM alpine:3.20

RUN apk add --no-cache nftables iproute2 iputils tcpdump conntrack-tools bash

COPY nftables.conf /etc/nftables.conf
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod 0600 /etc/nftables.conf && chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
