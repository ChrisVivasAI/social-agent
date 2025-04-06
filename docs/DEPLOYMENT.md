# Social Media Agent - Deployment Guide

This document outlines the steps to deploy the Social Media Agent using Docker and Google Cloud Run.

## Docker Configuration

### Prerequisites
- Docker installed on your development machine
- Docker Hub account (optional, for image publishing)
- Docker Compose (optional, for local multi-container setup)

### Dockerfile

The project includes a multi-stage Dockerfile to optimize the container size and build process:

```dockerfile
# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript
RUN yarn build

# Production stage
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

# Set environment variables
ENV NODE_ENV=production

# Playwright browsers are needed for screenshots
# This installs Chromium Headless Shell for screenshot functionality
RUN npx playwright install chromium

# Expose the port the app runs on
EXPOSE 54368

# Command to run the application
CMD ["node", "dist/index.js"]
```

### Building and Running Locally

```bash
# Build the Docker image
docker build -t social-media-agent .

# Run the container
docker run -p 54368:54368 --env-file .env social-media-agent
```

### Using Docker Compose (Optional)

For local development with multiple services (e.g., database), create a `docker-compose.yml` file:

```yaml
version: '3'

services:
  app:
    build: .
    ports:
      - "54368:54368"
    env_file:
      - .env
    depends_on:
      - firestore-emulator

  firestore-emulator:
    image: mtlynch/firestore-emulator:latest
    ports:
      - "8080:8080"
    environment:
      - FIRESTORE_PROJECT_ID=social-media-agent-dev
```

Run with:
```bash
docker-compose up
```

## Google Cloud Run Deployment

### Prerequisites
- Google Cloud account
- Google Cloud SDK installed
- Google Cloud project created
- Billing enabled on your Google Cloud project

### Initial Setup

1. **Initialize the Google Cloud SDK**:
   ```bash
   gcloud init
   ```

2. **Set the active project**:
   ```bash
   gcloud config set project YOUR_PROJECT_ID
   ```

3. **Enable required APIs**:
   ```bash
   gcloud services enable \
     run.googleapis.com \
     artifactregistry.googleapis.com \
     cloudbuild.googleapis.com \
     firestore.googleapis.com \
     secretmanager.googleapis.com \
     aiplatform.googleapis.com
   ```

### Storing Secrets

Store sensitive environment variables in Google Secret Manager:

```bash
# Create a secret for each environment variable
gcloud secrets create DISCORD_BOT_TOKEN --replication-policy="automatic"
gcloud secrets create TWITTER_API_KEY --replication-policy="automatic"
gcloud secrets create LINKEDIN_CLIENT_ID --replication-policy="automatic"
# etc.

# Add the secret values
gcloud secrets versions add DISCORD_BOT_TOKEN --data-file="/path/to/discord_token.txt"
# Repeat for other secrets
```

### Building and Deploying the Container

1. **Configure Docker for Google Cloud**:
   ```bash
   gcloud auth configure-docker
   ```

2. **Build and push the image to Google Container Registry**:
   ```bash
   # Build the image with Google Cloud Build
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/social-media-agent
   ```

3. **Deploy to Cloud Run**:
   ```bash
   gcloud run deploy social-media-agent \
     --image gcr.io/YOUR_PROJECT_ID/social-media-agent \
     --platform managed \
     --allow-unauthenticated \
     --region us-central1 \
     --memory 1Gi \
     --cpu 1 \
     --set-secrets=DISCORD_BOT_TOKEN=DISCORD_BOT_TOKEN:latest,TWITTER_API_KEY=TWITTER_API_KEY:latest
   ```

### Continuous Deployment Setup

1. **Create a Cloud Build trigger**:
   ```bash
   gcloud builds triggers create github \
     --repo="YOUR_GITHUB_REPO" \
     --branch-pattern="main" \
     --build-config="cloudbuild.yaml"
   ```

2. **Create a `cloudbuild.yaml` file**:
   ```yaml
   steps:
   # Build the container image
   - name: 'gcr.io/cloud-builders/docker'
     args: ['build', '-t', 'gcr.io/$PROJECT_ID/social-media-agent', '.']
   
   # Push the container image to Container Registry
   - name: 'gcr.io/cloud-builders/docker'
     args: ['push', 'gcr.io/$PROJECT_ID/social-media-agent']
   
   # Deploy to Cloud Run
   - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
     entrypoint: gcloud
     args:
     - 'run'
     - 'deploy'
     - 'social-media-agent'
     - '--image'
     - 'gcr.io/$PROJECT_ID/social-media-agent'
     - '--region'
     - 'us-central1'
     - '--platform'
     - 'managed'
   
   images:
   - 'gcr.io/$PROJECT_ID/social-media-agent'
   ```

## Database Setup

### Create a Firestore Database

```bash
gcloud firestore databases create --region=us-central
```

### Initialize Database Collections

Create an initialization script to set up the required collections and indexes:

```javascript
// scripts/init-firestore.js
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

async function initializeDatabase() {
  // Create users collection
  await db.collection('users').doc('example').set({
    discord_id: 'example',
    created_at: admin.firestore.FieldValue.serverTimestamp()
  });
  
  // Create posts collection
  await db.collection('posts').doc('example').set({
    user_id: 'example',
    content: 'Example post',
    created_at: admin.firestore.FieldValue.serverTimestamp()
  });
  
  console.log('Database initialized successfully');
}

initializeDatabase().catch(console.error);
```

Run this script after deployment:
```bash
gcloud builds submit --config=scripts/init-firestore-cloudbuild.yaml
```

## Post-Deployment Setup

### Configure Discord Bot Callback

Once deployed, your Discord bot needs to be configured with the Cloud Run URL:

1. Visit the [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Go to OAuth2 > General
4. Add the redirect URL: `https://YOUR-CLOUD-RUN-URL/api/auth/discord/callback`

### Verify Social Media API Connections

To test your deployment:

1. Invite the bot to a Discord server
2. Run the help command to verify the bot is responsive
3. Connect social media accounts using the authentication commands
4. Test post generation with a sample URL

## Monitoring and Logging

### Cloud Run Monitoring

```bash
# View Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=social-media-agent" --limit=10
```

### Set Up Log-Based Alerts

```bash
# Create a log-based alert for errors
gcloud logging metrics create social-media-agent-errors \
  --description="Count of errors in the social media agent" \
  --log-filter="resource.type=cloud_run_revision AND resource.labels.service_name=social-media-agent AND severity>=ERROR"
```

## Scaling Configuration

The default configuration should handle moderate load. For higher traffic:

```bash
# Update Cloud Run service with higher limits
gcloud run services update social-media-agent \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 10 \
  --min-instances 1
```

## Maintenance and Updates

### Updating the Deployment

```bash
# Deploy a new version
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/social-media-agent
gcloud run deploy social-media-agent --image gcr.io/YOUR_PROJECT_ID/social-media-agent
```

### Rollback to Previous Version

```bash
# List revisions
gcloud run revisions list --service social-media-agent

# Traffic migration to a specific revision
gcloud run services update-traffic social-media-agent --to-revisions=REVISION_NAME=100
```

## Troubleshooting

### Common Issues

1. **Bot not responding**: Check Discord connection status in logs
2. **Social media authentication failures**: Verify tokens in Secret Manager
3. **Vertex AI errors**: Ensure AI Platform API is enabled and check quota limits
4. **Container crashes**: Check logs for out-of-memory issues or unhandled exceptions
5. **Database connection issues**: Verify Firestore access permissions

### Getting Help

If you encounter issues with deployment, refer to:
- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Discord.js Guide](https://discordjs.guide/)
- Project issues on GitHub 