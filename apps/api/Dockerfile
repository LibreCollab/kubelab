# syntax=docker/dockerfile:1

FROM node:24-alpine AS web
WORKDIR /src
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/sim/package.json packages/sim/package.json
COPY packages/content/package.json packages/content/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY apps/web apps/web
COPY packages packages
RUN pnpm build

FROM golang:1.27-alpine AS build
WORKDIR /src
COPY apps/api/go.* ./
RUN go mod download
COPY apps/api ./
COPY --from=web /src/apps/web/dist ./internal/web/dist
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/kubelab ./cmd/api

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/kubelab /kubelab
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/kubelab"]
