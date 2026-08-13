FROM node:20

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Generate the Prisma client for database access
RUN npx prisma generate

EXPOSE 5001
EXPOSE 3001

# Start the server
CMD ["npm", "start"]
