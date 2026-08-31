# ---------- Etapa 1: compilar la app Angular ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# ---------- Etapa 2: servir con Nginx ----------
FROM nginx:alpine
# Copiar el build de Angular
COPY --from=build /app/dist/seguidores-frontend/browser /usr/share/nginx/html
# Configuración de Nginx (SPA + proxy /api)
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
