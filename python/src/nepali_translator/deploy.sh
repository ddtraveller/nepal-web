#!/bin/bash
set -e

# Configuration
LAMBDA_FUNCTION_NAME="NepaliTranslator"
S3_BUCKET="cf-templates-iio8e9bj1plf0-us-west-2"  # Replace with your bucket name
REGION="us-west-2"  # Replace with your region
PACKAGE_DIR="lambda_package"
ZIP_FILE="text_processor.zip"
STACK_NAME="nepali-translator"

# Clean up any existing files
rm -rf $PACKAGE_DIR
rm -f $ZIP_FILE

# Create package directory
mkdir -p $PACKAGE_DIR

# Copy necessary files
cp requirements.txt $PACKAGE_DIR/
cp lambda_function.py $PACKAGE_DIR/

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

# Check if stack exists
if aws cloudformation describe-stacks --stack-name $STACK_NAME >/dev/null 2>&1; then
    echo "Stack exists - updating..."

    # Update only the Lambda function code
    aws lambda update-function-code \
        --function-name $LAMBDA_FUNCTION_NAME \
        --s3-bucket $S3_BUCKET \
        --s3-key $ZIP_FILE
else
    echo "Stack doesn't exist - performing full deployment..."
    # Deploy CloudFormation stack
    aws cloudformation deploy \
        --template-file cfn.yml \
        --stack-name $STACK_NAME \
        --parameter-overrides \
            LambdaBucket=$S3_BUCKET \
            LambdaZipFile=$ZIP_FILE \
        --capabilities CAPABILITY_IAM
fi

# Cleanup
rm -rf $PACKAGE_DIR
rm -f $ZIP_FILE

# Get the function URL
echo "Getting function URL..."
FUNCTION_URL=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunctionUrl`].OutputValue' \
    --output text)

echo "Deployment completed!"
echo "Function URL: $FUNCTION_URL"