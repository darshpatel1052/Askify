# Deployment Guide for Paperwise

This guide outlines how to deploy the Paperwise application using Docker containers on Railway or Google Cloud Platform (GCP).

## Prerequisites

- Docker and Docker Compose installed
- Git repository with your Paperwise code
- Supabase account with database set up
- OpenAI API key
- Railway or GCP account for deployment

## Local Deployment with Docker

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd Paperwise/backend
   ```

2. **Set up environment variables**:
   Copy the `.env.sample` file to `.env` and fill in your credentials:
   ```bash
   cp .env.sample .env
   nano .env
   ```

3. **Build and run with Docker Compose**:
   ```bash
   docker-compose up --build
   ```

4. **Verify the application**:
   Visit `http://localhost:8000` to check that the API is running.

## Deployment on Railway

Railway offers a simple way to deploy containerized applications.

1. **Create a new project on Railway**:
   - Sign in to Railway
   - Create a new project
   - Connect your GitHub repository

2. **Configure environment variables**:
   - Go to the Variables tab in your Railway project
   - Add all the variables from your `.env` file

3. **Deploy the application**:
   - Railway will automatically build and deploy your application using the Dockerfile

4. **Get your deployment URL**:
   - Railway will provide a URL for your deployed application
   - Update your Chrome extension's API_BASE_URL with this URL

## Deployment on Google Cloud Platform (GCP)

### Option 1: Using Google Cloud Run

1. **Set up Google Cloud SDK**:
   ```bash
   gcloud auth login
   gcloud config set project [YOUR_PROJECT_ID]
   ```

2. **Build the Docker image**:
   ```bash
   docker build -t gcr.io/[YOUR_PROJECT_ID]/paperwise-backend .
   ```

3. **Push the image to Google Container Registry**:
   ```bash
   docker push gcr.io/[YOUR_PROJECT_ID]/paperwise-backend
   ```

4. **Deploy to Cloud Run**:
   ```bash
   gcloud run deploy paperwise-backend \
     --image gcr.io/[YOUR_PROJECT_ID]/paperwise-backend \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars="$(cat .env | grep -v '#' | xargs)"
   ```

### Option 2: Using Google Kubernetes Engine (GKE)

1. **Create a GKE cluster**:
   ```bash
   gcloud container clusters create paperwise-cluster \
     --num-nodes=2 \
     --zone=us-central1-a
   ```

2. **Configure kubectl**:
   ```bash
   gcloud container clusters get-credentials paperwise-cluster --zone=us-central1-a
   ```

3. **Create Kubernetes secrets for environment variables**:
   ```bash
   kubectl create secret generic paperwise-env --from-env-file=.env
   ```

4. **Create Kubernetes deployment files**:
   Create `k8s-deployment.yaml` with:
   ```yaml
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: paperwise-backend
   spec:
     replicas: 2
     selector:
       matchLabels:
         app: paperwise-backend
     template:
       metadata:
         labels:
           app: paperwise-backend
       spec:
         containers:
         - name: paperwise-backend
           image: gcr.io/[YOUR_PROJECT_ID]/paperwise-backend
           ports:
           - containerPort: 8000
           envFrom:
           - secretRef:
               name: paperwise-env
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: paperwise-backend
   spec:
     selector:
       app: paperwise-backend
     ports:
     - port: 80
       targetPort: 8000
     type: LoadBalancer
   ```

5. **Deploy to GKE**:
   ```bash
   kubectl apply -f k8s-deployment.yaml
   ```

6. **Get the external IP**:
   ```bash
   kubectl get service paperwise-backend
   ```

## Chrome Extension Configuration for Production

1. Update the `API_BASE_URL` in:
   - `/extension/background/background.js`
   - `/extension/popup/popup.js`

2. Replace `http://localhost:8000/api/v1` with your production URL.

3. Package and publish your Chrome extension through the Chrome Web Store Developer Dashboard.

## Maintenance

- **Logs**: Monitor application logs via Docker, Railway or GCP console
- **Backups**: Set up periodic backups of the Supabase database
- **Updates**: When updating the application, rebuild and deploy the Docker image
- **Scaling**: Adjust resources as needed based on usage
