#!/bin/bash
set -ex

# Configuration
LAMBDA_FUNCTION_NAME="LangchainChatbot"
S3_BUCKET="cf-templates-iio8e9bj1plf0-us-west-2"
ZIP_FILE="langchain_chatbot.zip"
PACKAGE_DIR="lambda_package"

# Clean up any existing package directory and zip
rm -rf $PACKAGE_DIR
rm -f $ZIP_FILE

# Create a new directory for the package
mkdir -p $PACKAGE_DIR

# Copy necessary files
cp requirements.txt $PACKAGE_DIR/
cp lambda_function.py $PACKAGE_DIR/

# Move to package directory
cd $PACKAGE_DIR

# Install dependencies directly (no virtualenv)
pip install --target . --no-cache-dir -r requirements.txt

# List installed packages for verification
echo "Installed packages:"
ls -la
find . -name "anthropic*"

# Remove unnecessary files
find . -type d -name "*.dist-info" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true

# Create the ZIP file with verbose output
cd .
zip -r ../$ZIP_FILE * -x "*.pyc" "**/__pycache__/*"

# Go back to original directory
cd ..

# Upload to S3 with verification
echo "Uploading to S3..."
aws s3 cp $ZIP_FILE s3://$S3_BUCKET/$ZIP_FILE
aws s3 ls s3://$S3_BUCKET/$ZIP_FILE

# Update the Lambda function code
echo "Updating Lambda function..."
aws lambda update-function-code \
  --function-name $LAMBDA_FUNCTION_NAME \
  --s3-bucket $S3_BUCKET \
  --s3-key $ZIP_FILE

# Wait for Lambda update to complete
aws lambda wait function-updated \
  --function-name $LAMBDA_FUNCTION_NAME

# Cleanup
rm -rf $PACKAGE_DIR
rm -f $ZIP_FILE

echo "Deployment completed successfully!"