# Multi-stage build for ultra-small Docker images and fast cold starts

# Stage 1: Build & Compile Static Assets
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install ffmpeg for ffprobe functionality
RUN apk add --no-cache ffmpeg

# Copy package configuration and install production-only dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled production assets and bundled backend
COPY --from=builder /app/dist ./dist

# Copy persistence seed config files if they exist in the workspace
COPY --from=builder /app/tv_guide.json* ./
COPY --from=builder /app/rumble_cache.json* ./
COPY --from=builder /app/channel_registry.json* ./

# Port 3000 is the ONLY port exposed by the platform/ingress proxy
EXPOSE 3000

# Execute the compiled production server bundle directly
CMD ["node", "dist/server.cjs"]

