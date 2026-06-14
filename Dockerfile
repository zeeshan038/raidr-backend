FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Generate the Prisma client for database access
RUN npx prisma generate

# Expose the API port
EXPOSE 5001

# Start the server
CMD ["npm", "start"]
