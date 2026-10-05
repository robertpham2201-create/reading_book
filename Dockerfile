# Multi-stage Dockerfile for Kindle English Reader on Dokploy
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package definitions
COPY package.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies for both frontend and backend
RUN npm run install:all

# Copy all source files
COPY . .

# Build both backend (TypeScript -> JS) and frontend (Vite -> dist)
RUN npm run build

# Production runner stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Copy package files and production node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/backend/package.json ./backend/package.json
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/sample_books ./backend/sample_books
COPY --from=builder /app/backend/server.js ./backend/server.js
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/db ./db

# Ensure uploads directory exists
RUN mkdir -p /app/backend/uploads

EXPOSE 3001

CMD ["npm", "start"]
