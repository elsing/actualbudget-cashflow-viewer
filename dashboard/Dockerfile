FROM node:22-alpine
WORKDIR /app
COPY dashboard/package.json ./
RUN npm install --omit=dev
RUN npm ci
COPY dashboard/ .
RUN npm run build
ENV PORT=5007
EXPOSE 5007
CMD ["npx", "serve", "dist"]