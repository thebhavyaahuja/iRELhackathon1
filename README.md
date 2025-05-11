# iRELhackathon1
## Twitter Sentiment Analysis & Response Manager

## Setup and Usage with Docker

This project uses Docker to containerize its microservices. Follow the steps below to set up and run the system using Docker.

### Prerequisites

- Docker installed on your system. You can download it from [Docker's official website](https://www.docker.com/).
- Docker Compose installed. It usually comes bundled with Docker Desktop.

### Setup Instructions

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd iRELhackathon1
   ```

2. Build the Docker images for all microservices:
   ```bash
   docker-compose build
   ```

3. Start the services:
   ```bash
   docker-compose up
   ```

   This will start all the microservices defined in the `docker-compose.yml` file.

4. To stop the services:
   ```bash
   docker-compose down
   ```

### Usage Instructions

Once the services are running, you can interact with the system through the following endpoints or scripts:

1. **Mention Analyzer**:
   - Run the Mention Analyzer microservice:
     ```bash
     docker-compose run mention_analyzer
     ```

2. **Other Microservices**:
   - Replace `mention_analyzer` with the name of the desired microservice (e.g., `sentiment_classifier`, `response_generator`).

3. **Logs**:
   - View logs for a specific service:
     ```bash
     docker-compose logs <service-name>
     ```

4. **Rebuild Services**:
   - If you make changes to the code, rebuild the services:
     ```bash
     docker-compose build
     ```

### Notes

- Ensure that the required environment variables are set in a `.env` file or directly in the `docker-compose.yml` file.
- For development purposes, you can modify the `docker-compose.override.yml` file to mount local directories into the containers.
