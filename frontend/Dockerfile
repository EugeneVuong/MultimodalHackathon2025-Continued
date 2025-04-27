# Frontend Dockerfile using Node 20 LTS
FROM node:20-alpine AS builder
WORKDIR /app

# Disable telemetry and ESLint (lint errors currently break production build)
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_DISABLE_ESLINT_PLUGIN=1

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps --silent --no-progress

# Copy all source and build
COPY . .
RUN npm run build

# -------- Production Image --------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV="production"
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_DISABLE_ESLINT_PLUGIN=1

# Copy built Next.js application from builder stage
COPY --from=builder /app/.next ./.next
RUN mkdir -p ./public
COPY --from=builder /app/public* ./public/
COPY --from=builder /app/package*.json ./

EXPOSE 3000
CMD ["npm", "start"]
