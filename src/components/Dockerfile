# Use an official Node.js runtime as the base image
FROM node:lts-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port (matches deployment.yaml)
EXPOSE 5173

# Start the application accessible externally
CMD ["npm", "run", "dev", "--", "--host"]