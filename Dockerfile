# uWebSockets native addon needs glibc >= 2.38 (node:22-bookworm is too old; no official node:22-noble tag)
FROM node:22-trixie

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application code
COPY . .

# Generate the Prisma client for database access
RUN npx prisma generate

EXPOSE 5001
EXPOSE 3001

COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

CMD ["/usr/local/bin/docker-entrypoint.sh"]
