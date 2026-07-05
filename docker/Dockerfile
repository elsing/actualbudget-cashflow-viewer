# Stage 1: build
FROM node:24-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: runtime — only the standalone output, no source or devDeps
FROM node:24-alpine AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production
ENV PORT=5008

COPY --from=builder /usr/src/app/.next/standalone ./
COPY --from=builder /usr/src/app/.next/static ./.next/static
COPY --from=builder /usr/src/app/public ./public

EXPOSE 5008
CMD ["node", "server.js"]
