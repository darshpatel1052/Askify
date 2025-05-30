!/bin/bash

# Askify Backend Deployment Script for Google Cloud
# This script deploys the Askify backend to Google Cloud Run

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-""}
REGION=${REGION:-"us-central1"}
SERVICE_NAME="askify-backend"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

# Functions
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    print_error "gcloud CLI is not installed. Please install it first."
    exit 1
fi

# Check if project ID is set
if [ -z "$PROJECT_ID" ]; then
    print_error "GOOGLE_CLOUD_PROJECT environment variable is not set."
    print_warning "Please set it with: export GOOGLE_CLOUD_PROJECT=your-project-id"
    exit 1
fi

print_status "Starting deployment to Google Cloud..."
print_status "Project ID: $PROJECT_ID"
print_status "Region: $REGION"
print_status "Service: $SERVICE_NAME"

# Set the project
print_status "Setting Google Cloud project..."
gcloud config set project $PROJECT_ID

# Enable required APIs
print_status "Enabling required Google Cloud APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Build and push the Docker image
print_status "Building and pushing Docker image..."
docker build -t $IMAGE_NAME:latest .
docker push $IMAGE_NAME:latest

# Deploy to Cloud Run
print_status "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_NAME:latest \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --port 8000 \
    --memory 2Gi \
    --cpu 1 \
    --max-instances 10 \
    --set-env-vars ENVIRONMENT=production

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

print_status "Deployment completed successfully!"
print_status "Service URL: $SERVICE_URL"
print_status "Health check: $SERVICE_URL/health"

# Test the deployment
print_status "Testing the deployment..."
if curl -f "$SERVICE_URL/health" > /dev/null 2>&1; then
    print_status "Health check passed! ✅"
else
    print_warning "Health check failed. Please check the logs."
fi

print_status "Deployment script completed!"
