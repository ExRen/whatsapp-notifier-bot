FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Render akan set PORT=10000 di runtime
ENV PORT=10000
EXPOSE 10000

CMD ["npm", "start"]
