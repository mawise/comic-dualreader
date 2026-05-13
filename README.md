# comic-dualreader

## Running with Docker Compose

You can easily run this application using Docker Compose.

1. Clone the repository:
   ```bash
   git clone https://github.com/mawise/comic-dualreader.git
   cd comic-dualreader
   ```

2. Start the container:
   ```bash
   docker-compose up -d
   ```

3. Open your browser and navigate to `http://localhost:3000`.

To stop the container, run:
```bash
docker-compose down
```

## Local Development
To run locally without Docker:
```bash
npm install
npm run build
node server.js
```
