FROM node:20-alpine

WORKDIR /app

# Instalar dependencias
COPY package.json ./
RUN npm install --omit=dev

# Copiar el código y la base de datos (archivos Excel)
COPY server.js ./
COPY database ./database

EXPOSE 3000

CMD ["node", "server.js"]
