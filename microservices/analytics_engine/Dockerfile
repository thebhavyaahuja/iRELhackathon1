# Use an official Node.js runtime as a parent image
FROM node:18-alpine AS base

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install app dependencies
# For production, it's good practice to install only production dependencies
# However, if your build step is part of npm install (e.g. for TypeScript), adjust accordingly
RUN npm install --omit=dev

# Copy the rest of the application's code from your context
COPY . .

# Make port 3000 available to the world outside this container (default, adjust if needed)
# The Analytics Engine doesn't explicitly listen on a port in the current code,
# but if it were to expose an API, this would be relevant.
# For now, it's more of a worker connecting to a DB.
# EXPOSE 3000 

# Define environment variables that the app might need
# These should be configured during runtime (e.g., via docker-compose or Kubernetes secrets)
# ENV NODE_ENV=production
# ENV PGHOST=your_db_host
# ENV PGUSER=your_db_user
# ENV PGPASSWORD=your_db_password
# ENV PGDATABASE=analytics_db
# ENV PGPORT=5432

# Specify the command to run on container start
CMD [ "npm", "start" ]
