FROM python:3.12.16-slim-bookworm@sha256:935c3c5b12357a7e10caa9c1e6ca5692344d97cf229832ef584be2cec9fc03df AS system

# The snapshot fixes dependency resolution while retaining Debian signature checks.
RUN rm -f /etc/apt/sources.list /etc/apt/sources.list.d/debian.sources \
    && printf '%s\n' \
       'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian/20261120T000000Z bookworm main' \
       'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian/20261120T000000Z bookworm-updates main' \
       'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian-security/20261120T000000Z bookworm-security main' \
       > /etc/apt/sources.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates curl openssh-client rsync ripgrep unzip xz-utils procps \
       build-essential pkg-config libssl-dev libcurl4-openssl-dev libexpat1-dev zlib1g-dev \
       libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libdbus-1-3 \
       libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
       libpango-1.0-0 libcairo2 libx11-xcb1 libxcb1 libxext6 libxshmfence1 \
       fonts-liberation fonts-noto-color-emoji xvfb xauth \
    && rm -rf /var/lib/apt/lists/*

ENV PATH="/usr/local/go/bin:/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin"

FROM system AS tools
ARG TARGETARCH
COPY config/toolchain.json /opt/potato/config/toolchain.json
COPY runner/install-image-tools.py /opt/potato/install-image-tools.py
RUN python3 /opt/potato/install-image-tools.py --config /opt/potato/config/toolchain.json --arch "$TARGETARCH"

FROM system AS runner
COPY --from=tools /usr/local/ /usr/local/
COPY config/toolchain.json /opt/potato/config/toolchain.json
COPY runner_setup.py /opt/potato/runner_setup.py
COPY scripts/prepare-runner.py scripts/doctor-runner.py /opt/potato/scripts/
COPY runner/claude-launcher.sh runner/entrypoint.sh runner/start-runner.sh \
     runner/claude-settings.json runner/multica-claude.local.md /opt/potato/runner/
RUN groupadd --gid 10001 runner \
    && useradd --uid 10001 --gid 10001 --create-home --shell /bin/bash runner \
    && chmod 0755 /opt/potato/runner/*.sh \
    && mkdir -p /home/runner/workspaces \
    && chown -R 10001:10001 /home/runner

ENV HOME="/home/runner" \
    CLAUDE_CONFIG_DIR="/home/runner/.claude" \
    CLAUDE_REAL="/usr/local/bin/claude" \
    DISABLE_AUTOUPDATER="1" \
    GOTOOLCHAIN="local" \
    UV_PYTHON_DOWNLOADS="never" \
    PYTHONUNBUFFERED="1"
USER 10001:10001
WORKDIR /home/runner
# The final registry digest is assigned after publication; this build check uses
# the immutable base reference solely to satisfy the doctor's release schema.
RUN python3 -c 'import json,sys; sys.path.insert(0,"/opt/potato"); from runner_setup import doctor; c=json.load(open("/opt/potato/config/toolchain.json")); r=doctor({"schema":1,"image":c["base_image"],"tools":c["tools"]}); print(json.dumps(r,indent=2)); sys.exit(0 if all(x["ok"] for x in r) else 1)'
CMD ["/bin/bash"]
