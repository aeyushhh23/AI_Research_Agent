FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* tsconfig.base.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY mcp-servers/package.json mcp-servers/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm install
COPY . .
RUN npm run build -w @ai-research-agent/shared && npm run build -w @ai-research-agent/mcp-servers && npm run build -w @ai-research-agent/backend
EXPOSE 4000
