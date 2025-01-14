from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline
import os

# Set cache directories
os.environ['TRANSFORMERS_CACHE'] = '/tmp/huggingface/cache'
os.environ['HF_HOME'] = '/tmp/huggingface/home'

# Model names
chat_model_name = "facebook/blenderbot-400M-distill"
translation_model_name = "Helsinki-NLP/opus-mt-mul-en"

# Download and cache models
print("Downloading chat model...")
tokenizer = AutoTokenizer.from_pretrained(chat_model_name)
model = AutoModelForCausalLM.from_pretrained(chat_model_name)

print("Downloading translation model...")
translator = pipeline("translation", model=translation_model_name)

print("Models downloaded successfully!")