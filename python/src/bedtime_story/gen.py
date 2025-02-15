import json
import os
import time
import random
import requests
from io import BytesIO
from datetime import datetime
from typing import Dict, List
import logging
from anthropic import Anthropic
from pathlib import Path
import boto3

session = boto3.Session()
s3 = session.client('s3')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize clients - load keys from environment or .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    logger.info("python-dotenv not installed, using environment variables directly")

# Initialize clients from environment variables
anthropic_client = Anthropic(api_key=os.environ.get('ANTHROPIC_API_KEY'))
stability_key = os.environ.get('STABILITY_API_KEY')

# Basic validation
if not os.environ.get('ANTHROPIC_API_KEY'):
    raise EnvironmentError("ANTHROPIC_API_KEY environment variable is not set")
if not os.environ.get('STABILITY_API_KEY'):
    raise EnvironmentError("STABILITY_API_KEY environment variable is not set")

# Constants
MAX_TITLE_LENGTH = 50
OUTPUT_DIR = Path("output")
STORY_BASE_URL = "https://nepal-web.s3.us-west-2.amazonaws.com/stories/"
IMAGE_BASE_URL = "https://nepal-web.s3.us-west-2.amazonaws.com/images/"

def save_to_s3(story: Dict, images: List[BytesIO]):
    """Save story and images directly to S3"""
    safe_title = ''.join(c if c.isalnum() else '_' for c in story['title'][:30].lower())
    date_str = datetime.now().strftime("%Y%m%d")
    timestamp = int(time.time())
    
    # Upload images and collect URLs
    image_urls = []
    for i, image_data in enumerate(images, 1):
        image_filename = f'{safe_title}_p{i}_{date_str}.png'
        
        # Upload to S3
        s3.put_object(
            Bucket='nepal-web',
            Key=f'images/{image_filename}',
            Body=image_data.getvalue(),
            ContentType='image/png'
        )
        
        # Store web URL
        image_urls.append(f"{IMAGE_BASE_URL}{image_filename}")
    
    # Generate and upload HTML
    html_filename = f'story_{safe_title}_{timestamp}.html'
    html_content = generate_html(story, image_urls)
    
    s3.put_object(
        Bucket='nepal-web',
        Key=f'stories/{html_filename}',
        Body=html_content,
        ContentType='text/html'
    )
    
    html_url = f"{STORY_BASE_URL}{html_filename}"
    
    return {
        'image_urls': image_urls,
        'html_url': html_url
    }
    
def load_random_file() -> str:
    """Load a random story seed file from local files directory"""
    files_dir = Path("files")
    if not files_dir.exists():
        files_dir.mkdir()
        with open(files_dir / "sample.txt", "w") as f:
            f.write("Sample story seed content")
    
    files = list(files_dir.glob("*.txt"))
    if not files:
        raise Exception("No story seed files found in files directory")
    
    random_file = random.choice(files)
    with open(random_file, 'r') as f:
        return f.read()

def generate_story(seed_file: str, story_prompt: str, story_seed: str) -> Dict:
    """Generate a story using Claude"""
    try:
        response = anthropic_client.messages.create(
            model="claude-3-sonnet-20240229",
            max_tokens=3500,
            messages=[{
                "role": "user",
                "content": story_prompt.format(
                    seed_file=seed_file,
                    story_seed=story_seed
                )
            }]
        )
        
        raw_content = response.content[0].text
        
        # First split by lines to find title more reliably
        lines = raw_content.split('\n')
        
        # Look for title in the first few lines
        title = None
        for line in lines[:5]:  # Check first 5 lines
            if 'Title:' in line or 'TITLE:' in line:
                title = line.split(':', 1)[1].strip()
                break
        
        # If no title found, use the story seed or default
        if not title:
            title = story_seed if story_seed else 'Untitled Story'
            logger.warning(f"No title found in response, using: {title}")
        
        # Enforce max length after finding title
        title = title[:MAX_TITLE_LENGTH]
        
        # Split remaining content into parts
        parts = raw_content.split('\n\n')
        story_parts = []
        
        for part in parts:
            if 'Part' in part and ':' in part:
                try:
                    part_header = part.split('\n')[0]
                    part_number = int(''.join(filter(str.isdigit, part_header)))
                    content = part.split(':', 1)[1].strip() if ':' in part else part
                    
                    if content:  # Only add if there's actual content
                        story_parts.append({
                            "part_number": part_number,
                            "content": content
                        })
                except (ValueError, IndexError) as e:
                    logger.warning(f"Skipping malformed part: {part[:50]}...")
                    continue
        
        # Ensure we have at least one part
        if not story_parts:
            raise ValueError("No valid story parts found in generated content")
        
        return {
            "title": title,
            "parts": sorted(story_parts, key=lambda x: x["part_number"])
        }
        
    except Exception as e:
        logger.error(f"Error generating story: {str(e)}")
        raise

def generate_image(story_part: str, part_number: int, style: str = 'digital-art') -> BytesIO:
    """Generate an image using Stability AI"""
    story_instruction = f"Create a whimsical, child-friendly {style} illustration for part {part_number} of a story."
    style_prompt = """
    Use a vibrant, colorful palette with rich, saturated hues.
    Create detailed, fantastical backgrounds that blend natural elements with magical imagery.
    Use perspective to create a sense of wonder.
    Incorporate whimsical details and small creatures to add life to the scene.
    Ensure character designs blend realistic proportions with slightly exaggerated features.
    """
    
    payload = {
        "prompt": (None, f"{story_instruction} {story_part} {style_prompt}"),
        "cfg_scale": (None, "7"),
        "height": (None, "576"),
        "width": (None, "1024"),
        "samples": (None, "1"),
        "steps": (None, "50"),
        "style_preset": (None, style),
        "model": (None, "sd3-large")
    }
    
    headers = {
        "Authorization": f"Bearer {stability_key}",
        "Accept": "image/*"  # Changed to image/*
    }
    
    response = requests.post(
        "https://api.stability.ai/v2beta/stable-image/generate/sd3",
        headers=headers,
        files=payload
    )
    
    # Check status code first
    if response.status_code != 200:
        error_msg = response.json() if response.headers['Content-Type'] == 'application/json' else response.text
        logger.error(f"Stability API error: {error_msg}")
        raise Exception(f"Stability API error: {error_msg}")
        
    # Handle successful response
    if response.headers['Content-Type'].startswith('image/'):
        return BytesIO(response.content)
    elif response.headers['Content-Type'] == 'application/json':
        error_msg = response.json()
        logger.error(f"Received JSON instead of image: {error_msg}")
        raise Exception(f"Failed to generate image: {error_msg}")
    else:
        raise Exception(f"Unexpected content type: {response.headers['Content-Type']}")

def generate_html(story: Dict, image_urls: List[str]) -> str:
    """Generate HTML content for the story"""
    html = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{story['title']}</title>
        <style>
            body {{
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
            }}
            h1 {{
                color: #2c3e50;
                text-align: center;
                margin-bottom: 30px;
            }}
            .story-part {{
                background-color: #f9f9f9;
                border-radius: 10px;
                padding: 20px;
                margin-bottom: 30px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }}
            img {{
                max-width: 100%;
                height: auto;
                margin: 20px 0;
                border-radius: 10px;
            }}
        </style>
    </head>
    <body>
        <h1>{story['title']}</h1>
    """
    
    for i, part in enumerate(story['parts']):
        html += f"""
        <div class="story-part">
            <h2>Part {part['part_number']}</h2>
            <p>{part['content']}</p>
            <img src="{image_urls[i]}" alt="Story illustration {part['part_number']}">
        </div>
        """
    
    html += """
    </body>
    </html>
    """
    
    return html

def save_files_locally(story: Dict, images: List[BytesIO]):
    """Save story and images locally with web-ready paths"""
    output_dir = Path("output")
    output_dir.mkdir(exist_ok=True)
    
    safe_title = ''.join(c if c.isalnum() else '_' for c in story['title'][:30].lower())
    date_str = datetime.now().strftime("%Y%m%d")
    timestamp = int(time.time())
    
    # Save images and collect URLs
    image_urls = []
    for i, image_data in enumerate(images, 1):
        image_filename = f'{safe_title}_p{i}_{date_str}.png'
        
        # Save locally
        with open(output_dir / image_filename, 'wb') as f:
            f.write(image_data.getvalue())
        
        # Store web URL
        image_urls.append(f"{IMAGE_BASE_URL}{image_filename}")
    
    # Generate and save HTML
    html_filename = f'story_{safe_title}_{timestamp}.html'
    html_content = generate_html(story, image_urls)
    
    with open(output_dir / html_filename, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    html_url = f"{STORY_BASE_URL}{html_filename}"
    
    return {
        'image_urls': image_urls,
        'html_url': html_url,
        'local_dir': str(output_dir.absolute())
    }

def main():
    """Main function to generate story and images"""
    try:
        # Load story prompt
        with open('story_prompt.txt', 'r') as file:
            story_prompt = file.read()
        
        # Generate story
        seed_file = load_random_file()
        story_seed = input("Enter a story seed (or press Enter for random): ").strip()
        
        if not story_seed:
            story_seed = "A magical adventure"
        
        logger.info("Generating story...")
        story = generate_story(seed_file, story_prompt, story_seed)
        
        # Generate images for each part
        images = []
        logger.info("Generating images...")
        for i, part in enumerate(story['parts'], 1):
            logger.info(f"Generating image for part {i}...")
            image = generate_image(part['content'], i)
            images.append(image)
        
        # Upload files to S3
        logger.info("Uploading files to S3...")
        result = save_to_s3(story, images)
        
        logger.info(f"\nStory generated and uploaded successfully!")
        logger.info(f"Title: {story['title']}")
        logger.info(f"Story available at: {result['html_url']}")
        logger.info("Images available at:")
        for url in result['image_urls']:
            logger.info(f"  {url}")
        
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        raise

if __name__ == "__main__":
    main()