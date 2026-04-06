import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

print("Listing available models...")
try:
    for model in client.models.list():
        if "flash" in model.name.lower():
            print(f"ID: {model.name} | Display: {model.display_name}")
except Exception as e:
    print(f"Error listing models: {e}")
