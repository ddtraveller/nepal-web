import json
import os
import boto3
import requests
import time
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def get_huggingface_api_key():
    """Retrieve Hugging Face API key from AWS Parameter Store"""
    ssm = boto3.client('ssm')
    response = ssm.get_parameter(
        Name='HUGGINGFACE_KEY',
        WithDecryption=True
    )
    return response['Parameter']['Value']

def wait_for_model(response, max_retries=5):
    """Handle model loading state with retries"""
    try:
        response_json = response.json()
        if response.status_code == 200:
            return response_json
            
        # Check if it's a model loading error
        if 'error' in response_json and 'is currently loading' in response_json['error']:
            estimated_time = response_json.get('estimated_time', 20)
            logger.info(f"Model is loading, waiting for {estimated_time} seconds...")
            time.sleep(min(estimated_time, 25))  # Cap wait time at 25 seconds
            return None
        
        # If it's another type of error, raise it
        raise Exception(f"Hugging Face API error: {response.text}")
    except json.JSONDecodeError:
        raise Exception(f"Invalid response from API: {response.text}")

def make_huggingface_request(url, payload, headers, max_retries=5):
    """Make request to Hugging Face with retry logic"""
    for attempt in range(max_retries):
        response = requests.post(url, headers=headers, json=payload)
        result = wait_for_model(response)
        
        if result is not None:
            return result
            
        logger.info(f"Retry attempt {attempt + 1} of {max_retries}")
    
    raise Exception("Max retries exceeded waiting for model to load")

def translate_text(text, api_key):
    """Translate text to Nepali using Hugging Face's M2M100 model"""
    headers = {
        "Authorization": f"Bearer {api_key}"
    }
    
    result = make_huggingface_request(
        "https://api-inference.huggingface.co/models/facebook/mbart-large-50-many-to-many-mmt",
        {
            "inputs": text,
            "parameters": {
                "src_lang": "en_XX",
                "tgt_lang": "ne_NP"  # Nepali language code
            }
        },
        headers
    )
    
    return result[0]['translation_text']

def create_response(status_code, body):
    """Create a response with consistent headers"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json'
        },
        'body': json.dumps(body)
    }

def lambda_handler(event, context):
    """Main Lambda handler function"""
    # Handle CORS preflight request
    if event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
        return create_response(200, {})

    try:
        # Parse input
        body = json.loads(event['body'])
        text = body.get('text')
        operation = body.get('operation')
        
        if not text:
            return create_response(400, {
                'error': 'Missing required parameter: text'
            })
            
        if operation != 'translate':
            return create_response(400, {
                'error': 'Only translation operation is supported'
            })
        
        # Get necessary credentials
        huggingface_key = get_huggingface_api_key()
        
        # Translate text
        result = translate_text(text, huggingface_key)
        
        return create_response(200, {
            'result': result
        })
        
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return create_response(500, {
            'error': 'Internal server error',
            'details': str(e)
        })