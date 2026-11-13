FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev || npm install --omit=dev --legacy-peer-deps
COPY . .
RUN npx prisma generate || true
RUN npm run build || true
EXPOSE 4220
CMD ["node", "dist/src/main.js"]
