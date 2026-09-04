# Consulta de Notas · Seguidores

Aplicación web para consultar las notas de los alumnos a partir de dos archivos Excel
(`Seguidores_Primer_Modulo.xlsx` y `Seguidores_Segundo_Modulo.xlsx`).

- **Frontend:** Angular 21 (versión LTS actual) + Bootstrap 5, servido con Nginx.
- **Backend:** Node.js + Express, que lee los archivos Excel desde una carpeta local.
- **Orquestación:** Docker Compose (dos contenedores).

---

## Estructura del proyecto

```
app/
├── docker-compose.yml          # Orquesta frontend + backend
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js               # API Express que lee los Excel
│   └── database/               # >>> Carpeta local con las bases de datos <<<
│       ├── Seguidores_Primer_Modulo.xlsx
│       └── Seguidores_Segundo_Modulo.xlsx
└── frontend/
    ├── Dockerfile
    ├── nginx.conf              # Sirve Angular y redirige /api al backend
    ├── package.json
    ├── angular.json
    └── src/
        └── app/
            ├── search/         # Pantalla de búsqueda
            ├── results/        # Pantalla de resultados
            └── services/       # Servicio HTTP
```

Los archivos Excel viven en `backend/database/`. Para actualizar las notas,
reemplaza esos archivos (manteniendo el mismo nombre) y reconstruye el contenedor.

---

## Requisitos previos

Solo necesitas tener instalado **Docker Desktop** (incluye Docker Compose):

- Windows / macOS: https://www.docker.com/products/docker-desktop/
- Linux: instala `docker` y `docker compose` desde tu gestor de paquetes.

Verifica la instalación:

```bash
docker --version
docker compose version
```

---

## Pasos para el despliegue local con Docker

### 1. Descomprime el proyecto

Descomprime el archivo `.zip` en una carpeta de tu elección. Entra a la carpeta `app`:

```bash
cd app
```

### 2. Construye y levanta los contenedores

Desde la carpeta `app` (donde está `docker-compose.yml`), ejecuta:

```bash
docker compose up --build
```

Esto hará automáticamente:

1. Construir la imagen del **backend** (Node + Express) e instalar sus dependencias.
2. Construir la imagen del **frontend**: compila la app Angular y la empaqueta en Nginx.
3. Levantar ambos contenedores conectados entre sí.

La primera vez tarda algunos minutos (descarga imágenes base y compila Angular).

### 3. Abre la aplicación

Cuando veas en la consola que ambos contenedores están corriendo, abre el navegador en:

```
http://localhost:8080
```

La API del backend queda disponible (por si quieres probarla directamente) en:

```
http://localhost:3000/api/health
```

### 4. Detener la aplicación

En la terminal donde corre, presiona `Ctrl + C`. Para eliminar los contenedores:

```bash
docker compose down
```

### Ejecutar en segundo plano (opcional)

```bash
docker compose up --build -d      # arranca en segundo plano
docker compose logs -f            # ver los logs
docker compose down               # detener
```

---

## Cómo usar la aplicación

1. En la pantalla de búsqueda, escribe el **correo electrónico** del alumno
   (columna `CorreoElectronico` de los Excel).
2. Selecciona el **módulo** en el desplegable:
   - **Módulo 1** → consulta `Seguidores_Primer_Modulo.xlsx`
   - **Módulo 2** → consulta `Seguidores_Segundo_Modulo.xlsx`
3. Pulsa **Consultar notas**.
   - Si el correo no existe en ese módulo, aparece el mensaje **"Alumno no existe."**
   - Si existe, se abre la pantalla de resultados con **todas las columnas** del Excel
     en formato tabla, filtradas solo para ese alumno.
4. En la tabla, la celda **NotaFinal**:
   - Se muestra en **verde** con mensaje **Aprobado** si la nota es **≥ 7**.
   - Se muestra en **rosado** con mensaje **Reprobado** si la nota es **< 7**
     (recordando que la nota de aprobación es mayor o igual a 7).
5. Usa el botón **"← Consultar otro alumno"** para volver a la búsqueda.

---

## Actualizar las notas (nuevos Excel)

1. Sustituye los archivos dentro de `backend/database/` manteniendo los nombres:
   - `Seguidores_Primer_Modulo.xlsx`
   - `Seguidores_Segundo_Modulo.xlsx`
2. Reconstruye:

   ```bash
   docker compose up --build
   ```

---

## Panel de administración (editar los Excel desde la web)

Hay una pantalla de administración en `/admin` (link "Administración" bajo el
título) donde, con una contraseña, se puede buscar un alumno por correo y
módulo, editar sus datos, eliminarlo o crear uno nuevo. Los cambios se
guardan directamente en el archivo `.xlsx` correspondiente — no hace falta
reconstruir los contenedores.

### Configurar la contraseña

1. Copia `.env.example` a `.env` (en la carpeta `app/`, junto a
   `docker-compose.yml`) y define `ADMIN_PASSWORD`:

   ```bash
   cp .env.example .env
   ```

2. Levanta los contenedores normalmente (`docker compose up --build`).
   Docker Compose toma automáticamente el archivo `.env`.

Si `ADMIN_PASSWORD` no está definida, el login del panel devuelve un error
y no se puede entrar — es intencional, para no dejar el panel abierto por
descuido.

### Notas sobre la sesión y los respaldos

- La sesión de administrador dura 8 horas y se invalida si el contenedor del
  backend se reinicia (a menos que también definas `JWT_SECRET` fijo en `.env`).
- Antes de cada guardado, el backend hace una copia del Excel en
  `backend/database/backups/` (no se sube a git). Sirve para recuperar datos
  si una edición sale mal.

---

## Solución de problemas

- **El puerto 8080 o 3000 ya está en uso:** edita `docker-compose.yml` y cambia
  el primer número del mapeo de puertos, por ejemplo `"9090:80"`, y usa esa URL.
- **Cambios que no se reflejan:** reconstruye con `docker compose up --build`.
- **Ver logs de un servicio:** `docker compose logs -f backend` o `... frontend`.
