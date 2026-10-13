# uWebSockets native addon needs glibc >= 2.38 (Debian Bookworm node:22 image is too old)
FROM node:22-noble

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

# Start the server
CMD ["npm", "start"]
