FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev || npm install --omit=dev --legacy-peer-deps
COPY . .
RUN npm run build || true
EXPOSE 3220
CMD ["npm", "run", "start"]
