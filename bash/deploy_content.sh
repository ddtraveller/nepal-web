#!/bin/bash

# Script to sync HTML content to S3 bucket
# Location: bash/sync-to-s3.sh

# Set variables
S3_BUCKET="s3://nepal-web"
CONTENT_DIR="../HTML/content"
SRC_DIR="../HTML/src"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if directories exist
if [ ! -d "$CONTENT_DIR" ]; then
    echo "Error: Content directory not found at $CONTENT_DIR"
    exit 1
fi

if [ ! -d "$SRC_DIR" ]; then
    echo "Error: Source directory not found at $SRC_DIR"
    exit 1
fi

# Check if index.html exists
if [ ! -f "$SRC_DIR/index.html" ]; then
    echo "Error: index.html not found in $SRC_DIR"
    exit 1
fi

# Sync content directory
echo "Syncing content directory..."
aws s3 sync "$CONTENT_DIR/" "$S3_BUCKET/" --delete

# Copy index.html
echo "Copying index.html..."
aws s3 cp "$SRC_DIR/index.html" "$S3_BUCKET/"

echo "Sync completed successfully!"

# List contents of bucket to verify
echo "Current contents of S3 bucket:"
aws s3 ls "$S3_BUCKET/"