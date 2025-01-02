# Use a lightweight Node.js base image
FROM node:16-alpine

# Create and set the working directory
WORKDIR /app

# Copy package manifests first so we can install dependencies separately (better Docker caching)
COPY package*.json ./

# Install dependencies (using npm ci for clean install in CI/CD)
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 3001

# Define the command to run the application
CMD ["node", "newest.js"]
