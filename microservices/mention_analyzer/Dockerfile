# Use an official Node.js runtime as a parent image
FROM node:18-alpine AS base

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install app dependencies
RUN npm install --omit=dev

# Copy the rest of the application's code
COPY . .

# Define environment variables (examples, uncomment and set as needed)
# ENV VAR_NAME=value

# Specify the command to run on container start
CMD [ "npm", "start" ]
