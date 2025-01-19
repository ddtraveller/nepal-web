import json
import os
import time
import requests
import logging
from typing import Dict, List
import boto3
import re
import random
import traceback
from langchain_community.chat_message_histories import DynamoDBChatMessageHistory
from story_templates import get_story_prompt, get_random_elements, get_image_prompt, get_continuation_prompt

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS services
dynamodb = boto3.resource('dynamodb')

def get_api_keys():
    """Get API keys from Parameter Store"""
    ssm = boto3.client('ssm', region_name='us-west-2')
    try:
        huggingface_key = ssm.get_parameter(Name='HUGGINGFACE_KEY', WithDecryption=True)['Parameter']['Value']
        stability_key = ssm.get_parameter(Name='STABILITY_AI_API_KEY', WithDecryption=True)['Parameter']['Value']
        return huggingface_key, stability_key
    except Exception as e:
        logger.error(f"Error getting API keys: {str(e)}")
        raise

def format_response(response_data: Dict) -> Dict:
    """Format the response for the API response"""
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json'
        },
        'body': json.dumps({
            'response': response_data,
            'timestamp': int(time.time())
        })
    }
    
def generate_story_text(prompt: str, huggingface_key: str) -> Dict[str, str]:
    """Generate story text and translation using Hugging Face"""
    try:
        # Generate English story
        response = requests.post(
            'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2',
            headers={'Authorization': f'Bearer {huggingface_key}'},
            json={
                'inputs': prompt,
                'parameters': {
                    'max_new_tokens': 500,
                    'min_new_tokens': 100,
                    'temperature': 0.7,
                    'top_p': 0.9,
                    'repetition_penalty': 1.1,
                    'include_prompt_in_result': False
                }
            }
        )
        
        if response.status_code != 200:
            raise Exception(f"Story generation failed: {response.text}")

        result = response.json()
        english_text = result[0]['generated_text'] if isinstance(result, list) else result['generated_text']
        english_text = clean_text(english_text)

        # Generate Nepali translation
        nepali_text = translate_to_nepali(english_text, huggingface_key)
        
        return {
            'english': english_text,
            'nepali': nepali_text
        }
    except Exception as e:
        logger.error(f"Error generating story: {str(e)}")
        raise

def generate_image(prompt: str, stability_key: str) -> str:
    """Generate image using Stability AI"""
    try:
        response = requests.post(
            'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
            headers={
                'Authorization': f'Bearer {stability_key}',
                'Content-Type': 'application/json'
            },
            json={
                'text_prompts': [{'text': prompt, 'weight': 1}],
                'cfg_scale': 7,
                'height': 1024,
                'width': 1024,
                'samples': 1,
                'steps': 30,
            }
        )
        
        if response.status_code != 200:
            raise Exception(f"Image generation failed: {response.text}")

        result = response.json()
        if not result.get('artifacts', []):
            raise Exception("No image generated")
            
        return f"data:image/png;base64,{result['artifacts'][0]['base64']}"
    except Exception as e:
        logger.error(f"Error generating image: {str(e)}")
        raise

def translate_to_nepali(text: str, huggingface_key: str) -> str:
    """Translate text to Nepali using Hugging Face"""
    try:
        response = requests.post(
            'https://api-inference.huggingface.co/models/facebook/mbart-large-50-many-to-many-mmt',
            headers={'Authorization': f'Bearer {huggingface_key}'},
            json={
                'inputs': text,
                'parameters': {
                    'src_lang': "en_XX",
                    'tgt_lang': "ne_NP"
                }
            }
        )
        
        if response.status_code != 200:
            return '(Translation failed)'

        result = response.json()
        return result[0].get('translation_text', '(Translation failed)')
    except Exception:
        return '(Translation failed)'

def clean_text(text: str) -> str:
   # Remove the prompt and ### Response: pattern
   text = re.sub(r'^.*?### Response:\s*', '', text, flags=re.DOTALL)
   
   # Your existing cleaning
   text = re.sub(r'^(You are a creative storyteller\.|Create a story|Continue the story|Write a complete scene|Requirements:|Based on the action:|Previous:|Action:).*?(?=\n|$)', '', text, flags=re.MULTILINE | re.IGNORECASE)
   text = re.sub(r'\[.*?\]', '', text)
   text = re.sub(r'\{.*?\}', '', text)
   text = re.sub(r'```.*?```', '', text, flags=re.DOTALL)
   text = re.sub(r'^\s*[\r\n]', '', text, flags=re.MULTILINE)
   text = re.sub(r'\n\s*\n', '\n', text)
   return text.strip()

def lambda_handler(event, context):
    """Handle Lambda requests"""
    logger.info(f"Received event: {json.dumps(event)}")
    
    # Handle CORS preflight
    if event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json'
            }
        }

    try:
        # Parse request
        body = json.loads(event.get('body', '{}'))
        session_id = body.get('session_id')
        action = body.get('action')
        story_type = body.get('story_type')

        if not session_id:
            return format_response({'error': 'Missing session_id'})

        # Initialize DynamoDB history
        history = DynamoDBChatMessageHistory(
            table_name=os.environ['DYNAMODB_TABLE'],
            session_id=session_id,
            primary_key_name="SessionId"
        )

        # Get API keys
        huggingface_key, stability_key = get_api_keys()

        if action == 'start_new':
            # Clear existing history
            history.clear()
            
            # Get random elements
            setting, situation, elements = get_random_elements(story_type)
            
            # Generate story prompt
            prompt = get_story_prompt(story_type, setting, situation, elements)

            # Generate story content
            story_text = generate_story_text(prompt, huggingface_key)
            
            # Generate image prompt and image
            image_prompt = get_image_prompt(story_type, story_text['english'])
            image_url = generate_image(image_prompt, stability_key)

            # Store just the English text in history
            history.add_user_message("START_NEW_STORY")
            history.add_ai_message(story_text['english'])
            
            # Log history for debugging
            logger.info(f"History after start_new: {history.messages}")

            response_data = {
                'text': story_text['english'],
                'nepaliText': story_text['nepali'],
                'image': image_url,
                'setting': setting,
                'situation': situation,
                'elements': elements
            }

            return format_response(response_data)

        elif action == 'continue':
            user_input = body.get('input')
            if not user_input:
                return format_response({'error': 'Missing user input'})

            try:
                # Get previous AI message
                previous_content = history.messages[-1].content
                logger.info(f"Previous content retrieved: {previous_content}")
            except Exception as e:
                logger.error(f"Error accessing history: {str(e)}")
                logger.error(f"Falling back to empty previous content")
                previous_content = ""

            # Get translation of user input
            nepali_input = translate_to_nepali(user_input, huggingface_key)
            
            # Generate continuation prompt
            prompt = get_continuation_prompt(story_type, previous_content, user_input)

            # Generate story content
            story_text = generate_story_text(prompt, huggingface_key)
            
            # Generate image prompt and image
            image_prompt = get_image_prompt(story_type, story_text['english'])
            image_url = generate_image(image_prompt, stability_key)
            
            # Store the interaction in history
            history.add_user_message(user_input)
            history.add_ai_message(story_text['english'])
            
            # Log history for debugging
            logger.info(f"History after continue: {history.messages}")

            response_data = {
                'text': story_text['english'],
                'nepaliText': story_text['nepali'],
                'image': image_url,
                'input': user_input,
                'nepaliInput': nepali_input
            }

            return format_response(response_data)

    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'error': 'Internal server error',
                'details': str(e)
            })
        }