import requests
import json
import time
from datetime import datetime

def verify_lambda_url(url):
    """Test if the Lambda URL is accessible"""
    try:
        print(f"Testing Lambda URL accessibility: {url}")
        head_response = requests.head(url, timeout=5)
        print(f"HEAD response status code: {head_response.status_code}")
        print(f"HEAD response headers: {dict(head_response.headers)}")
        return True
    except requests.exceptions.RequestException as e:
        print(f"Error accessing Lambda URL: {str(e)}")
        return False

def test_chatbot():
    url = "https://2eibpywtaxca2v323fgbjafj6a0bltkh.lambda-url.us-west-2.on.aws/"
    session_id = f"test-session-{int(time.time())}"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    # Reduced test messages - 2 per language
    test_messages = [
        # English tests - simple introduction and follow-up
        {"message": "Hi, my name is Alice.", "language": "en"},
        {"message": "What's my name?", "language": "en"},
        
        # Nepali tests - greeting and simple question
        {"message": "नमस्ते, म राम हुँ।", "language": "ne"},
        {"message": "तपाईंलाई कस्तो छ?", "language": "ne"}
    ]

    print(f"\nStarting Bilingual Chatbot Test at {datetime.now().isoformat()}")
    print("=" * 50)
    print(f"Request URL: {url}")
    print(f"Session ID: {session_id}")
    print(f"Headers: {json.dumps(headers, indent=2)}")
    print("=" * 50)

    if not verify_lambda_url(url):
        print("Failed to verify Lambda URL accessibility. Continuing anyway...")

    for i, test_case in enumerate(test_messages, 1):
        message = test_case["message"]
        language = test_case["language"]
        
        print(f"\nTest Message {i}/{len(test_messages)}")
        print(f"Message: '{message}'")
        print(f"Language: {language}")
        print("-" * 30)

        try:
            payload = {
                "session_id": session_id,
                "message": message,
                "language": language
            }

            print("\nRequest Details:")
            print(f"URL: {url}")
            print(f"Method: POST")
            print(f"Headers: {json.dumps(headers, indent=2)}")
            print(f"Payload: {json.dumps(payload, indent=2)}")

            print("\nSending request...")
            response = requests.post(
                url, 
                json=payload,
                headers=headers,
                timeout=30
            )
            
            print(f"\nResponse Status: {response.status_code}")
            print(f"Response Headers: {dict(response.headers)}")
            
            try:
                response_data = response.json()
                print("\nResponse Data:")
                print(json.dumps(response_data, indent=2))
                
                if response.status_code == 200:
                    try:
                        response_body = json.loads(response_data.get('body', '{}'))
                        print("\nBot Response:")
                        print(f"Content: {response_body.get('response', 'No response found')}")
                        print(f"Language: {response_body.get('language', 'Not specified')}")
                    except json.JSONDecodeError as e:
                        print(f"\nError parsing response body: {str(e)}")
                        print(f"Raw body: {response_data.get('body')}")
                else:
                    print(f"\nError Response: {response.text}")
                    
            except json.JSONDecodeError as e:
                print(f"\nError parsing response: {str(e)}")
                print(f"Raw response: {response.text}")
                
        except requests.exceptions.RequestException as e:
            print(f"\nRequest Failed: {str(e)}")
            if hasattr(e, 'response'):
                print(f"Error Response: {e.response.text}")
        except Exception as e:
            print(f"\nUnexpected Error: {str(e)}")
        
        print("\nWaiting 3 seconds before next message...")
        time.sleep(3)

if __name__ == "__main__":
    test_chatbot()