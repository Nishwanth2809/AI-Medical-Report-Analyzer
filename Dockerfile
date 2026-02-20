FROM node:22-bookworm-slim

WORKDIR /app

# OCR + PDF tooling for image/scanned report extraction
RUN apt-get update \
  && apt-get install -y --no-install-recommends tesseract-ocr poppler-utils \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./

ENV NODE_ENV=production
EXPOSE 5000

CMD ["npm", "start"]
