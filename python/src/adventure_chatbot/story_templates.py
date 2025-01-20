"""
Story templates loader and prompt generation for the Adventure Chatbot.
All location data is loaded from locations.json at runtime.
"""

import json
from pathlib import Path

def load_templates():
    """Load story templates from JSON file."""
    template_path = Path(__file__).parent / 'story_templates.json'
    with open(template_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def get_story_prompt(location_name, location_description):
    """
    Generate a story prompt for a given location.
    
    Args:
        location_name (str): Name of the current location
        location_description (str): Description of the current location
        
    Returns:
        str: Formatted story prompt
    """
    prompt = f"""Create a fantasy story that begins in {location_name}.
    
    STORY SETTING: {location_name}
    LOCATION DESCRIPTION: {location_description}

    Your story MUST begin in this exact location. The first paragraph must vividly describe the scene, 
    capturing the essence of the location. Craft a compelling narrative that explores the unique 
    magical characteristics of this location.

    Describe:
    - The environment and its mystical features
    - The atmosphere and any magical energies present
    - Any notable beings or spirits that might inhabit this space
    - Potential adventures or mysteries that could unfold here

    Write using second-person perspective ("you") to immerse the reader.
    Keep the tone mysterious and enchanting throughout.
    """

    return prompt

def get_continuation_prompt(previous_content, user_action, current_location_name):
    """
    Generate a continuation prompt based on user action.
    
    Args:
        previous_content (str): Previous story content
        user_action (str): User's chosen action
        current_location_name (str): Name of the current location
        
    Returns:
        str: Formatted continuation prompt
    """
    return f"""Continue the story based on this previous context and action:
    Current Location: {current_location_name}
    Previous scene: {previous_content}
    
    User's next action: "{user_action}"
    
    Create a vivid scene that follows naturally from this choice.
    Keep everything in second-person perspective ("you") with rich sensory details.
    Maintain a mysterious and enchanting tone throughout the narrative.
    Write 100-150 words.
    """

def get_image_prompt(location_name, location_description, story_text):
    """
    Generate an image prompt based on location and story content.
    
    Args:
        location_name (str): Name of the current location
        location_description (str): Description of the current location
        story_text (str): The story content to base the image on
        
    Returns:
        str: Formatted image generation prompt
    """
    # Take first 200 characters of story text for context
    context = story_text[:200] if story_text else location_description
    
    return f"""Fantasy art, magical location, mystical atmosphere: {location_name}, {context}
    Style: Detailed digital art, ethereal lighting, magical realism"""