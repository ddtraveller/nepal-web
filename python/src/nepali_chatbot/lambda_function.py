import json
import boto3
import time
import os

# Set environment variables for cache directories
os.environ['TRANSFORMERS_CACHE'] = '/tmp/cache'
os.environ['HF_HOME'] = '/tmp/cache'

# Create cache directory
os.makedirs('/tmp/cache', exist_ok=True)

from transformers import pipeline, AutoModelForCausalLM, AutoTokenizer

# Initialize DynamoDB
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('ChatSessions')

def init_models():
    """Initialize models with explicit cache paths"""
    try:
        # Initialize simple dialogue model
        tokenizer = AutoTokenizer.from_pretrained(
            "facebook/blenderbot-400M-distill",
            cache_dir='/tmp/cache'
        )
        model = AutoModelForCausalLM.from_pretrained(
            "facebook/blenderbot-400M-distill",
            cache_dir='/tmp/cache'
        )
        
        # Initialize translator
        translator = pipeline(
            "translation",
            model="Helsinki-NLP/opus-mt-mul-en",
            cache_dir='/tmp/cache'
        )
        
        return tokenizer, model, translator
    except Exception as e:
        print(f"Error initializing models: {str(e)}")
        raise

# Initialize models (will be cached between invocations if container is reused)
tokenizer, model, translator = init_models()

def get_conversation_history(session_id):
    """Retrieve conversation history from DynamoDB"""
    try:
        response = table.get_item(Key={'session_id': session_id})
        return response.get('Item', {}).get('history', [])
    except Exception as e:
        print(f"Error retrieving history: {str(e)}")
        return []

def save_conversation_history(session_id, history):
    """Save conversation history to DynamoDB"""
    try:
        table.put_item(Item={
            'session_id': session_id,
            'history': history,
            'last_updated': int(time.time()),
            'ttl': int(time.time()) + (60 * 60)  # 1 hour TTL
        })
    except Exception as e:
        print(f"Error saving history: {str(e)}")

def generate_response(prompt, history_text="", max_length=150):
    """Generate a response using the model"""
    try:
        full_prompt = f"{history_text}\nHuman: {prompt}\nAssistant:"
        inputs = tokenizer(full_prompt, return_tensors="pt", max_length=512, truncation=True)
        outputs = model.generate(
            inputs["input_ids"],
            max_length=max_length,
            num_return_sequences=1,
            no_repeat_ngram_size=2,
            temperature=0.7
        )
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        return response.split("Assistant:")[-1].strip()
    except Exception as e:
        print(f"Error generating response: {str(e)}")
        return "I apologize, but I'm having trouble generating a response."

def detect_language(text):
    """Detect if text is in Nepali"""
    nepali_chars = set('कखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसहअआइईउऊएऐओऔ')
    text_chars = set(text)
    return 'ne' if len(text_chars.intersection(nepali_chars)) > 0 else 'en'

def translate_text(text, source_lang):
    """Translate between English and Nepali"""
    try:
        if source_lang == 'ne':
            # Translate Nepali to English
            translation = translator(text)[0]['translation_text']
            return translation
        return text  # Return original text if English
    except Exception as e:
        print(f"Translation error: {str(e)}")
        return text

def lambda_handler(event, context):
    # Handle CORS preflight
    if event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            }
        }

    try:
        # Parse request
        body = json.loads(event.get('body', '{}'))
        message = body.get('message', '')
        session_id = body.get('session_id', '')

        if not message or not session_id:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Message and session_id are required'})
            }

        # Get conversation history
        history = get_conversation_history(session_id)
        history_text = "\n".join([f"Human: {h['human']}\nAssistant: {h['ai']}" for h in history])

        # Process message
        lang = detect_language(message)
        
        # Translate to English if needed
        if lang == 'ne':
            eng_message = translate_text(message, 'ne')
        else:
            eng_message = message

        # Generate response
        response = generate_response(eng_message, history_text)

        # Update history
        history.append({
            'human': message,
            'ai': response,
            'language': lang,
            'timestamp': int(time.time())
        })

        # Save updated history
        save_conversation_history(session_id, history)

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'session_id': session_id,
                'message': message,
                'response': response,
                'language': lang,
                'history': history
            })
        }

    except Exception as e:
        print(f"Error in handler: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)})
        }