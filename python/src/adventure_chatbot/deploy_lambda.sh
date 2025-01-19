#!/bin/bash
set -e

# Configuration
LAMBDA_FUNCTION_NAME="AdventureChatbot"
S3_BUCKET="cf-templates-iio8e9bj1plf0-us-west-2"
REGION="us-west-2"
PACKAGE_DIR="lambda_package"
ZIP_FILE="adventure_chatbot.zip"

# Clean up any existing files
rm -rf $PACKAGE_DIR
rm -f $ZIP_FILE

# Create package directory
mkdir -p $PACKAGE_DIR

# Copy necessary files
cp requirements.txt $PACKAGE_DIR/
cp lambda_function.py $PACKAGE_DIR/
cp story_templates.py $PACKAGE_DIR/
cp story_templates.json $PACKAGE_DIR/

# Install dependencies
cd $PACKAGE_DIR
echo "Installing dependencies..."
pip install --target . --no-cache-dir -r requirements.txt

# Create ZIP file
echo "Creating deployment package..."
zip -r ../$ZIP_FILE * -x "*.pyc" "**/__pycache__/*"
cd ..

# Upload to S3
echo "Uploading to S3..."
aws s3 cp $ZIP_FILE s3://$S3_BUCKET/$ZIP_FILE

# Update Lambda function
echo "Updating Lambda function..."
aws lambda update-function-code \
    --function-name $LAMBDA_FUNCTION_NAME \
    --s3-bucket $S3_BUCKET \
    --s3-key $ZIP_FILE

# Cleanup
rm -rf $PACKAGE_DIR
rm -f $ZIP_FILE

echo "Deployment completed!"