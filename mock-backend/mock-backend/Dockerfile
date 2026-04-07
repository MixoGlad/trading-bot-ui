# Use an official Node.js runtime as the base image
FROM node:lts-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package files and install dependencies first to leverage Docker's cache
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port defined in server.cjs
EXPOSE 3001

# Start the application
CMD ["node", "server.cjs"]