import json
import os
import time
import requests
import logging
from typing import Dict, List
import boto3
from langchain_community.chat_message_histories import DynamoDBChatMessageHistory

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS services
dynamodb = boto3.resource('dynamodb')

def get_huggingface_key():
    """Get Hugging Face API key from Parameter Store"""
    ssm = boto3.client('ssm', region_name='us-west-2')
    try:
        response = ssm.get_parameter(
            Name='HUGGINGFACE_KEY',
            WithDecryption=True
        )
        return response['Parameter']['Value']
    except Exception as e:
        logger.error(f"Error getting API key: {str(e)}")
        raise

def format_response(chain_output: str) -> Dict:
    """Format the chain output for the API response"""
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json'
        },
        'body': json.dumps({
            'response': chain_output,
            'timestamp': int(time.time())
        })
    }

def generate_huggingface_response(messages: List[Dict], api_key: str, context: Dict = None) -> str:
    """
    Generate response using Hugging Face API with enhanced debugging and context support
    """
    # Create a detailed conversation history
    conversation_history = ""
    for msg in messages:
        role = msg.get('role', '').capitalize()
        content = msg.get('content', '')
        conversation_history += f"{role}: {content}\n"
    
    # Get the last user message for context
    last_user_message = messages[-1]['content'] if messages else ""
    
    # Prepare context section if available
    context_section = ""
    if context:
        context_section = f"""
Context Document:
Filename: {context.get('filename', 'unknown')}
Content:
{context.get('content', '')}

Use the above context document to help answer questions when relevant.
"""
    
    # Prepare a comprehensive prompt
    prompt = f"""You are a helpful AI assistant. Engage in a conversation and provide helpful, contextual responses.

{context_section}
Conversation History:
{conversation_history}

Last User Message: {last_user_message}

Respond directly and helpfully to the last message, using the context document when relevant. If no specific response is possible, provide a general, friendly response.

Response:"""

    # Attempt to generate response with multiple fallback mechanisms
    try:
        response = requests.post(
            'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            },
            json={
                'inputs': prompt,
                'parameters': {
                    'max_new_tokens': 150,
                    'min_new_tokens': 20,
                    'temperature': 0.7,
                    'top_p': 0.9,
                    'repetition_penalty': 1.1
                }
            }
        )
        
        logger.info(f"Raw HuggingFace Response Status: {response.status_code}")
        logger.info(f"Raw HuggingFace Response Content: {response.text}")

        if response.status_code != 200:
            logger.error(f"HuggingFace API Error: {response.text}")
            return f"I'm having trouble responding. Status code: {response.status_code}"

        result = response.json()
        
        if isinstance(result, list):
            generated_text = result[0].get('generated_text', '')
        elif isinstance(result, dict):
            generated_text = result.get('generated_text', '')
        else:
            generated_text = str(result)
        
        cleaned_response = generated_text.replace(prompt, '').strip()
        
        if not cleaned_response:
            logger.warning("Empty response generated. Using fallback.")
            cleaned_response = "I'm here and ready to help. Could you please repeat your message?"
        
        return cleaned_response

    except Exception as e:
        logger.error(f"Error generating response: {str(e)}")
        return f"I encountered an error: {str(e)}. Could you please try again?"

def lambda_handler(event, context):
    """Handle incoming Lambda requests"""
    logger.info(f"Received event: {json.dumps(event)}")
    
    if event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json'
            }
        }

    try:
        body = json.loads(event.get('body', '{}'))
        session_id = body.get('session_id')
        message = body.get('message')
        document_context = body.get('context')  # Get document context if provided

        if not session_id or not message:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({'error': 'Missing session_id or message'})
            }

        # Initialize chat history
        history = DynamoDBChatMessageHistory(
            table_name=os.environ['DYNAMODB_TABLE'],
            session_id=session_id,
            primary_key_name="SessionId"
        )

        history.add_user_message(message)

        messages = []
        for msg in history.messages:
            if msg.type == "human":
                messages.append({"role": "user", "content": msg.content})
            elif msg.type == "ai":
                messages.append({"role": "assistant", "content": msg.content})

        api_key = get_huggingface_key()

        # Pass document context to response generator if available
        ai_response = generate_huggingface_response(messages, api_key, document_context)
        history.add_ai_message(ai_response)

        return format_response(ai_response)

    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        import traceback
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