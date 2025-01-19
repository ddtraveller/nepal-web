"""
Story templates loader and prompt generation for the Adventure Chatbot.
"""

import json
import random
from pathlib import Path

def load_templates():
    """Load story templates from JSON file."""
    template_path = Path(__file__).parent / 'story_templates.json'
    with open(template_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def get_story_prompt(story_type, setting, situation, elements):
    """
    Generate a story prompt based on selected template elements.
    
    Args:
        story_type (str): The type of story (e.g., 'himalayan', 'fantasy')
        setting (str): The story setting
        situation (str): The initial situation
        elements (list): List of story elements to incorporate
        
    Returns:
        str: Formatted story prompt
    """
    templates = load_templates()
    template = templates[story_type]
    
    return f"""Create an immersive story opener in second-person perspective ("you") with 6th grade level English. 
    The scene takes place in a {setting} where you {situation}. 
    Include vivid details about {' and '.join(elements)}. 
    Write 100-150 words.
    Keep everything in second-person perspective with rich sensory details.
    Maintain a {template['tone']} tone throughout the narrative.
    ### Response:"""

def get_continuation_prompt(story_type, previous_content, user_action):
    """
    Generate a continuation prompt based on user action.
    
    Args:
        story_type (str): The type of story
        previous_content (str): Previous story content
        user_action (str): User's chosen action
        
    Returns:
        str: Formatted continuation prompt
    """
    templates = load_templates()
    template = templates[story_type]
    
    return f"""Continue the story with 6th grade level English based on this previous context and action:
    Previous scene: {previous_content}
    
    User's next action: "{user_action}"
    
    Create a vivid scene that follows naturally from this choice.
    Keep everything in second-person perspective ("you") with rich sensory details.
    Maintain a {template['tone']} tone throughout the narrative.
    Write 100-150 words.
    ### Response:"""

def get_image_prompt(story_type, story_text):
    """
    Generate an image prompt based on story content.
    
    Args:
        story_type (str): The type of story
        story_text (str): The story content to base the image on
        
    Returns:
        str: Formatted image generation prompt
    """
    templates = load_templates()
    template = templates[story_type]
    
    # Take first 200 characters of story text for image context
    context = story_text[:200]
    
    return f"{template['image_style']}, {context}"

def get_random_elements(story_type, num_elements=2):
    """
    Get random elements for a story type.
    
    Args:
        story_type (str): The type of story
        num_elements (int): Number of elements to return
        
    Returns:
        tuple: (setting, situation, list of elements)
    """
    templates = load_templates()
    template = templates[story_type]
    
    setting = random.choice(template['settings'])
    situation = random.choice(template['situations'])
    elements = random.sample(template['elements'], min(num_elements, len(template['elements'])))
    
    return setting, situation, elements