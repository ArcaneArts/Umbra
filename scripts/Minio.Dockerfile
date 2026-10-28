# Source archives and base images are immutable inputs; Go verifies go.sum.
FROM golang:1.25-alpine@sha256:1ae0735f00daffa3aaf1363a5184c0d2dc55c78e3db4ec70241cdac97bf84b59 AS go-base
ENV CGO_ENABLED=0 GOTOOLCHAIN=local

FROM go-base AS minio-build
ADD --checksum=sha256:c9598dcce3440977e79f787f2ba0e7e4d92c8d556bd51e7cef3785bafd6635f3 https://codeload.github.com/minio/minio/tar.gz/refs/tags/RELEASE.2025-09-07T16-13-09Z /tmp/source.tar.gz
WORKDIR /src/minio
RUN tar -xzf /tmp/source.tar.gz --strip-components=1 && rm /tmp/source.tar.gz
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    go build -p 2 -mod=readonly -trimpath -buildvcs=false -ldflags="-s -w" -o /out/minio .

FROM go-base AS mc-build
ADD --checksum=sha256:29db22500374169a43951c7cef09daf19e7291ea5ba00ac10f321371b0a35b32 https://codeload.github.com/minio/mc/tar.gz/refs/tags/RELEASE.2025-08-13T08-35-41Z /tmp/source.tar.gz
WORKDIR /src/mc
RUN tar -xzf /tmp/source.tar.gz --strip-components=1 && rm /tmp/source.tar.gz
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    go build -p 2 -mod=readonly -trimpath -buildvcs=false -ldflags="-s -w" -o /out/mc .

FROM alpine:3.23@sha256:ff7f0c727dd796aa36787bfcd9a64bf35a6ce72a73451b3359fde849b6703d63
COPY --from=minio-build /out/minio /usr/local/bin/minio
COPY --from=mc-build /out/mc /usr/local/bin/mc
COPY --from=go-base /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=minio-build /src/minio/LICENSE /usr/share/licenses/minio/LICENSE
COPY --from=mc-build /src/mc/LICENSE /usr/share/licenses/mc/LICENSE
LABEL org.opencontainers.image.title="Umbra development MinIO" \
      org.opencontainers.image.source="https://github.com/minio/minio" \
      org.opencontainers.image.version="RELEASE.2025-09-07T16-13-09Z" \
      org.opencontainers.image.licenses="AGPL-3.0-only"
RUN adduser -D -u 10001 minio && mkdir /data && chown minio:minio /data
ENV HOME=/home/minio MINIO_UPDATE=off
USER minio
EXPOSE 9000 9001
ENTRYPOINT ["minio"]
CMD ["server", "/data", "--console-address", ":9001"]
