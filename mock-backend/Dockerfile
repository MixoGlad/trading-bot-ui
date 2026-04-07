# Use a lightweight Node.js LTS image
FROM node:lts-alpine

# Set the working directory
WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install production dependencies only to keep the image lean
RUN npm install --production

# Copy the application source code
COPY . .

# Document the port the server listens on
EXPOSE 3001

# Start the server
# (Assuming your entry point is server.js; adjust if it is index.js)
CMD ["node", "server.js"]