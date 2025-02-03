import json
import boto3

def lambda_handler(event, context):
    try:
        ssm = boto3.client('ssm')
        hf_key = ssm.get_parameter(
            Name='/HUGGINGFACE_KEY',
            WithDecryption=True
        )
        stability_key = ssm.get_parameter(
            Name='/STABILITY_AI_API_KEY',
            WithDecryption=True
        )
        
        google_maps_key = ssm.get_parameter(
            Name='/GOOGLE_MAPS_API_KEY',
            WithDecryption=True
        )        
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': 'https://nepal-web.net',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'huggingFaceKey': hf_key['Parameter']['Value'],
                'stabilityKey': stability_key['Parameter']['Value'],
                'google_maps_key': google_maps_key['Parameter']['Value']
            })
        }
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': 'https://nepal-web.net',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'error': 'Failed to fetch API keys'
            })
        }
