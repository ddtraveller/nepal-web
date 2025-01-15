import requests
import json
import time
from datetime import datetime

def verify_lambda_url(url):
    """Test if the Lambda URL is accessible"""
    try:
        # Try a HEAD request first
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

    # List of messages to test conversation memory
    test_messages = [
        "My name is Alice.",
        "What's my name?", 
        "What is 2+2?",
        "What was my question before asking about 2+2?"
    ]

    print(f"\nStarting Chatbot Test at {datetime.now().isoformat()}")
    print("=" * 50)
    print(f"Request URL: {url}")
    print(f"Session ID: {session_id}")
    print(f"Headers: {json.dumps(headers, indent=2)}")
    print("=" * 50)

    # Verify Lambda URL is accessible
    if not verify_lambda_url(url):
        print("Failed to verify Lambda URL accessibility. Continuing anyway...")

    # Test conversation chain
    for i, message in enumerate(test_messages, 1):
        print(f"\nTest Message {i}/{len(test_messages)}")
        print(f"Message: '{message}'")
        print("-" * 30)

        try:
            # Prepare request payload
            payload = {
                "session_id": session_id,
                "message": message
            }

            # Print full request details
            print("\nRequest Details:")
            print(f"URL: {url}")
            print(f"Method: POST")
            print(f"Headers: {json.dumps(headers, indent=2)}")
            print(f"Payload: {json.dumps(payload, indent=2)}")

            # Send POST request
            print("\nSending request...")
            response = requests.post(
                url, 
                json=payload,
                headers=headers,
                timeout=30
            )
            
            print(f"\nRaw Response Status: {response.status_code}")
            print(f"Raw Response Headers: {dict(response.headers)}")
            print(f"Raw Response Content: {response.text[:1000]}")  # First 1000 chars
            
            try:
                response_data = response.json()
                print("\nParsed Response Data:")
                print(json.dumps(response_data, indent=2))
                
                if response.status_code == 200:
                    try:
                        response_body = json.loads(response_data.get('body', '{}'))
                        print("\nBot Response:")
                        print(response_body.get('response', 'No response found in body'))
                    except json.JSONDecodeError as e:
                        print(f"\nFailed to parse response body as JSON: {str(e)}")
                        print(f"Raw body: {response_data.get('body')}")
                else:
                    print(f"\nError Response Body: {response.text}")
                    
            except json.JSONDecodeError as e:
                print(f"\nFailed to parse response as JSON: {str(e)}")
                print(f"Raw response text: {response.text}")
                
        except requests.exceptions.RequestException as e:
            print(f"\nRequest Failed: {str(e)}")
            print(f"Exception type: {type(e)}")
            if hasattr(e, 'response'):
                print(f"Error Response: {e.response.text}")
        except Exception as e:
            print(f"\nUnexpected Error: {str(e)}")
            print(f"Exception type: {type(e)}")
        
        print("\nWaiting 2 seconds before next message...")
        time.sleep(2)

if __name__ == "__main__":
    test_chatbot()