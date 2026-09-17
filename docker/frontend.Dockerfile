FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* tsconfig.base.json ./
COPY frontend/package.json frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm install
COPY . .
EXPOSE 5173
